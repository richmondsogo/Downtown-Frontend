import { describe, it, expect } from "vitest";
import {
  SearchQuerySchema,
  SuggestQuerySchema,
  isListingDiscoverable,
} from "../index";

describe("Search & Discovery Validation Suite", () => {
  describe("SearchQuerySchema", () => {
    it("parses valid search query defaults", () => {
      const res = SearchQuerySchema.safeParse({});
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.sort).toBe("relevance");
        expect(res.data.availability).toBe("all");
        expect(res.data.limit).toBe(20);
      }
    });

    it("accepts query strings up to 80 characters and rejects > 80", () => {
      const validQ = "a".repeat(80);
      expect(SearchQuerySchema.safeParse({ q: validQ }).success).toBe(true);

      const invalidQ = "a".repeat(81);
      const res = SearchQuerySchema.safeParse({ q: invalidQ });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toMatch(/cannot exceed 80 characters/);
      }
    });

    it("coerces numerical inputs and enforces price bounds", () => {
      const res = SearchQuerySchema.safeParse({
        minPrice: "1000",
        maxPrice: "50000",
        limit: "15",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.minPrice).toBe(1000);
        expect(res.data.maxPrice).toBe(50000);
        expect(res.data.limit).toBe(15);
      }

      // Negative min price
      expect(SearchQuerySchema.safeParse({ minPrice: -1 }).success).toBe(false);
      // Price exceeding MAX_LISTING_PRICE_NAIRA (50M)
      expect(SearchQuerySchema.safeParse({ maxPrice: 60_000_000 }).success).toBe(false);
    });

    it("normalizes condition strings, arrays, or comma-separated lists", () => {
      const fromString = SearchQuerySchema.safeParse({ condition: "new,like_new" });
      expect(fromString.success).toBe(true);
      if (fromString.success) {
        expect(fromString.data.condition).toEqual(["new", "like_new"]);
      }

      const fromArray = SearchQuerySchema.safeParse({ condition: ["good", "fair"] });
      expect(fromArray.success).toBe(true);
      if (fromArray.success) {
        expect(fromArray.data.condition).toEqual(["good", "fair"]);
      }
    });

    it("coerces boolean verifiedOnly flag", () => {
      const resTrue = SearchQuerySchema.safeParse({ verifiedOnly: "true" });
      expect(resTrue.success).toBe(true);
      if (resTrue.success) expect(resTrue.data.verifiedOnly).toBe(true);

      const resFalse = SearchQuerySchema.safeParse({ verifiedOnly: "false" });
      expect(resFalse.success).toBe(true);
      if (resFalse.success) expect(resFalse.data.verifiedOnly).toBe(false);
    });
  });

  describe("SuggestQuerySchema", () => {
    it("requires at least 2 characters", () => {
      expect(SuggestQuerySchema.safeParse({ q: "a" }).success).toBe(false);
      expect(SuggestQuerySchema.safeParse({ q: "ab" }).success).toBe(true);
      expect(SuggestQuerySchema.safeParse({ q: "laptop" }).success).toBe(true);
    });

    it("rejects suggestions longer than 80 characters", () => {
      expect(SuggestQuerySchema.safeParse({ q: "a".repeat(81) }).success).toBe(false);
    });
  });

  describe("isListingDiscoverable Lifecycle Eligibility", () => {
    it("allows 'published' in feed, category browsing, and search", () => {
      expect(isListingDiscoverable("published", false, "all")).toBe(true);
      expect(isListingDiscoverable("published", true, "all")).toBe(true);
      expect(isListingDiscoverable("published", true, "in_stock")).toBe(true);
    });

    it("allows 'reserved' in feed and search", () => {
      expect(isListingDiscoverable("reserved", false, "all")).toBe(true);
      expect(isListingDiscoverable("reserved", true, "all")).toBe(true);
      expect(isListingDiscoverable("reserved", true, "in_stock")).toBe(true);
    });

    it("allows 'sold' ONLY when explicit search query is present and availability != in_stock", () => {
      // Unsearched home feed / category browse: NEVER show sold
      expect(isListingDiscoverable("sold", false, "all")).toBe(false);
      expect(isListingDiscoverable("sold", false, "in_stock")).toBe(false);

      // Explicit search query with availability = all: allow sold
      expect(isListingDiscoverable("sold", true, "all")).toBe(true);

      // Explicit search query with availability = in_stock / available: EXCLUDE sold
      expect(isListingDiscoverable("sold", true, "in_stock")).toBe(false);
      expect(isListingDiscoverable("sold", true, "available")).toBe(false);
    });

    it("STRICTLY BLOCKS draft, pending_moderation, and archived across all modes", () => {
      const blockedStatuses = ["draft", "pending_moderation", "archived"];
      for (const status of blockedStatuses) {
        expect(isListingDiscoverable(status, false, "all")).toBe(false);
        expect(isListingDiscoverable(status, true, "all")).toBe(false);
        expect(isListingDiscoverable(status, true, "in_stock")).toBe(false);
      }
    });
  });
});
