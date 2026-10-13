import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { POST as createRequestHandler } from "../app/api/listings/[id]/requests/route";
import { POST as cancelRequestHandler } from "../app/api/requests/[id]/cancel/route";
import { GET as getRequestHandler } from "../app/api/requests/[id]/route";
import { GET as listRequestsHandler } from "../app/api/requests/route";
import { GET as cronExpireHandler } from "../app/api/cron/expire-requests/route";
import { GET as getNotificationsHandler } from "../app/api/notifications/route";
import { PATCH as updatePhoneHandler } from "../app/api/user/phone/route";
import { GET as getListingDetailHandler } from "../app/api/listings/[id]/route";
import { pool, db } from "../db/index";
import {
  user,
  listing,
  purchaseRequest,
  notification,
  category,
  campus,
  location,
} from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "../services/auth.service";
import { listingService } from "../services/listing.service";
import { purchaseRequestService } from "../services/purchase-request.service";
import { seedTaxonomyAndLocations } from "../db/seeds/taxonomy-locations";

describe("Step 07: Purchase Request, Reservations, Abuse Limits & Privacy Suite", { timeout: 45000 }, () => {
  const suffix = Math.floor(Math.random() * 100000);

  let sellerId: string;
  let sellerCookie: string;
  const sellerPhone = "+2348031111111";

  let buyer1Id: string;
  let buyer1Cookie: string;
  const buyer1Phone = "+2348032222222";

  let buyer2Id: string;
  let buyer2Cookie: string;
  const buyer2Phone = "+2348033333333";

  let buyer3Id: string;
  let buyer3Cookie: string;
  const buyer3Phone = "+2348034444444";

  let categoryId: string;
  let campusId: string;
  let locationId: string;

  async function registerAndLogin(
    email: string,
    name: string,
    sellerStatus: "verified" | "not_a_seller",
    phone?: string
  ) {
    const ip = `10.43.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

    const signUpReq = new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        "x-vercel-forwarded-for": ip,
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
        phone: phone || null,
      })
      .where(eq(user.id, created.id));

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
    const setCookie = signInRes.headers.get("set-cookie") || "";

    return { id: created.id, cookie: setCookie };
  }

  async function createTestListing(options: {
    sellerId: string;
    title: string;
    price: number;
    quantityAvailable: number;
    isNegotiable?: boolean;
    status?: "published" | "draft";
  }): Promise<string> {
    const listingId = `lst_${Math.random().toString(36).slice(2, 10)}`;
    await db.insert(listing).values({
      id: listingId,
      sellerId: options.sellerId,
      title: options.title,
      description: "Step 07 test listing item description",
      price: options.price,
      quantityAvailable: options.quantityAvailable,
      quantityReserved: 0,
      isNegotiable: options.isNegotiable ?? false,
      condition: "fair",
      categoryId,
      locationId,
      status: options.status || "published",
    });
    return listingId;
  }

  beforeAll(async () => {
    process.env.CRON_SECRET = "test-cron-secret-step07";
    const [existingCat] = await db.select({ id: category.id }).from(category).limit(1);
    if (!existingCat) {
      await seedTaxonomyAndLocations();
    }
    const [cat] = await db.select({ id: category.id }).from(category).limit(1);
    const [camp] = await db.select({ id: campus.id }).from(campus).limit(1);
    const [loc] = await db.select({ id: location.id }).from(location).limit(1);

    categoryId = cat.id;
    campusId = camp.id;
    locationId = loc.id;

    const seller = await registerAndLogin(
      `seller.step07.${suffix}@uniosun.edu.ng`,
      "Richmond Seller",
      "verified",
      sellerPhone
    );
    sellerId = seller.id;
    sellerCookie = seller.cookie;

    const b1 = await registerAndLogin(
      `buyer1.step07.${suffix}@uniosun.edu.ng`,
      "Ada BuyerOne",
      "not_a_seller",
      buyer1Phone
    );
    buyer1Id = b1.id;
    buyer1Cookie = b1.cookie;

    const b2 = await registerAndLogin(
      `buyer2.step07.${suffix}@uniosun.edu.ng`,
      "Babatunde BuyerTwo",
      "not_a_seller",
      buyer2Phone
    );
    buyer2Id = b2.id;
    buyer2Cookie = b2.cookie;

    const b3 = await registerAndLogin(
      `buyer3.step07.${suffix}@uniosun.edu.ng`,
      "Chidi BuyerThree",
      "not_a_seller",
      buyer3Phone
    );
    buyer3Id = b3.id;
    buyer3Cookie = b3.cookie;
  });

  describe("1. Concurrency & Race Condition Guarantee", () => {
    it("handles two concurrent requests for the last remaining unit: exactly one succeeds (201) and one fails (409)", async () => {
      const singleUnitListingId = await createTestListing({
        sellerId,
        title: `Race Unit Phone ${suffix}`,
        price: 25000,
        quantityAvailable: 1,
      });

      const ip1 = "10.45.1.1";
      const ip2 = "10.45.1.2";

      // Execute concurrent requests from buyer1 and buyer2
      const [res1, res2] = await Promise.all([
        createRequestHandler(
          new NextRequest(`http://localhost:3000/api/listings/${singleUnitListingId}/requests`, {
            method: "POST",
            headers: {
              cookie: buyer1Cookie,
              "content-type": "application/json",
              "x-vercel-forwarded-for": ip1,
            },
            body: JSON.stringify({ requestedQuantity: 1 }),
          }),
          { params: Promise.resolve({ id: singleUnitListingId }) }
        ),
        createRequestHandler(
          new NextRequest(`http://localhost:3000/api/listings/${singleUnitListingId}/requests`, {
            method: "POST",
            headers: {
              cookie: buyer2Cookie,
              "content-type": "application/json",
              "x-vercel-forwarded-for": ip2,
            },
            body: JSON.stringify({ requestedQuantity: 1 }),
          }),
          { params: Promise.resolve({ id: singleUnitListingId }) }
        ),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      // Verify DB state: listing is marked reserved, quantity_reserved = 1
      const [updatedListing] = await db
        .select()
        .from(listing)
        .where(eq(listing.id, singleUnitListingId))
        .limit(1);

      expect(updatedListing.status).toBe("reserved");
      expect(updatedListing.quantityReserved).toBe(1);
    });
  });

  describe("2. Lapsed Reservation & Effective Availability", () => {
    it("immediately frees stock when a reservation lapses (>24h) without requiring a background sweep", async () => {
      const lapsedListingId = await createTestListing({
        sellerId,
        title: `Lapsed Hold Book ${suffix}`,
        price: 5000,
        quantityAvailable: 1,
      });

      // Buyer 1 creates request
      const reqRes = await createRequestHandler(
        new NextRequest(`http://localhost:3000/api/listings/${lapsedListingId}/requests`, {
          method: "POST",
          headers: {
            cookie: buyer1Cookie,
            "content-type": "application/json",
            "x-vercel-forwarded-for": "10.45.2.1",
          },
          body: JSON.stringify({ requestedQuantity: 1 }),
        }),
        { params: Promise.resolve({ id: lapsedListingId }) }
      );
      expect(reqRes.status).toBe(201);

      // Artificially lapse the reservation (>24h ago) in DB
      await db
        .update(purchaseRequest)
        .set({
          reservationExpiresAt: sql`now() - interval '2 hours'`,
        })
        .where(
          and(
            eq(purchaseRequest.listingId, lapsedListingId),
            eq(purchaseRequest.buyerId, buyer1Id)
          )
        );

      // Verify effective availability via detail endpoint shows unreserved = 1, status = published
      const detailRes = await getListingDetailHandler(
        new NextRequest(`http://localhost:3000/api/listings/${lapsedListingId}`),
        { params: Promise.resolve({ id: lapsedListingId }) }
      );
      expect(detailRes.status).toBe(200);
      const detailJson = await detailRes.json();
      expect(detailJson.effectiveAvailability).toBe(1);

      // Buyer 2 should now be able to successfully reserve the item immediately
      const buyer2ReqRes = await createRequestHandler(
        new NextRequest(`http://localhost:3000/api/listings/${lapsedListingId}/requests`, {
          method: "POST",
          headers: {
            cookie: buyer2Cookie,
            "content-type": "application/json",
            "x-vercel-forwarded-for": "10.45.2.2",
          },
          body: JSON.stringify({ requestedQuantity: 1 }),
        }),
        { params: Promise.resolve({ id: lapsedListingId }) }
      );
      expect(buyer2ReqRes.status).toBe(201);
    });
  });

  describe("3. Contact Idempotency & Partial Unique Index", () => {
    it("returns existing request and wa.me link with HTTP 200 on repeated contact (idempotent)", async () => {
      const idemListingId = await createTestListing({
        sellerId,
        title: `Idempotent Gadget ${suffix}`,
        price: 15000,
        quantityAvailable: 3,
      });

      // First creation: 201
      const res1 = await createRequestHandler(
        new NextRequest(`http://localhost:3000/api/listings/${idemListingId}/requests`, {
          method: "POST",
          headers: {
            cookie: buyer1Cookie,
            "content-type": "application/json",
            "x-vercel-forwarded-for": "10.45.3.1",
          },
          body: JSON.stringify({ requestedQuantity: 1 }),
        }),
        { params: Promise.resolve({ id: idemListingId }) }
      );
      expect(res1.status).toBe(201);
      const json1 = await res1.json();
      expect(json1.whatsappUrl).toContain("wa.me/2348031111111");

      // Second contact: 200 with isExisting = true and same request ID
      const res2 = await createRequestHandler(
        new NextRequest(`http://localhost:3000/api/listings/${idemListingId}/requests`, {
          method: "POST",
          headers: {
            cookie: buyer1Cookie,
            "content-type": "application/json",
            "x-vercel-forwarded-for": "10.45.3.1",
          },
          body: JSON.stringify({ requestedQuantity: 1 }),
        }),
        { params: Promise.resolve({ id: idemListingId }) }
      );
      expect(res2.status).toBe(200);
      const json2 = await res2.json();
      expect(json2.isExisting).toBe(true);
      expect(json2.request.id).toBe(json1.request.id);
      expect(json2.whatsappUrl).toBe(json1.whatsappUrl);

      // Verify partial unique index prevents direct raw DB insert of a second pending request
      await expect(
        db.insert(purchaseRequest).values({
          id: `pr_dupe_${Math.random().toString(36).slice(2, 10)}`,
          listingId: idemListingId,
          buyerId: buyer1Id,
          sellerId,
          unitPrice: 15000,
          requestedQuantity: 1,
          status: "pending",
          reservationExpiresAt: new Date(Date.now() + 86400000),
          resolutionDeadline: new Date(Date.now() + 7 * 86400000),
        })
      ).rejects.toThrow();
    });
  });

  describe("4. Abuse Limits & Quotas", () => {
    it("enforces max 5 live pending requests per buyer", async () => {
      // Create a fresh dedicated buyer
      const bQuota = await registerAndLogin(
        `buyer.quota.${suffix}@uniosun.edu.ng`,
        "Quota Tester",
        "not_a_seller",
        "+2348039998888"
      );

      // Create 5 listings and make 5 live requests
      for (let i = 0; i < 5; i++) {
        const lstId = await createTestListing({
          sellerId,
          title: `Quota Item ${i} ${suffix}`,
          price: 2000,
          quantityAvailable: 2,
        });

        const res = await createRequestHandler(
          new NextRequest(`http://localhost:3000/api/listings/${lstId}/requests`, {
            method: "POST",
            headers: {
              cookie: bQuota.cookie,
              "content-type": "application/json",
              "x-vercel-forwarded-for": `10.45.4.${i + 1}`,
            },
            body: JSON.stringify({ requestedQuantity: 1 }),
          }),
          { params: Promise.resolve({ id: lstId }) }
        );
        expect(res.status).toBe(201);
      }

      // 6th request must be rejected with 429
      const sixthListingId = await createTestListing({
        sellerId,
        title: `Quota Item 6 ${suffix}`,
        price: 2000,
        quantityAvailable: 2,
      });

      const res6 = await createRequestHandler(
        new NextRequest(`http://localhost:3000/api/listings/${sixthListingId}/requests`, {
          method: "POST",
          headers: {
            cookie: bQuota.cookie,
            "content-type": "application/json",
            "x-vercel-forwarded-for": "10.45.4.6",
          },
          body: JSON.stringify({ requestedQuantity: 1 }),
        }),
        { params: Promise.resolve({ id: sixthListingId }) }
      );
      expect(res6.status).toBe(429);
      const json6 = await res6.json();
      expect(json6.message).toContain("maximum limit of 5 active purchase requests");
    });
  });

  describe("5. IDOR & Phone Privacy Guarantees", () => {
    let testListingId: string;
    let requestId: string;

    beforeAll(async () => {
      testListingId = await createTestListing({
        sellerId,
        title: `Privacy Item ${suffix}`,
        price: 10000,
        quantityAvailable: 5,
      });

      const res = await createRequestHandler(
        new NextRequest(`http://localhost:3000/api/listings/${testListingId}/requests`, {
          method: "POST",
          headers: {
            cookie: buyer1Cookie,
            "content-type": "application/json",
            "x-vercel-forwarded-for": "10.45.5.1",
          },
          body: JSON.stringify({ requestedQuantity: 1 }),
        }),
        { params: Promise.resolve({ id: testListingId }) }
      );
      const json = await res.json();
      requestId = json.request.id;
    });

    it("prevents unrelated buyers from viewing request details (403 Forbidden)", async () => {
      const getRes = await getRequestHandler(
        new NextRequest(`http://localhost:3000/api/requests/${requestId}`, {
          headers: { cookie: buyer2Cookie },
        }),
        { params: Promise.resolve({ id: requestId }) }
      );
      expect(getRes.status).toBe(403);
    });

    it("never shows the buyer's phone number to the seller via GET /api/requests/:id", async () => {
      const getRes = await getRequestHandler(
        new NextRequest(`http://localhost:3000/api/requests/${requestId}`, {
          headers: { cookie: sellerCookie },
        }),
        { params: Promise.resolve({ id: requestId }) }
      );
      expect(getRes.status).toBe(200);
      const json = await getRes.json();
      expect(json.buyerPhone).toBeUndefined();
      expect(JSON.stringify(json)).not.toContain(buyer1Phone);
    });

    it("seller's phone number is only present in the wa.me link to the authenticated buyer", async () => {
      const getRes = await getRequestHandler(
        new NextRequest(`http://localhost:3000/api/requests/${requestId}`, {
          headers: { cookie: buyer1Cookie },
        }),
        { params: Promise.resolve({ id: requestId }) }
      );
      expect(getRes.status).toBe(200);
      const json = await getRes.json();
      expect(json.whatsappUrl).toBeDefined();
      expect(json.whatsappUrl).toContain("2348031111111");
    });

    it("allows buyer to cancel their own request and updates reservation inventory", async () => {
      const cancelRes = await cancelRequestHandler(
        new NextRequest(`http://localhost:3000/api/requests/${requestId}/cancel`, {
          method: "POST",
          headers: {
            cookie: buyer1Cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ reason: "Found another item on campus" }),
        }),
        { params: Promise.resolve({ id: requestId }) }
      );
      expect(cancelRes.status).toBe(200);
      const cancelJson = await cancelRes.json();
      expect(cancelJson.status).toBe("cancelled");
      expect(cancelJson.cancelledBy).toBe("buyer");

      // Verify DB reflects cancellation
      const [reqDb] = await db
        .select()
        .from(purchaseRequest)
        .where(eq(purchaseRequest.id, requestId))
        .limit(1);
      expect(reqDb.status).toBe("cancelled");
      expect(reqDb.cancelledBy).toBe("buyer");
    });
  });

  describe("6. Offer Bounds & Negotiations", () => {
    it("rejects offers on non-negotiable listings", async () => {
      const nonNegListingId = await createTestListing({
        sellerId,
        title: `Firm Price Calculator ${suffix}`,
        price: 20000,
        quantityAvailable: 2,
        isNegotiable: false,
      });

      const res = await createRequestHandler(
        new NextRequest(`http://localhost:3000/api/listings/${nonNegListingId}/requests`, {
          method: "POST",
          headers: {
            cookie: buyer1Cookie,
            "content-type": "application/json",
            "x-vercel-forwarded-for": "10.45.6.1",
          },
          body: JSON.stringify({ offerPrice: 15000 }),
        }),
        { params: Promise.resolve({ id: nonNegListingId }) }
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toContain("price is non-negotiable");
    });

    it("enforces offer bounds (10% to 100% of price) on negotiable listings", async () => {
      const negListingId = await createTestListing({
        sellerId,
        title: `Negotiable Jacket ${suffix}`,
        price: 10000,
        quantityAvailable: 2,
        isNegotiable: true,
      });

      // Too low (< 10%)
      const lowRes = await createRequestHandler(
        new NextRequest(`http://localhost:3000/api/listings/${negListingId}/requests`, {
          method: "POST",
          headers: {
            cookie: buyer1Cookie,
            "content-type": "application/json",
            "x-vercel-forwarded-for": "10.45.6.2",
          },
          body: JSON.stringify({ offerPrice: 500 }),
        }),
        { params: Promise.resolve({ id: negListingId }) }
      );
      expect(lowRes.status).toBe(400);
      expect((await lowRes.json()).message).toContain("between 10% and 100%");

      // Too high (> 100%)
      const highRes = await createRequestHandler(
        new NextRequest(`http://localhost:3000/api/listings/${negListingId}/requests`, {
          method: "POST",
          headers: {
            cookie: buyer1Cookie,
            "content-type": "application/json",
            "x-vercel-forwarded-for": "10.45.6.3",
          },
          body: JSON.stringify({ offerPrice: 15000 }),
        }),
        { params: Promise.resolve({ id: negListingId }) }
      );
      expect(highRes.status).toBe(400);
      expect((await highRes.json()).message).toContain("between 10% and 100%");

      // Valid offer within bounds
      const validRes = await createRequestHandler(
        new NextRequest(`http://localhost:3000/api/listings/${negListingId}/requests`, {
          method: "POST",
          headers: {
            cookie: buyer1Cookie,
            "content-type": "application/json",
            "x-vercel-forwarded-for": "10.45.6.4",
          },
          body: JSON.stringify({ offerPrice: 7500 }),
        }),
        { params: Promise.resolve({ id: negListingId }) }
      );
      expect(validRes.status).toBe(201);
      const validJson = await validRes.json();
      expect(validJson.request.offerPrice).toBe(7500);
      expect(validJson.whatsappUrl).toContain("%E2%82%A67%2C500");
    });
  });

  describe("7. Archiving Listing with Live Requests", () => {
    it("cancels live requests with cancelled_by='system' and sends notifications to buyers", async () => {
      const archListingId = await createTestListing({
        sellerId,
        title: `Archive Test Mattress ${suffix}`,
        price: 30000,
        quantityAvailable: 2,
      });

      // Buyer 1 submits request
      const reqRes = await createRequestHandler(
        new NextRequest(`http://localhost:3000/api/listings/${archListingId}/requests`, {
          method: "POST",
          headers: {
            cookie: buyer1Cookie,
            "content-type": "application/json",
            "x-vercel-forwarded-for": "10.45.7.1",
          },
          body: JSON.stringify({ requestedQuantity: 1 }),
        }),
        { params: Promise.resolve({ id: archListingId }) }
      );
      expect(reqRes.status).toBe(201);
      const { request } = await reqRes.json();

      // Seller archives listing
      await listingService.archiveListing(sellerId, archListingId);

      // Verify request is cancelled with cancelled_by = 'system'
      const [reqDb] = await db
        .select()
        .from(purchaseRequest)
        .where(eq(purchaseRequest.id, request.id))
        .limit(1);
      expect(reqDb.status).toBe("cancelled");
      expect(reqDb.cancelledBy).toBe("system");

      // Verify buyer received in-app notification
      const [notif] = await db
        .select()
        .from(notification)
        .where(
          and(
            eq(notification.userId, buyer1Id),
            eq(notification.type, "purchase_request_cancelled")
          )
        )
        .orderBy(sql`${notification.createdAt} DESC`)
        .limit(1);
      expect(notif).toBeDefined();
      expect(notif.payload).toContain("Listing was archived by seller.");
    });
  });

  describe("8. Scheduled Sweeper & Cron Auth", () => {
    it("rejects unauthorized calls without CRON_SECRET with HTTP 401", async () => {
      const res = await cronExpireHandler(
        new NextRequest("http://localhost:3000/api/cron/expire-requests")
      );
      expect(res.status).toBe(401);

      const wrongSecretRes = await cronExpireHandler(
        new NextRequest("http://localhost:3000/api/cron/expire-requests", {
          headers: {
            Authorization: "Bearer wrong-secret",
          },
        })
      );
      expect(wrongSecretRes.status).toBe(401);
    });

    it("accepts authorized calls with Bearer CRON_SECRET and sweeps expired resolution deadlines", async () => {
      const res = await cronExpireHandler(
        new NextRequest("http://localhost:3000/api/cron/expire-requests", {
          headers: {
            Authorization: "Bearer test-cron-secret-step07",
          },
        })
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(typeof json.expiredCount).toBe("number");
    });
  });
});
