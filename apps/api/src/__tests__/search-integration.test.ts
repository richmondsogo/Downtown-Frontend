import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as getListingsHandler } from "../app/api/listings/route";
import { GET as getSuggestionsHandler } from "../app/api/search/suggest/route";
import { pool, db } from "../db/index";
import { listing, listingPhoto, user, location } from "../db/schema";
import { eq, inArray } from "drizzle-orm";

describe("Search, Feed & Multi-Signal Discovery Integration Suite", () => {
  const sellerId = `seller_search_${Date.now()}`;
  const otherSellerId = `seller_other_${Date.now()}`;
  const createdListingIds: string[] = [];

  beforeAll(async () => {
    // 1. Create test sellers
    await db.insert(user).values([
      {
        id: sellerId,
        name: "Richmond Babatunde Osogbo",
        email: `richmond_search_${Date.now()}@example.com`,
        emailVerified: true,
        role: "student",
        sellerStatus: "verified",
        accountStatus: "active",
      },
      {
        id: otherSellerId,
        name: "Unverified Student",
        email: `unverified_search_${Date.now()}@example.com`,
        emailVerified: true,
        role: "student",
        sellerStatus: "not_a_seller",
        accountStatus: "active",
      },
    ]);

    // 2. Create test listings across all statuses and types
    const baseListing = {
      sellerId,
      categoryId: "cat_electronics",
      locationId: "loc_campus_osogbo",
      quantityAvailable: 1,
      quantityReserved: 0,
    };

    const listingsToInsert = [
      // Published item
      {
        id: `lst_test_pub_${Date.now()}`,
        ...baseListing,
        title: "MacBook Pro M1 16GB 512GB Space Grey",
        description: "Super fast laptop for software engineering and design.",
        price: 450000,
        status: "published",
      },
      // Reserved item
      {
        id: `lst_test_res_${Date.now()}`,
        ...baseListing,
        title: "MacBook Air M2 Midnight",
        description: "Lightweight laptop reserved for buyer pick up.",
        price: 520000,
        status: "reserved",
      },
      // Sold item
      {
        id: `lst_test_sold_${Date.now()}`,
        ...baseListing,
        title: "MacBook Pro Intel i7 16GB",
        description: "Previously used laptop now sold out.",
        price: 250000,
        status: "sold",
      },
      // Draft item (must NEVER be discoverable)
      {
        id: `lst_test_draft_${Date.now()}`,
        ...baseListing,
        title: "MacBook Pro Draft Laptop",
        description: "Draft listing still being drafted.",
        price: 300000,
        status: "draft",
      },
      // Pending moderation item (must NEVER be discoverable)
      {
        id: `lst_test_mod_${Date.now()}`,
        ...baseListing,
        title: "MacBook Pro Under Review",
        description: "Pending moderation listing.",
        price: 350000,
        status: "pending_moderation",
      },
      // Archived item (must NEVER be discoverable)
      {
        id: `lst_test_arch_${Date.now()}`,
        ...baseListing,
        title: "MacBook Pro Archived Listing",
        description: "Archived listing.",
        price: 200000,
        status: "archived",
      },
      // Items for keyset pagination stability (tied prices)
      {
        id: `lst_test_tie_1_${Date.now()}`,
        ...baseListing,
        title: "Scientific Calculator Model Alpha",
        description: "Campus calculator with tied price.",
        price: 15000,
        status: "published",
      },
      {
        id: `lst_test_tie_2_${Date.now()}`,
        ...baseListing,
        title: "Scientific Calculator Model Beta",
        description: "Campus calculator with tied price.",
        price: 15000,
        status: "published",
      },
      {
        id: `lst_test_tie_3_${Date.now()}`,
        ...baseListing,
        title: "Scientific Calculator Model Gamma",
        description: "Campus calculator with tied price.",
        price: 15000,
        status: "published",
      },
    ];

    for (const l of listingsToInsert) {
      await db.insert(listing).values(l);
      createdListingIds.push(l.id);
    }
  }, 30000);

  afterAll(async () => {
    if (createdListingIds.length > 0) {
      await db.delete(listingPhoto).where(inArray(listingPhoto.listingId, createdListingIds));
      await db.delete(listing).where(inArray(listing.id, createdListingIds));
    }
    await db.delete(user).where(inArray(user.id, [sellerId, otherSellerId]));
  });

  describe("Lifecycle Status Eligibility (Amendment e)", () => {
    it("never shows draft, pending_moderation, or archived listings under any query", async () => {
      const req = new NextRequest("http://localhost:3000/api/listings?q=MacBook", {
        headers: { "x-vercel-forwarded-for": "10.0.1.1" },
      });
      const res = await getListingsHandler(req);
      const data = await res.json();

      const statuses = data.items.map((i: any) => i.status);
      expect(statuses).not.toContain("draft");
      expect(statuses).not.toContain("pending_moderation");
      expect(statuses).not.toContain("archived");
    });

    it("excludes sold listings from unsearched home feed", async () => {
      const req = new NextRequest("http://localhost:3000/api/listings", {
        headers: { "x-vercel-forwarded-for": "10.0.1.2" },
      });
      const res = await getListingsHandler(req);
      const data = await res.json();

      const statuses = data.items.map((i: any) => i.status);
      expect(statuses).not.toContain("sold");
      expect(data.items.some((i: any) => i.title.includes("Intel i7"))).toBe(false);
    });

    it("excludes sold listings from category browsing when no query is present", async () => {
      const req = new NextRequest("http://localhost:3000/api/listings?categoryId=cat_electronics", {
        headers: { "x-vercel-forwarded-for": "10.0.1.3" },
      });
      const res = await getListingsHandler(req);
      const data = await res.json();

      const statuses = data.items.map((i: any) => i.status);
      expect(statuses).not.toContain("sold");
    });

    it("excludes sold listings when availability filter is 'in_stock' even with keyword search", async () => {
      const req = new NextRequest("http://localhost:3000/api/listings?q=MacBook&availability=in_stock", {
        headers: { "x-vercel-forwarded-for": "10.0.1.4" },
      });
      const res = await getListingsHandler(req);
      const data = await res.json();

      const statuses = data.items.map((i: any) => i.status);
      expect(statuses).not.toContain("sold");
      expect(data.items.some((i: any) => i.title.includes("Intel i7"))).toBe(false);
    });

    it("includes sold listings ONLY when keyword is present, ranking them last", async () => {
      const req = new NextRequest("http://localhost:3000/api/listings?q=MacBook&availability=all", {
        headers: { "x-vercel-forwarded-for": "10.0.1.5" },
      });
      const res = await getListingsHandler(req);
      const data = await res.json();

      const soldItem = data.items.find((i: any) => i.status === "sold");
      expect(soldItem).toBeDefined();
      expect(soldItem.availability).toBe("sold");

      // Sold item must rank after published and reserved items
      const publishedIndex = data.items.findIndex((i: any) => i.status === "published");
      const reservedIndex = data.items.findIndex((i: any) => i.status === "reserved");
      const soldIndex = data.items.findIndex((i: any) => i.status === "sold");

      expect(publishedIndex).toBeLessThan(soldIndex);
      expect(reservedIndex).toBeLessThan(soldIndex);
    });
  });

  describe("Query Syntax Safety & Robustness (Amendment f)", () => {
    it(
      "safely handles unescaped punctuation, quotes, and boolean operators without syntax crashing",
      async () => {
        const safeQueries = [
          `"MacBook Pro"`,
          `MacBook & Pro | Air ! Mini`,
          `MacBook (Pro) * 2022:`,
          `MacBook: 16GB / 512GB SSD`,
          `💻📱🎧 Laptop & Tech!`,
          `ماك بوك برو`,
          `' OR '1'='1`,
          `"; DROP TABLE listings; --`,
        ];

        await Promise.all(
          safeQueries.map(async (queryStr, i) => {
            const q = encodeURIComponent(queryStr);
            const req = new NextRequest(`http://localhost:3000/api/listings?q=${q}`, {
              headers: { "x-vercel-forwarded-for": `10.0.2.${i + 1}` },
            });
            const res = await getListingsHandler(req);
            // Must succeed with HTTP 200, never crash with 500 syntax error
            expect(res.status).toBe(200);
          })
        );
      },
      15000
    );

    it("strictly rejects query strings exceeding 80 characters with 400", async () => {
      const longQuery = "a".repeat(81);
      const req = new NextRequest(`http://localhost:3000/api/listings?q=${longQuery}`, {
        headers: { "x-vercel-forwarded-for": "10.0.3.1" },
      });
      const res = await getListingsHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toMatch(/cannot exceed 80 characters/);
    });

    it("strictly rejects 10,000 character overflow attack string with 400", async () => {
      const overflowQuery = "x".repeat(10000);
      const req = new NextRequest(`http://localhost:3000/api/listings?q=${overflowQuery}`, {
        headers: { "x-vercel-forwarded-for": "10.0.3.2" },
      });
      const res = await getListingsHandler(req);
      expect(res.status).toBe(400);
    });
  });

  describe("Keyset Pagination & Tie-Breaker Stability (Amendment g)", () => {
    it("paginates without COUNT(*) and stably walks tied sort keys", async () => {
      // Query tied calculators with limit=2
      const page1Req = new NextRequest(
        "http://localhost:3000/api/listings?q=Scientific Calculator&sort=price_asc&limit=2",
        { headers: { "x-vercel-forwarded-for": "10.0.4.1" } }
      );
      const page1Res = await getListingsHandler(page1Req);
      const page1 = await page1Res.json();

      expect(page1.items.length).toBe(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      // Page 2 using cursor
      const page2Req = new NextRequest(
        `http://localhost:3000/api/listings?q=Scientific Calculator&sort=price_asc&limit=2&cursor=${page1.nextCursor}`,
        { headers: { "x-vercel-forwarded-for": "10.0.4.2" } }
      );
      const page2Res = await getListingsHandler(page2Req);
      const page2 = await page2Res.json();

      expect(page2.items.length).toBeGreaterThanOrEqual(1);

      // Verify ZERO duplicate IDs between page 1 and page 2
      const page1Ids = page1.items.map((i: any) => i.id);
      const page2Ids = page2.items.map((i: any) => i.id);
      for (const id of page2Ids) {
        expect(page1Ids).not.toContain(id);
      }
    });
  });

  describe("Public Suggestion Endpoint (`GET /api/search/suggest`) (Amendment c)", () => {
    it("rejects queries under 2 characters with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/search/suggest?q=m", {
        headers: { "x-vercel-forwarded-for": "10.0.5.1" },
      });
      const res = await getSuggestionsHandler(req);
      expect(res.status).toBe(400);
    });

    it("returns up to 6 title suggestions for valid query", async () => {
      const req = new NextRequest("http://localhost:3000/api/search/suggest?q=MacBook", {
        headers: { "x-vercel-forwarded-for": "10.0.5.2" },
      });
      const res = await getSuggestionsHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeLessThanOrEqual(6);
      expect(data.some((title: string) => title.includes("MacBook"))).toBe(true);
    });

    it("sets edge cache headers on suggestions (s-maxage=60, stale-while-revalidate=120)", async () => {
      const req = new NextRequest("http://localhost:3000/api/search/suggest?q=Laptop", {
        headers: { "x-vercel-forwarded-for": "10.0.5.3" },
      });
      const res = await getSuggestionsHandler(req);
      expect(res.headers.get("cache-control")).toContain("public");
      expect(res.headers.get("cache-control")).toContain("s-maxage=60");
      expect(res.headers.get("cache-control")).toContain("stale-while-revalidate=120");
    });
  });

  describe("Strict Privacy Boundary (Zero PII)", () => {
    it("ensures public listing cards never disclose seller userId, email, matricNumber, or phone", async () => {
      const req = new NextRequest("http://localhost:3000/api/listings?q=MacBook Pro M1", {
        headers: { "x-vercel-forwarded-for": "10.0.6.1" },
      });
      const res = await getListingsHandler(req);
      const data = await res.json();
      const card = data.items[0];

      expect(card).toBeDefined();
      expect((card as any).userId).toBeUndefined();
      expect((card as any).email).toBeUndefined();
      expect((card as any).matricNumber).toBeUndefined();
      expect((card as any).phone).toBeUndefined();

      // Formatted display name (First Name + Last Initial)
      expect(card.seller.displayName).toBe("Richmond O.");
      expect(card.seller.isVerified).toBe(true);
    });

    it("returns public edge cache headers (s-maxage=60, stale-while-revalidate=120)", async () => {
      const req = new NextRequest("http://localhost:3000/api/listings", {
        headers: { "x-vercel-forwarded-for": "10.0.6.2" },
      });
      const res = await getListingsHandler(req);
      expect(res.headers.get("cache-control")).toContain("public");
      expect(res.headers.get("cache-control")).toContain("s-maxage=60");
      expect(res.headers.get("cache-control")).toContain("stale-while-revalidate=120");
    });
  });
});
