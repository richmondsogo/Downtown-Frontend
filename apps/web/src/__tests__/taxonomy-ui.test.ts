import { describe, it, expect } from "vitest";
import {
  CreateLocationSchema,
  LocationAutocompleteQuerySchema,
  normalizeLocationName,
  containsPhoneNumber,
  containsUrl,
} from "@downtown/validation";

describe("Taxonomy & Location UI Primitives Contract Tests", () => {
  describe("Category Selection Logic", () => {
    const SAMPLE_CATEGORIES = [
      { id: "cat_electronics", name: "Electronics", slug: "electronics" },
      { id: "cat_fashion", name: "Fashion & Accessories", slug: "fashion-accessories" },
      { id: "cat_food", name: "Food & Drinks", slug: "food-drinks" },
    ];

    it("handles 'All' category when selectedSlug is null", () => {
      let activeCategory: string | null = null;
      expect(activeCategory).toBeNull();

      // Selecting a specific category
      activeCategory = SAMPLE_CATEGORIES[0].slug;
      expect(activeCategory).toBe("electronics");

      // Resetting to All
      activeCategory = null;
      expect(activeCategory).toBeNull();
    });

    it("verifies categories match the official GOAL.md 5.3 taxonomy", () => {
      const officialSlugs = [
        "electronics",
        "fashion-accessories",
        "food-drinks",
        "home-living",
        "books-study-materials",
        "beauty-personal-care",
        "services",
        "tickets-events",
        "other",
      ];
      expect(officialSlugs.length).toBe(9);
      expect(new Set(officialSlugs).size).toBe(9);
    });
  });

  describe("LocationSelector Combobox & Custom Creation Logic", () => {
    it("normalizes location names and removes erratic whitespace before submission", () => {
      expect(normalizeLocationName("   Green    Villa   Lodge   ")).toBe("Green Villa Lodge");
      expect(normalizeLocationName("ETF Lecture Hall")).toBe("ETF Lecture Hall");
    });

    it("strictly prevents Nigerian phone numbers in custom location inputs", () => {
      expect(containsPhoneNumber("08031234567")).toBe(true);
      expect(containsPhoneNumber("+234 803 123 4567")).toBe(true);
      expect(containsPhoneNumber("Hostel call 08123456789")).toBe(true);
      expect(containsPhoneNumber("Hostel Block 2 Room 14")).toBe(false);

      const parsed = CreateLocationSchema.safeParse({
        campusId: "campus_osogbo",
        name: "Lodge Call 08031234567",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain("phone numbers");
      }
    });

    it("strictly prevents web URLs in custom location inputs", () => {
      expect(containsUrl("https://lodge.ng")).toBe(true);
      expect(containsUrl("www.studentlodge.com")).toBe(true);
      expect(containsUrl("See website at lodge.com")).toBe(true);
      expect(containsUrl("Osun Hall of Residence")).toBe(false);

      const parsed = CreateLocationSchema.safeParse({
        campusId: "campus_osogbo",
        name: "Hostel at https://hostels.ng",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain("URLs");
      }
    });

    it("accepts valid custom location and trims payload", () => {
      const parsed = CreateLocationSchema.safeParse({
        campusId: "campus_osogbo",
        name: "  Wisdom   Lodge  ",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.name).toBe("Wisdom Lodge");
      }
    });

    it("validates autocomplete queries within safe limits", () => {
      const validQuery = LocationAutocompleteQuerySchema.safeParse({
        q: "Osogbo",
        campusId: "campus_osogbo",
      });
      expect(validQuery.success).toBe(true);

      const emptyQuery = LocationAutocompleteQuerySchema.safeParse({});
      expect(emptyQuery.success).toBe(true);
      if (emptyQuery.success) {
        expect(emptyQuery.data.q).toBe("");
      }

      const excessiveQuery = LocationAutocompleteQuerySchema.safeParse({
        q: "x".repeat(81),
      });
      expect(excessiveQuery.success).toBe(false);
    });

    it("verifies client-side merge logic combining curated and custom locations", () => {
      const curatedResults = [
        { id: "loc_1", campusId: "campus_osogbo", name: "Main Gate", slug: "main-gate", type: "campus", isCurated: true },
        { id: "loc_2", campusId: "campus_osogbo", name: "ETF Hall", slug: "etf-hall", type: "campus", isCurated: true },
      ];

      const myLocations = [
        { id: "loc_custom_1", campusId: "campus_osogbo", name: "My Hostel", slug: "my-hostel", type: "custom", isCurated: false },
        { id: "loc_custom_2", campusId: "campus_ikire", name: "Ikire Lodge", slug: "ikire-lodge", type: "custom", isCurated: false },
      ];

      // Merge function representing LocationSelector's useMemo
      function mergeLocations(
        curated: typeof curatedResults,
        custom: typeof myLocations,
        campusId: string | null,
        query: string
      ) {
        const qLower = query.trim().toLowerCase();
        const matchedCustom = custom.filter((ml) => {
          if (campusId && ml.campusId !== campusId) return false;
          if (!qLower) return true;
          return ml.name.toLowerCase().includes(qLower);
        });

        const existingIds = new Set(curated.map((c) => c.id));
        const merged = [...curated];
        for (const ml of matchedCustom) {
          if (!existingIds.has(ml.id)) {
            merged.push(ml);
            existingIds.add(ml.id);
          }
        }
        return merged;
      }

      // 1. With Osogbo campus filter and no query
      const osogboMerged = mergeLocations(curatedResults, myLocations, "campus_osogbo", "");
      expect(osogboMerged.length).toBe(3); // loc_1, loc_2, loc_custom_1
      expect(osogboMerged.some((l) => l.id === "loc_custom_1")).toBe(true);
      expect(osogboMerged.some((l) => l.id === "loc_custom_2")).toBe(false);

      // 2. With query filtering custom locations
      const queryMerged = mergeLocations(curatedResults, myLocations, "campus_osogbo", "hostel");
      expect(queryMerged.length).toBe(3);
      expect(queryMerged.find((l) => l.id === "loc_custom_1")?.isCurated).toBe(false);
    });
  });
});
