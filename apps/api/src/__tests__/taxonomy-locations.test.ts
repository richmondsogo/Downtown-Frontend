import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCategoriesHandler } from "../app/api/categories/route";
import { GET as getCampusesHandler } from "../app/api/campuses/route";
import { GET as autocompleteHandler } from "../app/api/locations/autocomplete/route";
import { GET as getMyLocationsHandler } from "../app/api/locations/mine/route";
import { POST as createLocationHandler } from "../app/api/locations/route";
import { seedTaxonomyAndLocations } from "../db/seeds/taxonomy-locations";
import { pool, db } from "../db/index";
import { location, user } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "../services/auth.service";

describe("Taxonomy & Locations Integration Suite", () => {
  const uniqueSuffix = Math.floor(Math.random() * 100000);
  const testUserEmail = `creator_${uniqueSuffix}@example.com`;
  let testUserId: string;
  let testSessionCookie: string;
  let osogboCampusId: string;

  beforeAll(async () => {
    // 1. Ensure reference seeds are present if not already in DB
    const [existingLoc] = await db.select({ id: location.id }).from(location).limit(1);
    if (!existingLoc) {
      await seedTaxonomyAndLocations();
    }

    // 2. Fetch Osogbo campus id
    const campusesRes = await getCampusesHandler();
    const campuses = await campusesRes.json();
    const osogbo = campuses.find((c: any) => c.slug === "osogbo");
    osogboCampusId = osogbo.id;

    // 3. Register a test user for authenticated custom location tests
    const signUpReq = new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        "x-vercel-forwarded-for": `10.88.77.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        name: "Location Creator",
        email: testUserEmail,
        password: "StrongPassword123!",
        role: "student",
        matricNumber: "2024/77889",
      }),
    });
    const signUpRes = await auth.handler(signUpReq);
    expect([200, 201]).toContain(signUpRes.status);

    // Fetch user id from database
    const userRecord = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, testUserEmail))
      .limit(1);
    testUserId = userRecord[0].id;

    // Verify email directly in DB to allow sign-in
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, testUserId));

    // Sign in to retrieve session cookie
    const signInReq = new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        email: testUserEmail,
        password: "StrongPassword123!",
      }),
    });
    const signInRes = await auth.handler(signInReq);
    expect(signInRes.status).toBe(200);

    const setCookie = signInRes.headers.get("set-cookie") || "";
    testSessionCookie = setCookie.split(";")[0];
  }, 45000);

  afterAll(async () => {
    // Clean up test locations and user
    if (testUserId) {
      await db.delete(location).where(eq(location.creatorId, testUserId));
      await db.delete(user).where(eq(user.id, testUserId));
    }
  });

  describe("Categories (`GET /api/categories`)", () => {
    it("returns active categories matching GOAL.md 5.3 with public edge cache headers", async () => {
      const res = await getCategoriesHandler();
      expect(res.status).toBe(200);

      const cacheControl = res.headers.get("Cache-Control");
      expect(cacheControl).toContain("public");
      expect(cacheControl).toContain("s-maxage=86400");
      expect(cacheControl).toContain("stale-while-revalidate=604800");

      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(9);

      const slugs = data.map((c: any) => c.slug);
      expect(slugs).toEqual([
        "electronics",
        "fashion-accessories",
        "food-drinks",
        "home-living",
        "books-study-materials",
        "beauty-personal-care",
        "services",
        "tickets-events",
        "other",
      ]);

      // Check minimal payload structure
      const first = data[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("name");
      expect(first).toHaveProperty("slug");
      expect(first).toHaveProperty("displayOrder");
    });
  });

  describe("Campuses (`GET /api/campuses`)", () => {
    it("returns all 6 UNIOSUN campuses with edge cache headers", async () => {
      const res = await getCampusesHandler();
      expect(res.status).toBe(200);

      const cacheControl = res.headers.get("Cache-Control");
      expect(cacheControl).toContain("public");
      expect(cacheControl).toContain("s-maxage=86400");

      const data = await res.json();
      expect(data.length).toBe(6);

      const slugs = data.map((c: any) => c.slug).sort();
      expect(slugs).toEqual([
        "ejigbo",
        "ifetedo",
        "ikire",
        "ipetu-ijesha",
        "okuku",
        "osogbo",
      ]);
    });
  });

  describe("Location Autocomplete (`GET /api/locations/autocomplete`)", () => {
    it("returns curated locations matching prefix with minimal payload and public edge cache headers", async () => {
      const req = new NextRequest("http://localhost:3000/api/locations/autocomplete?q=Osogbo", {
        headers: {
          Origin: "http://localhost:3000",
        },
      });
      const res = await autocompleteHandler(req);
      expect(res.status).toBe(200);

      const cacheControl = res.headers.get("Cache-Control");
      expect(cacheControl).toContain("public");
      expect(cacheControl).toContain("s-maxage=300");

      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);

      const first = data[0];
      expect(first.name).toBe("Osogbo Campus");
      expect(first.type).toBe("campus");
      expect(first.isCurated).toBe(true);
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("campusId");
    });

    it("filters results by campusId", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/locations/autocomplete?campusId=${osogboCampusId}`,
        {
          headers: {
            Origin: "http://localhost:3000",
          },
        }
      );
      const res = await autocompleteHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.every((l: any) => l.campusId === osogboCampusId)).toBe(true);
    });

    it("rejects search queries exceeding 80 characters with 400", async () => {
      const longQuery = "a".repeat(85);
      const req = new NextRequest(`http://localhost:3000/api/locations/autocomplete?q=${longQuery}`);
      const res = await autocompleteHandler(req);
      expect(res.status).toBe(400);
    });
  });

  describe("Custom Location Creation (`POST /api/locations`)", () => {
    it("strictly rejects unauthenticated submissions with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          campusId: osogboCampusId,
          name: "Unauthenticated Lodge",
        }),
      });

      const res = await createLocationHandler(req);
      expect(res.status).toBe(401);
    });

    it("rejects custom location names containing phone numbers with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: testSessionCookie,
        },
        body: JSON.stringify({
          campusId: osogboCampusId,
          name: "Lodge Call 08031234567",
        }),
      });

      const res = await createLocationHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message.toLowerCase()).toContain("phone");
    });

    it("rejects custom location names containing URLs with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: testSessionCookie,
        },
        body: JSON.stringify({
          campusId: osogboCampusId,
          name: "Hostel at https://lodge.ng",
        }),
      });

      const res = await createLocationHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message.toLowerCase()).toContain("url");
    });

    it("creates custom uncurated location and returns 201", async () => {
      const customName = `Diamond Lodge ${uniqueSuffix}`;
      const req = new NextRequest("http://localhost:3000/api/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: testSessionCookie,
        },
        body: JSON.stringify({
          campusId: osogboCampusId,
          name: `  ${customName}  `,
        }),
      });

      const res = await createLocationHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.isDuplicate).toBe(false);
      expect(data.location.name).toBe(customName);
      expect(data.location.isCurated).toBe(false);
      expect(data.location.type).toBe("custom");

      // Verify /api/locations/mine: creator CAN see their custom location
      const myLocationsReq = new NextRequest(
        `http://localhost:3000/api/locations/mine?campusId=${osogboCampusId}`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );
      const myLocationsRes = await getMyLocationsHandler(myLocationsReq);
      expect(myLocationsRes.status).toBe(200);
      expect(myLocationsRes.headers.get("Cache-Control")).toContain("no-store");
      const myLocationsData = await myLocationsRes.json();
      expect(myLocationsData.some((l: any) => l.name === customName)).toBe(true);

      // Verify /api/locations/mine: unauthenticated caller gets 401
      const unauthReq = new NextRequest(
        `http://localhost:3000/api/locations/mine?campusId=${osogboCampusId}`
      );
      const unauthRes = await getMyLocationsHandler(unauthReq);
      expect(unauthRes.status).toBe(401);

      // Verify public autocomplete: purely public, does NOT include uncurated custom location
      const publicAutocompleteReq = new NextRequest(
        `http://localhost:3000/api/locations/autocomplete?q=${encodeURIComponent(customName)}`,
        {
          headers: {
            "x-vercel-forwarded-for": `192.0.2.${Math.floor(Math.random() * 200)}`,
          },
        }
      );
      const publicRes = await autocompleteHandler(publicAutocompleteReq);
      expect(publicRes.status).toBe(200);
      expect(publicRes.headers.get("Cache-Control")).toContain("public");
      const publicData = await publicRes.json();
      expect(publicData.some((l: any) => l.name === customName)).toBe(false);
    });

    it("handles duplicates gracefully by returning existing location with isDuplicate: true", async () => {
      const customName = `Duplicate Lodge ${uniqueSuffix}`;
      // 1. First submission
      const req1 = new NextRequest("http://localhost:3000/api/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: testSessionCookie,
        },
        body: JSON.stringify({
          campusId: osogboCampusId,
          name: customName,
        }),
      });
      const res1 = await createLocationHandler(req1);
      expect(res1.status).toBe(201);

      // 2. Second submission with case variations
      const req2 = new NextRequest("http://localhost:3000/api/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: testSessionCookie,
        },
        body: JSON.stringify({
          campusId: osogboCampusId,
          name: customName.toUpperCase(),
        }),
      });
      const res2 = await createLocationHandler(req2);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.isDuplicate).toBe(true);
    });

    it("enforces rate limit of 5 submissions per 10 minutes", async () => {
      let rateLimited = false;
      for (let i = 0; i < 7; i++) {
        const req = new NextRequest("http://localhost:3000/api/locations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: testSessionCookie,
          },
          body: JSON.stringify({
            campusId: osogboCampusId,
            name: `Flood Lodge ${uniqueSuffix} ${i}`,
          }),
        });
        const res = await createLocationHandler(req);
        if (res.status === 429) {
          rateLimited = true;
          break;
        }
      }
      expect(rateLimited).toBe(true);
    });

    it(
      "rate limits public GET /locations/autocomplete per client IP with fail-closed bucket isolation",
      async () => {
        const throttledIp = `203.0.113.${Math.floor(Math.random() * 200) + 10}`;

        // Fire 65 requests concurrently to test threshold and concurrency
        const requests = Array.from({ length: 65 }, () =>
          autocompleteHandler(
            new NextRequest(
              `http://localhost:3000/api/locations/autocomplete?q=Osogbo&campusId=${osogboCampusId}`,
              {
                headers: {
                  "x-vercel-forwarded-for": throttledIp,
                },
              }
            )
          )
        );

        const responses = await Promise.all(requests);
        const rateLimitedResponses = responses.filter((r) => r.status === 429);
        expect(rateLimitedResponses.length).toBeGreaterThanOrEqual(1);

        const first429 = rateLimitedResponses[0];
        expect(first429.headers.get("Retry-After")).toBeDefined();

        // Different IP should still succeed with 200 OK (per-IP isolation)
        const freshIp = `203.0.113.${Math.floor(Math.random() * 200) + 10}_fresh`;
        const freshReq = new NextRequest(
          `http://localhost:3000/api/locations/autocomplete?q=Osogbo&campusId=${osogboCampusId}`,
          {
            headers: {
              "x-vercel-forwarded-for": freshIp,
            },
          }
        );
        const freshRes = await autocompleteHandler(freshReq);
        expect(freshRes.status).toBe(200);
      },
      15000
    );
  });
});
