import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { auth } from "../services/auth.service";
import { db } from "../db/index";
import { user } from "../db/schema";
import { eq, like } from "drizzle-orm";

describe("Better Auth & Security Integration Tests", { timeout: 25000 }, () => {
  const uniqueId = Date.now().toString().slice(-6);
  const testStudentEmail = `student_${uniqueId}@example.com`;
  const testStaffEmail = `staff_${uniqueId}@example.com`;
  const testVendorEmail = `vendor_${uniqueId}@example.com`;
  const password = "ValidPassword123!";

  it("1. Successfully registers a student with normalized matric number and default sellerStatus", async () => {
    const req = new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `10.10.1.${uniqueId.slice(-2)}`,
      },
      body: JSON.stringify({
        role: "student",
        name: "Test Student",
        email: testStudentEmail,
        matricNumber: " 2024 - 9999 ",
        password,
      }),
    });

    const res = await auth.handler(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(testStudentEmail);
    expect(data.user.role).toBe("student");
    expect(data.user.matricNumber).toBe("2024/9999");
    expect(data.user.sellerStatus).toBe("not_a_seller");

    // Verify in database
    const dbUsers = await db
      .select()
      .from(user)
      .where(eq(user.email, testStudentEmail))
      .limit(1);
    expect(dbUsers.length).toBe(1);
    expect(dbUsers[0].matricNumber).toBe("2024/9999");
    expect(dbUsers[0].sellerStatus).toBe("not_a_seller");
  });

  it("2. Successfully registers a staff member without matric number", async () => {
    const req = new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `10.10.2.${uniqueId.slice(-2)}`,
      },
      body: JSON.stringify({
        role: "staff",
        name: "Test Staff",
        email: testStaffEmail,
        password,
      }),
    });

    const res = await auth.handler(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.user.role).toBe("staff");
  });

  it("3. Successfully registers a vendor without matric number", async () => {
    const req = new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `10.10.3.${uniqueId.slice(-2)}`,
      },
      body: JSON.stringify({
        role: "vendor",
        name: "Campus Stores",
        email: testVendorEmail,
        password,
      }),
    });

    const res = await auth.handler(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.user.role).toBe("vendor");
  });

  it("4. STRICTLY REJECTS signup attempt with role='admin'", async () => {
    const req = new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `10.10.4.${uniqueId.slice(-2)}`,
      },
      body: JSON.stringify({
        role: "admin",
        name: "Admin Attacker",
        email: `hacker_${uniqueId}@example.com`,
        password,
      }),
    });

    const res = await auth.handler(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.message).toBeDefined();

    // Verify hacker was NOT created in DB
    const dbHacker = await db
      .select()
      .from(user)
      .where(eq(user.email, `hacker_${uniqueId}@example.com`));
    expect(dbHacker.length).toBe(0);
  });

  it("5. DB CHECK constraint prevents inserting role='admin' into user table directly", async () => {
    await expect(
      db.insert(user).values({
        id: `direct-admin-${uniqueId}`,
        name: "Direct Admin Attack",
        email: `direct_admin_${uniqueId}@example.com`,
        role: "admin" as any, // Bypass TS to test DB constraint
      })
    ).rejects.toThrow();
  });

  it("6. Rejects client attempt to tamper with sellerStatus and accountStatus at signup (input: false)", async () => {
    const email = `tamper_${uniqueId}@example.com`;
    const req = new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `10.10.5.${uniqueId.slice(-2)}`,
      },
      body: JSON.stringify({
        role: "student",
        name: "Tamper Student",
        email,
        matricNumber: "2024/0001",
        password,
        sellerStatus: "verified", // Malicious attempt to self-verify
        accountStatus: "banned", // Malicious attempt to tamper account status
      }),
    });

    const res = await auth.handler(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    // Must remain "not_a_seller" and "active"
    expect(data.user.sellerStatus).toBe("not_a_seller");
    expect(data.user.accountStatus).toBe("active");

    const dbUser = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    expect(dbUser[0].sellerStatus).toBe("not_a_seller");
    expect(dbUser[0].accountStatus).toBe("active");
  });

  it("7. STRICTLY REJECTS student signup with UNIOSUN/ prefix", async () => {
    const req = new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `10.10.5.99`,
      },
      body: JSON.stringify({
        role: "student",
        name: "Prefix Student",
        email: `prefix_${uniqueId}@gmail.com`,
        matricNumber: "UNIOSUN/2024/0001",
        password,
      }),
    });

    const res = await auth.handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("Do not include the 'UNIOSUN/' prefix");
  });

  it("8. STRICTLY REJECTS student signup without matric number (confirms SignUpSchema runs in the hook)", async () => {
    const req = new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `10.10.6.${uniqueId.slice(-2)}`,
      },
      body: JSON.stringify({
        role: "student",
        name: "Student Without Matric",
        email: `no_matric_${uniqueId}@example.com`,
        password,
      }),
    });

    const res = await auth.handler(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.message).toBeDefined();
    expect(data.message.toLowerCase()).toContain("matric");
  });

  describe("Anti-Enumeration Protections", () => {
    it("returns identical status and message for unknown email vs wrong password on sign-in", async () => {
      // 1. Wrong password on known user
      const reqKnown = new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.100.1",
        },
        body: JSON.stringify({
          email: testStudentEmail,
          password: "WrongPassword999!",
        }),
      });
      const resKnown = await auth.handler(reqKnown);
      const dataKnown = await resKnown.json();

      // 2. Unknown user
      const reqUnknown = new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.100.2",
        },
        body: JSON.stringify({
          email: `nonexistent_${uniqueId}@example.com`,
          password: "RandomPassword999!",
        }),
      });
      const resUnknown = await auth.handler(reqUnknown);
      const dataUnknown = await resUnknown.json();

      expect(resKnown.status).toBe(resUnknown.status);
      expect(dataKnown.message).toBe(dataUnknown.message);
    }, 45000);

    it("returns identical status for password reset on known vs unknown email", async () => {
      // 1. Known email
      const reqKnown = new Request("http://localhost:3000/api/auth/request-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.101.1",
        },
        body: JSON.stringify({
          email: testStudentEmail,
          redirectTo: "/reset-password",
        }),
      });
      const resKnown = await auth.handler(reqKnown);

      // 2. Unknown email
      const reqUnknown = new Request("http://localhost:3000/api/auth/request-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.101.2",
        },
        body: JSON.stringify({
          email: `completely_random_${uniqueId}@example.com`,
          redirectTo: "/reset-password",
        }),
      });
      const resUnknown = await auth.handler(reqUnknown);

      expect(resKnown.status).toBe(resUnknown.status);
      expect(resKnown.status).toBe(200);
    });
  });

  describe("Rate Limiting & Proxy IP Buckets", () => {
    it(
      "keys rate limits on real client IP and separates different IP buckets",
      async () => {
        const targetPath = "http://localhost:3000/api/auth/sign-in/email";
      const ipA = "172.16.0.10";
      const ipB = "172.16.0.20";

      // Exhaust IP A's limit (configured limit: 5 requests per 60s for /sign-in/email)
      let ipALimited = false;
      for (let i = 0; i < 7; i++) {
        const reqA = new Request(targetPath, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ipA,
          },
          body: JSON.stringify({
            email: `ratelimit_${i}@example.com`,
            password: "WrongPassword123!",
          }),
        });
        const resA = await auth.handler(reqA);
        if (resA.status === 429) {
          ipALimited = true;
          break;
        }
      }

      expect(ipALimited).toBe(true);

      // Verify that IP B still has fresh bucket and is NOT rate limited
      const reqB = new Request(targetPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": ipB,
        },
        body: JSON.stringify({
          email: "ipb_test@example.com",
          password: "WrongPassword123!",
        }),
      });
      const resB = await auth.handler(reqB);
      expect(resB.status).not.toBe(429);
    }, 25000);

    it("fails closed when client IP is missing or unresolvable by enforcing the shared fallback bucket", async () => {
      // In Better Auth, missing or invalid IP falls back to `no-trusted-ip` (or 127.0.0.1 in test mode).
      // Requests without a valid unique IP header share this bucket and are throttled after max attempts.
      const targetPath = "http://localhost:3000/api/auth/sign-in/email";
      let hitLimit = false;
      for (let i = 0; i < 7; i++) {
        const req = new Request(targetPath, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Multi-hop untrusted proxy chain without trustedProxies configured resolves to null
            "x-forwarded-for": "10.0.0.1, 10.0.0.2",
          },
          body: JSON.stringify({
            email: `null_ip_${i}_${uniqueId}@example.com`,
            password: "WrongPassword123!",
          }),
        });
        const res = await auth.handler(req);
        if (res.status === 429) {
          hitLimit = true;
          break;
        }
      }
      expect(hitLimit).toBe(true);
    }, 25000);
  });

  afterAll(async () => {
    // Clean up only rows created during this test run (isolation for shared dev DB)
    await db.delete(user).where(like(user.email, `%${uniqueId}%`));
  });
});
