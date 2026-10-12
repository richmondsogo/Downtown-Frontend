import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as createListingHandler } from "../app/api/listings/route";
import { GET as getMyListingsHandler } from "../app/api/listings/mine/route";
import {
  GET as getListingByIdHandler,
  PUT as updateListingHandler,
  DELETE as deleteListingHandler,
} from "../app/api/listings/[id]/route";
import { POST as submitListingHandler } from "../app/api/listings/[id]/submit/route";
import { POST as uploadPhotoHandler } from "../app/api/listings/photos/route";
import { DELETE as deletePhotoHandler } from "../app/api/listings/photos/[id]/route";
import { pool, db } from "../db/index";
import { user, listing, listingPhoto, moderationRecord, appRateLimit } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "../services/auth.service";
import { listingService } from "../services/listing.service";
import { getStorageService, InMemoryStorageService } from "../services/storage.service";
import { seedTaxonomyAndLocations } from "../db/seeds/taxonomy-locations";
import sharp from "sharp";

describe("Listing Creation & Photo Pipeline Integration Suite", () => {
  const suffix = Math.floor(Math.random() * 100000);

  // Test users
  let sellerAId: string;
  let sellerACookie: string;

  let sellerBId: string;
  let sellerBCookie: string;

  let nonSellerId: string;
  let nonSellerCookie: string;

  let unverifiedSellerId: string;
  let unverifiedSellerCookie: string;

  async function registerAndLogin(
    email: string,
    role: "student" | "vendor",
    sellerStatus: "verified" | "not_a_seller",
    accountStatus: "active" | "suspended",
    emailVerified: boolean
  ) {
    const ip = `10.42.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

    const signUpReq = new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        "x-vercel-forwarded-for": ip,
      },
      body: JSON.stringify({
        name: `Test ${email}`,
        email,
        password: "StrongPassword123!",
        role,
        matricNumber: "2024/66554",
      }),
    });
    await auth.handler(signUpReq);

    const [created] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (!created) {
      throw new Error(`Failed to create test user with email ${email}`);
    }

    await db
      .update(user)
      .set({
        sellerStatus,
        accountStatus,
        emailVerified: true,
      })
      .where(eq(user.id, created.id));

    // Sign in to get session cookie
    const signInReq = new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        "x-vercel-forwarded-for": ip,
      },
      body: JSON.stringify({
        email,
        password: "StrongPassword123!",
      }),
    });
    const signInRes = await auth.handler(signInReq);
    if (signInRes.status !== 200) {
      const err = await signInRes.text();
      throw new Error(`Sign in failed for ${email} with status ${signInRes.status}: ${err}`);
    }
    const cookie = signInRes.headers.get("set-cookie") || "";
    if (!cookie) {
      throw new Error(`No session cookie returned for ${email}`);
    }

    if (!emailVerified) {
      await db
        .update(user)
        .set({ emailVerified: false })
        .where(eq(user.id, created.id));
    }

    return { id: created.id, cookie };
  }

  beforeAll(async () => {
    await seedTaxonomyAndLocations();

    const a = await registerAndLogin(
      `seller_a_${suffix}@example.com`,
      "student",
      "verified",
      "active",
      true
    );
    sellerAId = a.id;
    sellerACookie = a.cookie;

    const b = await registerAndLogin(
      `seller_b_${suffix}@example.com`,
      "student",
      "verified",
      "active",
      true
    );
    sellerBId = b.id;
    sellerBCookie = b.cookie;

    const ns = await registerAndLogin(
      `nonseller_${suffix}@example.com`,
      "student",
      "not_a_seller",
      "active",
      true
    );
    nonSellerId = ns.id;
    nonSellerCookie = ns.cookie;

    const unv = await registerAndLogin(
      `unverified_${suffix}@example.com`,
      "student",
      "verified",
      "active",
      true
    );
    // Revoke verified status after login to test the active session + unverified email gate
    await db.update(user).set({ emailVerified: false }).where(eq(user.id, unv.id));
    unverifiedSellerId = unv.id;
    unverifiedSellerCookie = unv.cookie;
  }, 45000);

  // Helper to create test JPEG buffer
  async function createTestImageBuffer(): Promise<Buffer> {
    return sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 50, g: 100, b: 150 },
      },
    })
      .jpeg()
      .toBuffer();
  }

  describe("Authentication & Authorization Gates", () => {
    it("returns 401 unauthenticated when no session cookie is present", async () => {
      const req = new NextRequest("http://localhost:3000/api/listings", {
        method: "POST",
        body: JSON.stringify({ title: "Draft" }),
      });
      const res = await createListingHandler(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 when email is not verified", async () => {
      const req = new NextRequest("http://localhost:3000/api/listings", {
        method: "POST",
        headers: { cookie: unverifiedSellerCookie },
        body: JSON.stringify({ title: "Draft" }),
      });
      const res = await createListingHandler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.message).toContain("email must be verified");
    });

    it("returns 403 when user is not a verified seller", async () => {
      const req = new NextRequest("http://localhost:3000/api/listings", {
        method: "POST",
        headers: { cookie: nonSellerCookie },
        body: JSON.stringify({ title: "Draft" }),
      });
      const res = await createListingHandler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.message).toContain("Verified seller status is required");
    });
  });

  describe("Photo Upload, Magic Bytes & Quota", () => {
    let uploadedPhotoId: string;

    it("rejects fake extension uploads with invalid magic bytes", async () => {
      const fakeFile = Buffer.from("NotAnImageAtAllJustPlainText");
      const req = new NextRequest("http://localhost:3000/api/listings/photos", {
        method: "POST",
        headers: {
          cookie: sellerACookie,
          "content-type": "application/octet-stream",
        },
        body: new Uint8Array(fakeFile),
      });

      const res = await uploadPhotoHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain("Unsupported file signature");
    });

    it("rejects oversize uploads exceeding 4.5 MB with 413", async () => {
      const oversizeBuffer = Buffer.alloc(4.6 * 1024 * 1024);
      const req = new NextRequest("http://localhost:3000/api/listings/photos", {
        method: "POST",
        headers: {
          cookie: sellerBCookie,
          "content-type": "application/octet-stream",
        },
        body: new Uint8Array(oversizeBuffer),
      });

      const res = await uploadPhotoHandler(req);
      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.message).toContain("4.5 MB size limit");
    });

    it("enforces photo upload rate limit with 429 when 10 uploads/min limit exceeded", async () => {
      const { checkRateLimit } = await import("../services/rate-limit.service");
      const rlKey = `photo_upload:${sellerBId}`;
      for (let i = 0; i < 10; i++) {
        await checkRateLimit(rlKey, 10, 60 * 1000);
      }

      const rlImage = await createTestImageBuffer();
      const req = new NextRequest("http://localhost:3000/api/listings/photos", {
        method: "POST",
        headers: {
          cookie: sellerBCookie,
          "content-type": "application/octet-stream",
        },
        body: new Uint8Array(rlImage),
      });

      const res = await uploadPhotoHandler(req);
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.message).toContain("Too many photo uploads");

      // Clean up rate limit key immediately so sellerB is unaffected in other tests
      await db.delete(appRateLimit).where(sql`${appRateLimit.key} LIKE ${`%${sellerBId}%`}`);
    });

    it("uploads valid image and returns WebP display and thumb variants", async () => {
      const imageBuffer = await createTestImageBuffer();
      const req = new NextRequest("http://localhost:3000/api/listings/photos", {
        method: "POST",
        headers: {
          cookie: sellerACookie,
          "content-type": "application/octet-stream",
        },
        body: new Uint8Array(imageBuffer),
      });

      const res = await uploadPhotoHandler(req);
      expect(res.status).toBe(201);
      const photo = await res.json();
      expect(photo.id).toMatch(/^pht_/);
      expect(photo.url).toContain(".webp");
      expect(photo.thumbUrl).toContain(".webp");
      expect(photo.ownerId).toBe(sellerAId);
      uploadedPhotoId = photo.id;
    });

    it("enforces IDOR: User B cannot delete User A's photo", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/listings/photos/${uploadedPhotoId}`,
        {
          method: "DELETE",
          headers: { cookie: sellerBCookie },
        }
      );

      const res = await deletePhotoHandler(req, {
        params: Promise.resolve({ id: uploadedPhotoId }),
      });
      expect(res.status).toBe(403);
    });

    it("enforces unattached photos quota of max 20", async () => {
      // Seller A already has 1 unattached photo from previous test.
      // Batch-insert 19 unattached photo rows directly to test the quota logic in a single query
      const dummyPhotos = Array.from({ length: 19 }, (_, i) => ({
        id: `pht_quota_${suffix}_${i}`,
        ownerId: sellerAId,
        listingId: null,
        key: `quota_key_${suffix}_${i}`,
        thumbKey: `quota_thumb_${suffix}_${i}`,
        width: 800,
        height: 600,
        bytes: 1000,
        position: 0,
      }));
      await db.insert(listingPhoto).values(dummyPhotos);

      // 21st unattached photo should be rejected with 429 quota exceeded
      const imageBuffer = await createTestImageBuffer();
      const quotaReq = new NextRequest("http://localhost:3000/api/listings/photos", {
        method: "POST",
        headers: {
          cookie: sellerACookie,
          "content-type": "application/octet-stream",
        },
        body: new Uint8Array(imageBuffer),
      });
      const quotaRes = await uploadPhotoHandler(quotaReq);
      expect(quotaRes.status).toBe(429);
      const quotaData = await quotaRes.json();
      expect(quotaData.message).toContain("20 unattached photos");
    }, 15000);

    it("enforces storage soft cap guard and refuses uploads above cap with 503", async () => {
      const origCap = process.env.STORAGE_SOFT_CAP_BYTES;
      try {
        // Set soft cap to 100 bytes (far below existing usage)
        process.env.STORAGE_SOFT_CAP_BYTES = "100";

        const imageBuffer = await createTestImageBuffer();
        const req = new NextRequest("http://localhost:3000/api/listings/photos", {
          method: "POST",
          headers: {
            cookie: sellerBCookie,
            "content-type": "application/octet-stream",
          },
          body: new Uint8Array(imageBuffer),
        });

        const res = await uploadPhotoHandler(req);
        expect(res.status).toBe(503);
        const data = await res.json();
        expect(data.message).toContain("Uploads are temporarily unavailable");
      } finally {
        if (origCap !== undefined) {
          process.env.STORAGE_SOFT_CAP_BYTES = origCap;
        } else {
          delete process.env.STORAGE_SOFT_CAP_BYTES;
        }
      }
    });

    it("logs a warning when storage usage reaches 70% of soft cap", async () => {
      const origCap = process.env.STORAGE_SOFT_CAP_BYTES;
      const warnSpy = vi.spyOn(console, "warn");
      try {
        const [usage] = await db
          .select({ total: sql<string>`coalesce(sum(${listingPhoto.bytes}), 0)` })
          .from(listingPhoto);
        const currentBytes = Number(usage?.total || 1000);
        // Set cap so currentBytes is ~80% of cap (above 70% but below 100%)
        const targetCap = Math.floor(currentBytes / 0.8);
        process.env.STORAGE_SOFT_CAP_BYTES = String(targetCap);

        const imageBuffer = await createTestImageBuffer();
        const photo = await listingService.uploadPhoto(sellerBId, imageBuffer);
        expect(photo.id).toBeDefined();
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("[Storage Guard Warning]")
        );
      } finally {
        warnSpy.mockRestore();
        if (origCap !== undefined) {
          process.env.STORAGE_SOFT_CAP_BYTES = origCap;
        } else {
          delete process.env.STORAGE_SOFT_CAP_BYTES;
        }
      }
    });
  });

  describe("Listing CRUD & IDOR Protection", () => {
    let listingAId: string;
    let photoA1: string;

    beforeAll(async () => {
      // Find an unattached photo for seller A
      const [photo] = await db
        .select()
        .from(listingPhoto)
        .where(eq(listingPhoto.ownerId, sellerAId))
        .limit(1);
      photoA1 = photo.id;
    });

    it("creates a draft listing for Seller A", async () => {
      const req = new NextRequest("http://localhost:3000/api/listings", {
        method: "POST",
        headers: { cookie: sellerACookie },
        body: JSON.stringify({
          title: "Calculus Textbook 8th Ed",
          description: "Clean textbook for MTH 101",
          price: 4500,
          isNegotiable: true,
          categoryId: "cat_books_study_materials",
          condition: "good",
          locationId: "loc_campus_osogbo",
          photoIds: [photoA1],
        }),
      });

      const res = await createListingHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toMatch(/^lst_/);
      expect(data.status).toBe("draft");
      expect(data.photos).toHaveLength(1);
      expect(data.photos[0].id).toBe(photoA1);
      listingAId = data.id;
    });

    it("enforces IDOR: User B cannot read User A's private listing", async () => {
      const req = new NextRequest(`http://localhost:3000/api/listings/${listingAId}`, {
        method: "GET",
        headers: { cookie: sellerBCookie },
      });

      const res = await getListingByIdHandler(req, {
        params: Promise.resolve({ id: listingAId }),
      });
      expect(res.status).toBe(403);
    });

    it("enforces IDOR: User B cannot update User A's listing", async () => {
      const req = new NextRequest(`http://localhost:3000/api/listings/${listingAId}`, {
        method: "PUT",
        headers: { cookie: sellerBCookie },
        body: JSON.stringify({ title: "Hacked title" }),
      });

      const res = await updateListingHandler(req, {
        params: Promise.resolve({ id: listingAId }),
      });
      expect(res.status).toBe(403);
    });

    it("enforces IDOR: User B cannot delete User A's draft", async () => {
      const req = new NextRequest(`http://localhost:3000/api/listings/${listingAId}`, {
        method: "DELETE",
        headers: { cookie: sellerBCookie },
      });

      const res = await deleteListingHandler(req, {
        params: Promise.resolve({ id: listingAId }),
      });
      expect(res.status).toBe(403);
    });

    it("lists only own listings in GET /api/listings/mine", async () => {
      const reqA = new NextRequest("http://localhost:3000/api/listings/mine", {
        method: "GET",
        headers: { cookie: sellerACookie },
      });
      const resA = await getMyListingsHandler(reqA);
      const listA = await resA.json();
      expect(listA.length).toBeGreaterThanOrEqual(1);
      expect(listA.every((l: any) => l.sellerId === sellerAId)).toBe(true);

      const reqB = new NextRequest("http://localhost:3000/api/listings/mine", {
        method: "GET",
        headers: { cookie: sellerBCookie },
      });
      const resB = await getMyListingsHandler(reqB);
      const listB = await resB.json();
      expect(listB.find((l: any) => l.id === listingAId)).toBeUndefined();
    });

    it("rejects submission with 6 photos (max 5 allowed) with 400", async () => {
      const draft = await listingService.createDraft(sellerAId, {
        title: "Test Draft with 6 photos",
        price: 2000,
        categoryId: "cat_books_study_materials",
        locationId: "loc_campus_osogbo",
      });

      const req = new NextRequest(`http://localhost:3000/api/listings/${draft.id}/submit`, {
        method: "POST",
        headers: { cookie: sellerACookie },
        body: JSON.stringify({
          title: "Valid Title Here",
          description: "Valid description of adequate length for listing.",
          price: 2500,
          isNegotiable: false,
          categoryId: "cat_books_study_materials",
          condition: "good",
          locationId: "loc_campus_osogbo",
          quantityAvailable: 1,
          photoIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
        }),
      });

      const res = await submitListingHandler(req, {
        params: Promise.resolve({ id: draft.id }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain("Maximum 5 photos allowed");
    });
  });

  describe("Content Moderation & Publication Routing", () => {
    let cleanListingId: string;
    let flaggedListingId: string;
    let photoId: string;

    beforeAll(async () => {
      const [photo] = await db
        .select()
        .from(listingPhoto)
        .where(eq(listingPhoto.ownerId, sellerAId))
        .limit(1);
      photoId = photo.id;
    });

    it("auto-publishes clean submission", async () => {
      // Create clean draft
      const createReq = new NextRequest("http://localhost:3000/api/listings", {
        method: "POST",
        headers: { cookie: sellerACookie },
        body: JSON.stringify({
          title: "HP EliteBook 840 G5",
          description: "Core i5 8th Gen, 16GB RAM, 256GB SSD, great battery for school work.",
          price: 210000,
          categoryId: "cat_electronics",
          condition: "good",
          locationId: "loc_campus_osogbo",
          photoIds: [photoId],
        }),
      });
      const createRes = await createListingHandler(createReq);
      const created = await createRes.json();
      cleanListingId = created.id;

      // Submit
      const submitReq = new NextRequest(
        `http://localhost:3000/api/listings/${cleanListingId}/submit`,
        {
          method: "POST",
          headers: { cookie: sellerACookie },
        }
      );
      const submitRes = await submitListingHandler(submitReq, {
        params: Promise.resolve({ id: cleanListingId }),
      });

      expect(submitRes.status).toBe(200);
      const submitted = await submitRes.json();
      expect(submitted.status).toBe("published");

      // Verify moderation record
      const [record] = await db
        .select()
        .from(moderationRecord)
        .where(eq(moderationRecord.listingId, cleanListingId));
      expect(record.result).toBe("clean");
      expect(record.flags).toEqual([]);
    });

    it("keeps flagged submission in pending_moderation", async () => {
      // Create draft with prohibited term
      const createReq = new NextRequest("http://localhost:3000/api/listings", {
        method: "POST",
        headers: { cookie: sellerACookie },
        body: JSON.stringify({
          title: "Grade A w33d and rolling papers",
          description: "Special cannabis stash available on campus.",
          price: 5000,
          categoryId: "cat_other",
          locationId: "loc_campus_osogbo",
          photoIds: [photoId],
        }),
      });
      const createRes = await createListingHandler(createReq);
      const created = await createRes.json();
      flaggedListingId = created.id;

      // Submit
      const submitReq = new NextRequest(
        `http://localhost:3000/api/listings/${flaggedListingId}/submit`,
        {
          method: "POST",
          headers: { cookie: sellerACookie },
        }
      );
      const submitRes = await submitListingHandler(submitReq, {
        params: Promise.resolve({ id: flaggedListingId }),
      });

      expect(submitRes.status).toBe(200);
      const submitted = await submitRes.json();
      expect(submitted.status).toBe("pending_moderation");

      // Verify moderation record
      const [record] = await db
        .select()
        .from(moderationRecord)
        .where(eq(moderationRecord.listingId, flaggedListingId));
      expect(record.result).toBe("flagged");
      expect(record.flags.length).toBeGreaterThan(0);
    });

    it("TEST THE BYPASS: published listing drops to pending_moderation when edited with a prohibited title", async () => {
      // cleanListingId is currently published
      const getReq = new NextRequest(
        `http://localhost:3000/api/listings/${cleanListingId}`,
        {
          method: "GET",
          headers: { cookie: sellerACookie },
        }
      );
      const getRes = await getListingByIdHandler(getReq, {
        params: Promise.resolve({ id: cleanListingId }),
      });
      const current = await getRes.json();
      expect(current.status).toBe("published");

      // Edit title to a prohibited term
      const editReq = new NextRequest(
        `http://localhost:3000/api/listings/${cleanListingId}`,
        {
          method: "PUT",
          headers: { cookie: sellerACookie },
          body: JSON.stringify({
            title: "Clean Handgun for Campus Protection",
          }),
        }
      );
      const editRes = await updateListingHandler(editReq, {
        params: Promise.resolve({ id: cleanListingId }),
      });

      expect(editRes.status).toBe(200);
      const updated = await editRes.json();
      // MUST DROP from published to pending_moderation!
      expect(updated.status).toBe("pending_moderation");
    });

    it("allows low-risk edits (description wording) on published listing to stay published", async () => {
      // First re-publish by submitting with clean title
      await db
        .update(listing)
        .set({ title: "HP EliteBook 840 G5 Clean Laptop", status: "published" })
        .where(eq(listing.id, cleanListingId));

      const editReq = new NextRequest(
        `http://localhost:3000/api/listings/${cleanListingId}`,
        {
          method: "PUT",
          headers: { cookie: sellerACookie },
          body: JSON.stringify({
            description: "Updated description: charger and wireless mouse included.",
          }),
        }
      );
      const editRes = await updateListingHandler(editReq, {
        params: Promise.resolve({ id: cleanListingId }),
      });

      expect(editRes.status).toBe(200);
      const updated = await editRes.json();
      expect(updated.status).toBe("published");
    });
  });

  describe("Storage Deletion Hygiene & Orphan Sweeper", () => {
    it("deletes attached photo blobs from storage when a draft listing is deleted", async () => {
      const storage = getStorageService() as InMemoryStorageService;
      const imageBuffer = await createTestImageBuffer();
      const photo = await listingService.uploadPhoto(sellerBId, imageBuffer);

      // Verify photo stored in memory fake
      expect(storage.getStored(photo.key)).toBeDefined();
      expect(storage.getStored(photo.thumbKey)).toBeDefined();

      // Create draft listing with this photo
      const draft = await listingService.createDraft(sellerBId, {
        title: "Draft to be deleted",
        price: 1500,
        categoryId: "cat_books_study_materials",
        locationId: "loc_campus_osogbo",
        photoIds: [photo.id],
      });

      // Delete draft
      await listingService.deleteDraft(sellerBId, draft.id);

      // Verify photo blobs are removed from storage fake and DB
      expect(storage.getStored(photo.key)).toBeUndefined();
      expect(storage.getStored(photo.thumbKey)).toBeUndefined();
      const [photoInDb] = await db
        .select()
        .from(listingPhoto)
        .where(eq(listingPhoto.id, photo.id));
      expect(photoInDb).toBeUndefined();
    });

    it("sweeps orphan photos older than 24 hours while keeping fresh ones", async () => {
      const storage = getStorageService() as InMemoryStorageService;

      // 1. Create an old orphan (> 24h)
      const oldKey = `listings/test/old_orphan_${suffix}/display.webp`;
      const oldThumbKey = `listings/test/old_orphan_${suffix}/thumb.webp`;
      await storage.upload(oldKey, Buffer.from("old display"), "image/webp");
      await storage.upload(oldThumbKey, Buffer.from("old thumb"), "image/webp");

      await db.insert(listingPhoto).values({
        id: `pht_old_orphan_${suffix}`,
        ownerId: sellerBId,
        listingId: null,
        key: oldKey,
        thumbKey: oldThumbKey,
        width: 800,
        height: 600,
        bytes: 5500,
        position: 0,
        createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000), // 26 hours ago
      });

      // 2. Create a fresh unattached photo (< 24h)
      const freshKey = `listings/test/fresh_orphan_${suffix}/display.webp`;
      const freshThumbKey = `listings/test/fresh_orphan_${suffix}/thumb.webp`;
      await storage.upload(freshKey, Buffer.from("fresh display"), "image/webp");
      await storage.upload(freshThumbKey, Buffer.from("fresh thumb"), "image/webp");

      await db.insert(listingPhoto).values({
        id: `pht_fresh_orphan_${suffix}`,
        ownerId: sellerBId,
        listingId: null,
        key: freshKey,
        thumbKey: freshThumbKey,
        width: 800,
        height: 600,
        bytes: 4200,
        position: 0,
        createdAt: new Date(), // Just now
      });

      // Run sweeper with default 24h cutoff
      const result = await listingService.sweepOrphanPhotos(24);
      expect(result.count).toBeGreaterThanOrEqual(1);
      expect(result.bytesFreed).toBeGreaterThanOrEqual(5500);

      // Verify old orphan was purged
      expect(storage.getStored(oldKey)).toBeUndefined();
      expect(storage.getStored(oldThumbKey)).toBeUndefined();
      const [oldInDb] = await db
        .select()
        .from(listingPhoto)
        .where(eq(listingPhoto.id, `pht_old_orphan_${suffix}`));
      expect(oldInDb).toBeUndefined();

      // Verify fresh unattached photo was preserved
      expect(storage.getStored(freshKey)).toBeDefined();
      expect(storage.getStored(freshThumbKey)).toBeDefined();
      const [freshInDb] = await db
        .select()
        .from(listingPhoto)
        .where(eq(listingPhoto.id, `pht_fresh_orphan_${suffix}`));
      expect(freshInDb).toBeDefined();

      // Clean up fresh test photo
      await listingService.deletePhoto(sellerBId, `pht_fresh_orphan_${suffix}`);
    });

    it("preserves database record for retry when storage provider throws during deletePhoto", async () => {
      const storage = getStorageService() as InMemoryStorageService;
      const imageBuffer = await createTestImageBuffer();
      const photo = await listingService.uploadPhoto(sellerBId, imageBuffer);

      // Mock storage.delete to simulate an upstream provider outage
      const originalDelete = storage.delete;
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      storage.delete = vi.fn().mockRejectedValue(new Error("Vercel Blob 503 Service Unavailable"));

      try {
        await expect(
          listingService.deletePhoto(sellerBId, photo.id)
        ).rejects.toThrow("Storage provider failed to delete image");

        // Verify error was logged without silent swallowing
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("[Storage Error] Failed to delete photo blobs")
        );

        // Verify photo DB record is preserved and detached for orphan sweeper retry
        const [photoInDb] = await db
          .select()
          .from(listingPhoto)
          .where(eq(listingPhoto.id, photo.id));
        expect(photoInDb).toBeDefined();
        expect(photoInDb?.listingId).toBeNull();
      } finally {
        storage.delete = originalDelete;
        consoleErrorSpy.mockRestore();
        await db.delete(listingPhoto).where(eq(listingPhoto.id, photo.id));
      }
    });

    it("preserves orphan database record when storage provider throws during sweepOrphanPhotos", async () => {
      const storage = getStorageService() as InMemoryStorageService;
      const orphanKey = `listings/test/failing_orphan_${suffix}/display.webp`;
      const orphanThumbKey = `listings/test/failing_orphan_${suffix}/thumb.webp`;
      await storage.upload(orphanKey, Buffer.from("failing display"), "image/webp");
      await storage.upload(orphanThumbKey, Buffer.from("failing thumb"), "image/webp");

      const orphanId = `pht_failing_orphan_${suffix}`;
      await db.insert(listingPhoto).values({
        id: orphanId,
        ownerId: sellerBId,
        listingId: null,
        key: orphanKey,
        thumbKey: orphanThumbKey,
        width: 1000,
        height: 750,
        bytes: 80000,
        position: 0,
        createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30h old
      });

      const originalDelete = storage.delete;
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      storage.delete = vi.fn().mockRejectedValue(new Error("Storage network socket timeout"));

      try {
        const sweepResult = await listingService.sweepOrphanPhotos(24);
        expect(sweepResult.count).toBe(0); // None deleted because storage threw

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("[Storage Error] Failed to sweep orphan photo blobs")
        );

        // Verify DB row still exists for next sweep retry
        const [orphanInDb] = await db
          .select()
          .from(listingPhoto)
          .where(eq(listingPhoto.id, orphanId));
        expect(orphanInDb).toBeDefined();
      } finally {
        storage.delete = originalDelete;
        consoleErrorSpy.mockRestore();
        await db.delete(listingPhoto).where(eq(listingPhoto.id, orphanId));
        await storage.delete(orphanKey).catch(() => {});
        await storage.delete(orphanThumbKey).catch(() => {});
      }
    });
  });
});
