import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as getListingDetailHandler } from "../app/api/listings/[id]/route";
import { POST as viewListingHandler } from "../app/api/listings/[id]/view/route";
import { POST as saveListingHandler } from "../app/api/listings/[id]/save/route";
import { GET as getSavedListingsHandler } from "../app/api/listings/saved/route";
import { POST as createListingHandler } from "../app/api/listings/route";
import { POST as submitListingHandler } from "../app/api/listings/[id]/submit/route";
import { pool, db } from "../db/index";
import { user, listing, listingPhoto, savedListing } from "../db/schema";
import { eq } from "drizzle-orm";
import { auth } from "../services/auth.service";
import { seedTaxonomyAndLocations } from "../db/seeds/taxonomy-locations";
import type { PublicListingDetail, SavedListingItem } from "@downtown/types";

describe("Step 06: Listing Detail, View Counter & Saved Listings Suite", () => {
  const suffix = Math.floor(Math.random() * 100000);

  let sellerId: string;
  let sellerCookie: string;

  let buyerId: string;
  let buyerCookie: string;

  let draftListingId: string;
  let publishedListingId: string;
  let soldListingId: string;

  async function registerAndLogin(
    email: string,
    name: string,
    sellerStatus: "verified" | "not_a_seller"
  ) {
    const ip = `10.43.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

    const signUpReq = new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({
        name,
        email,
        password: "StrongPassword123!",
        role: "student",
        matricNumber: "2024/77889",
      }),
    });
    await auth.handler(signUpReq);

    const [created] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (!created) {
      throw new Error(`Failed to create test user: ${email}`);
    }

    await db
      .update(user)
      .set({
        sellerStatus,
        accountStatus: "active",
        emailVerified: true,
      })
      .where(eq(user.id, created.id));

    const signInReq = new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({
        email,
        password: "StrongPassword123!",
      }),
    });
    const signInRes = await auth.handler(signInReq);
    const setCookie = signInRes.headers.get("set-cookie") || "";

    return { id: created.id, cookie: setCookie };
  }

  beforeAll(async () => {
    await seedTaxonomyAndLocations();

    const seller = await registerAndLogin(
      `seller.detail.${suffix}@uniosun.edu.ng`,
      "Richmond Osogbo",
      "verified"
    );
    sellerId = seller.id;
    sellerCookie = seller.cookie;

    const buyer = await registerAndLogin(
      `buyer.detail.${suffix}@uniosun.edu.ng`,
      "Ada Lovelace",
      "not_a_seller"
    );
    buyerId = buyer.id;
    buyerCookie = buyer.cookie;

    // Create Draft listing
    const draftReq = new NextRequest("http://localhost:3000/api/listings", {
      method: "POST",
      headers: { cookie: sellerCookie },
      body: JSON.stringify({
        title: "Draft Calculus Textbook Volume 1",
        description: "Private draft textbook description for testing.",
        price: 4500,
        isNegotiable: false,
        categoryId: "cat_books_study_materials",
        locationId: "loc_campus_osogbo",
        photoIds: [],
      }),
    });
    const draftRes = await createListingHandler(draftReq);
    const draftData = await draftRes.json();
    draftListingId = draftData.id;

    // Create Published listing with a photo
    const pubPhotoId = `photo_pub_${suffix}`;
    await db.insert(listingPhoto).values({
      id: pubPhotoId,
      ownerId: sellerId,
      key: `listings/blob_${suffix}/pub.webp`,
      thumbKey: `listings/blob_${suffix}/pub_thumb.webp`,
      width: 1000,
      height: 750,
      bytes: 120000,
      position: 0,
    });

    const pubReq = new NextRequest("http://localhost:3000/api/listings", {
      method: "POST",
      headers: { cookie: sellerCookie },
      body: JSON.stringify({
        title: "Clean Scientific Calculator fx-991ES",
        description: "Original Casio calculator with dual solar battery, pristine screen.",
        price: 8500,
        isNegotiable: true,
        condition: "like_new",
        categoryId: "cat_electronics",
        locationId: "loc_campus_osogbo",
        photoIds: [pubPhotoId],
      }),
    });
    const pubRes = await createListingHandler(pubReq);
    const pubData = await pubRes.json();
    publishedListingId = pubData.id;

    // Submit to publish
    const submitReq = new NextRequest(`http://localhost:3000/api/listings/${publishedListingId}/submit`, {
      method: "POST",
      headers: { cookie: sellerCookie },
    });
    await submitListingHandler(submitReq, {
      params: Promise.resolve({ id: publishedListingId }),
    });

    // Create Sold listing
    const soldReq = new NextRequest("http://localhost:3000/api/listings", {
      method: "POST",
      headers: { cookie: sellerCookie },
      body: JSON.stringify({
        title: "Sold UNIOSUN Lab Coat Size Medium",
        description: "Official white lab coat, clean condition, already sold.",
        price: 3000,
        isNegotiable: false,
        condition: "good",
        categoryId: "cat_fashion_accessories",
        locationId: "loc_campus_osogbo",
        photoIds: [],
      }),
    });
    const soldRes = await createListingHandler(soldReq);
    const soldData = await soldRes.json();
    soldListingId = soldData.id;

    await db.update(listing).set({ status: "sold" }).where(eq(listing.id, soldListingId));
  }, 60000);

  describe("Public Listing Detail Projection & Privacy Boundary", () => {
    it("returns public listing detail with zero seller PII", async () => {
      const req = new NextRequest(`http://localhost:3000/api/listings/${publishedListingId}`, {
        method: "GET",
      });
      const res = await getListingDetailHandler(req, {
        params: Promise.resolve({ id: publishedListingId }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toContain("public, s-maxage=60");

      const data: PublicListingDetail = await res.json();
      expect(data.id).toBe(publishedListingId);
      expect(data.title).toBe("Clean Scientific Calculator fx-991ES");
      expect(data.price).toBe(8500);
      expect(data.isNegotiable).toBe(true);
      expect(data.condition).toBe("like_new");
      expect(data.category.id).toBe("cat_electronics");
      expect(data.photos).toHaveLength(1);
      expect(data.photos[0].width).toBe(1000);

      // Seller Trust Card privacy checks
      expect(data.seller.displayName).toBe("Richmond O.");
      expect(data.seller.isVerifiedSeller).toBe(true);
      expect(data.seller.studentVerificationStatus).toBe("verified");
      expect(data.seller.memberSince).toMatch(/Oct 2026/);

      // STRICT PRIVACY: Zero seller PII
      const rawJson = JSON.stringify(data);
      expect(rawJson).not.toContain("seller.detail.");
      expect(rawJson).not.toContain("@uniosun.edu.ng");
      expect(rawJson).not.toContain("2024/77889");
      expect(rawJson).not.toContain(sellerId);
    });

    it("enforces IDOR: unauthenticated guest or non-owner cannot read private draft (403)", async () => {
      // Guest attempt
      const guestReq = new NextRequest(`http://localhost:3000/api/listings/${draftListingId}`, {
        method: "GET",
      });
      const guestRes = await getListingDetailHandler(guestReq, {
        params: Promise.resolve({ id: draftListingId }),
      });
      expect(guestRes.status).toBe(403);

      // Buyer (non-owner) attempt
      const buyerReq = new NextRequest(`http://localhost:3000/api/listings/${draftListingId}`, {
        method: "GET",
        headers: { cookie: buyerCookie },
      });
      const buyerRes = await getListingDetailHandler(buyerReq, {
        params: Promise.resolve({ id: draftListingId }),
      });
      expect(buyerRes.status).toBe(403);
    });

    it("allows seller to read their own draft listing", async () => {
      const ownerReq = new NextRequest(`http://localhost:3000/api/listings/${draftListingId}`, {
        method: "GET",
        headers: { cookie: sellerCookie },
      });
      const ownerRes = await getListingDetailHandler(ownerReq, {
        params: Promise.resolve({ id: draftListingId }),
      });
      expect(ownerRes.status).toBe(200);

      const data = await ownerRes.json();
      expect(data.id).toBe(draftListingId);
      expect(data.status).toBe("draft");
    });

    it("returns 404 for non-existent listing", async () => {
      const req = new NextRequest("http://localhost:3000/api/listings/non-existent-uuid", {
        method: "GET",
      });
      const res = await getListingDetailHandler(req, {
        params: Promise.resolve({ id: "non-existent-uuid" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("View Counter & Abuse Prevention", () => {
    it("increments view count atomically on initial visit", async () => {
      const ip = `10.99.1.${Math.floor(Math.random() * 250)}`;
      const req = new NextRequest(`http://localhost:3000/api/listings/${publishedListingId}/view`, {
        method: "POST",
        headers: { "x-forwarded-for": ip },
      });

      const res = await viewListingHandler(req, {
        params: Promise.resolve({ id: publishedListingId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.viewCount).toBeGreaterThanOrEqual(1);
    });

    it("rate limits rapid view increments from the same client IP", async () => {
      const ip = `10.99.2.${Math.floor(Math.random() * 250)}`;

      // First request increments
      const req1 = new NextRequest(`http://localhost:3000/api/listings/${publishedListingId}/view`, {
        method: "POST",
        headers: { "x-forwarded-for": ip },
      });
      const res1 = await viewListingHandler(req1, {
        params: Promise.resolve({ id: publishedListingId }),
      });
      const data1 = await res1.json();
      const countAfterFirst = data1.viewCount;

      // Immediate second request from same IP is rate-limited (does not increment)
      const req2 = new NextRequest(`http://localhost:3000/api/listings/${publishedListingId}/view`, {
        method: "POST",
        headers: { "x-forwarded-for": ip },
      });
      const res2 = await viewListingHandler(req2, {
        params: Promise.resolve({ id: publishedListingId }),
      });
      const data2 = await res2.json();
      expect(data2.ok).toBe(true);
      expect(data2.viewCount).toBe(countAfterFirst);
    });
  });

  describe("Saved Listings API", () => {
    it("refuses save toggle when unauthenticated (401)", async () => {
      const req = new NextRequest(`http://localhost:3000/api/listings/${publishedListingId}/save`, {
        method: "POST",
      });
      const res = await saveListingHandler(req, {
        params: Promise.resolve({ id: publishedListingId }),
      });
      expect(res.status).toBe(401);
    });

    it("toggles save state (save then unsave) for authenticated buyer", async () => {
      // 1. First toggle saves the listing
      const saveReq = new NextRequest(`http://localhost:3000/api/listings/${publishedListingId}/save`, {
        method: "POST",
        headers: { cookie: buyerCookie },
      });
      const saveRes = await saveListingHandler(saveReq, {
        params: Promise.resolve({ id: publishedListingId }),
      });
      expect(saveRes.status).toBe(200);
      const saveData = await saveRes.json();
      expect(saveData.saved).toBe(true);

      // Check detail reflects isSaved: true
      const detailReq = new NextRequest(`http://localhost:3000/api/listings/${publishedListingId}`, {
        method: "GET",
        headers: { cookie: buyerCookie },
      });
      const detailRes = await getListingDetailHandler(detailReq, {
        params: Promise.resolve({ id: publishedListingId }),
      });
      const detailData = await detailRes.json();
      expect(detailData.isSaved).toBe(true);

      // 2. Second toggle unsaves the listing
      const unsaveReq = new NextRequest(`http://localhost:3000/api/listings/${publishedListingId}/save`, {
        method: "POST",
        headers: { cookie: buyerCookie },
      });
      const unsaveRes = await saveListingHandler(unsaveReq, {
        params: Promise.resolve({ id: publishedListingId }),
      });
      expect(unsaveRes.status).toBe(200);
      const unsaveData = await unsaveRes.json();
      expect(unsaveData.saved).toBe(false);

      // Check detail reflects isSaved: false
      const detailReq2 = new NextRequest(`http://localhost:3000/api/listings/${publishedListingId}`, {
        method: "GET",
        headers: { cookie: buyerCookie },
      });
      const detailRes2 = await getListingDetailHandler(detailReq2, {
        params: Promise.resolve({ id: publishedListingId }),
      });
      const detailData2 = await detailRes2.json();
      expect(detailData2.isSaved).toBe(false);
    });

    it("retrieves saved listings and preserves sold items for greyed display", async () => {
      // Save both the published item and the sold item
      await saveListingHandler(
        new NextRequest(`http://localhost:3000/api/listings/${publishedListingId}/save`, {
          method: "POST",
          headers: { cookie: buyerCookie },
        }),
        { params: Promise.resolve({ id: publishedListingId }) }
      );

      await saveListingHandler(
        new NextRequest(`http://localhost:3000/api/listings/${soldListingId}/save`, {
          method: "POST",
          headers: { cookie: buyerCookie },
        }),
        { params: Promise.resolve({ id: soldListingId }) }
      );

      // Fetch saved items
      const getReq = new NextRequest("http://localhost:3000/api/listings/saved", {
        method: "GET",
        headers: { cookie: buyerCookie },
      });
      const getRes = await getSavedListingsHandler(getReq);
      expect(getRes.status).toBe(200);

      const body = await getRes.json();
      const items: SavedListingItem[] = body.items;

      expect(items.length).toBeGreaterThanOrEqual(2);

      const savedPublished = items.find((i) => i.listing.id === publishedListingId);
      expect(savedPublished).toBeDefined();
      expect(savedPublished?.listing.availability).toBe("available");
      expect(savedPublished?.listing.status).toBe("published");

      // Sold item is preserved with status 'sold'
      const savedSold = items.find((i) => i.listing.id === soldListingId);
      expect(savedSold).toBeDefined();
      expect(savedSold?.listing.availability).toBe("sold");
      expect(savedSold?.listing.status).toBe("sold");
    });
  });
});
