import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, db } from "../db/index";
import { listing, listingPhoto, user } from "../db/schema";
import { sql, eq } from "drizzle-orm";

describe("Search Vector & Index Explain Verification Suite", () => {
  const sellerId = `test_seller_explain_${Date.now()}`;
  const listingId = `lst_explain_${Date.now()}`;

  beforeAll(async () => {
    // Ensure test user exists
    await db
      .insert(user)
      .values({
        id: sellerId,
        name: "Explain Test Seller",
        email: `seller_explain_${Date.now()}@example.com`,
        emailVerified: true,
        role: "student",
        sellerStatus: "verified",
        accountStatus: "active",
      })
      .onConflictDoNothing();

    // Insert sample test listing
    await db
      .insert(listing)
      .values({
        id: listingId,
        sellerId,
        title: "HP EliteBook 840 G5 Laptop with Charger",
        description: "Tested laptop with 16GB RAM and fast SSD in perfect campus condition.",
        price: 180000,
        isNegotiable: true,
        categoryId: "cat_electronics",
        condition: "good",
        locationId: "loc_campus_osogbo",
        status: "published",
        quantityAvailable: 1,
        quantityReserved: 0,
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(listing).where(eq(listing.id, listingId));
    await db.delete(user).where(eq(user.id, sellerId));
  });

  it("automatically generates stored search_vector containing title and description tokens", async () => {
    const [row] = await db
      .select({
        id: listing.id,
        searchVector: sql<string>`${listing.searchVector}::text`,
      })
      .from(listing)
      .where(eq(listing.id, listingId));

    expect(row).toBeDefined();
    expect(row.searchVector).toBeDefined();
    // Verify weighted tokens exist ('elitebook':A, 'charger':A, 'ssd':B, etc.)
    expect(row.searchVector).toContain("'elitebook'");
    expect(row.searchVector).toContain("'840'");
    expect(row.searchVector).toContain("'laptop'");
  });

  it("executes full-text match using websearch_to_tsquery('simple', ...)", async () => {
    const result = await db.execute(sql`
      SELECT id, title
      FROM listings
      WHERE search_vector @@ websearch_to_tsquery('simple', 'EliteBook 840')
        AND id = ${listingId}
    `);

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].id).toBe(listingId);
  });

  it("verifies GIN index scan on search_vector via EXPLAIN", async () => {
    // Disable seq scan in session to test index accessibility
    await db.execute(sql`SET enable_seqscan = off`);
    try {
      const explainResult = await db.execute(sql`
        EXPLAIN (FORMAT TEXT)
        SELECT id FROM listings
        WHERE search_vector @@ websearch_to_tsquery('simple', 'EliteBook 840')
      `);

      const planText = explainResult.rows.map((r: any) => Object.values(r)[0]).join("\n");
      // Must utilize listings_search_vector_idx
      expect(planText).toMatch(/listings_search_vector_idx/);
    } finally {
      await db.execute(sql`SET enable_seqscan = on`);
    }
  });

  it("verifies trigram index scan on title via EXPLAIN", async () => {
    await db.execute(sql`SET enable_seqscan = off`);
    try {
      const explainResult = await db.execute(sql`
        EXPLAIN (FORMAT TEXT)
        SELECT id FROM listings
        WHERE title % 'EliteBook'
      `);

      const planText = explainResult.rows.map((r: any) => Object.values(r)[0]).join("\n");
      // Must utilize listings_title_trgm_idx
      expect(planText).toMatch(/listings_title_trgm_idx/);
    } finally {
      await db.execute(sql`SET enable_seqscan = on`);
    }
  });

  it("confirms listing_photos has is_seed column defaulting to false", async () => {
    const photoId = `pht_seed_test_${Date.now()}`;
    await db.insert(listingPhoto).values({
      id: photoId,
      ownerId: sellerId,
      key: `listings/test/${photoId}/display.webp`,
      thumbKey: `listings/test/${photoId}/thumb.webp`,
      width: 400,
      height: 300,
      bytes: 12000,
      position: 0,
    });

    const [photo] = await db
      .select({ id: listingPhoto.id, isSeed: listingPhoto.isSeed })
      .from(listingPhoto)
      .where(eq(listingPhoto.id, photoId));

    expect(photo.isSeed).toBe(false);

    // Clean up
    await db.delete(listingPhoto).where(eq(listingPhoto.id, photoId));
  });
});
