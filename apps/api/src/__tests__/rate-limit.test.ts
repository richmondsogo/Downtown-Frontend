import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../db/index";
import { rateLimit, appRateLimit } from "../db/schema";
import {
  checkRateLimit,
  getClientIp,
  APP_RATE_LIMIT_PREFIX,
} from "../services/rate-limit.service";
import { eq } from "drizzle-orm";

describe("Rate Limiter Storage Isolation & Non-Collision", () => {
  const testKey = `test_collision_key_${Date.now()}`;
  const betterAuthKey = testKey;
  const appKey = testKey;

  beforeEach(async () => {
    // Clean up any test keys
    await db.delete(rateLimit).where(eq(rateLimit.key, betterAuthKey));
    await db
      .delete(appRateLimit)
      .where(eq(appRateLimit.key, `${APP_RATE_LIMIT_PREFIX}${appKey}`));
  });

  it("ensures custom rate limiter never collides with Better Auth rate_limit table", async () => {
    // 1. Simulate Better Auth inserting a record into rate_limit table
    const initialBetterAuthCount = 3;
    const initialBetterAuthLastRequest = Date.now() - 5000;
    await db.insert(rateLimit).values({
      id: "ba_rl_" + Math.random().toString(36).substring(2, 8),
      key: betterAuthKey,
      count: initialBetterAuthCount,
      lastRequest: initialBetterAuthLastRequest,
    });

    // 2. Call custom checkRateLimit with the exact same key name
    const limitResult1 = await checkRateLimit(appKey, 5, 60000);
    expect(limitResult1.success).toBe(true);
    expect(limitResult1.remaining).toBe(4);

    // 3. Verify Better Auth's rate_limit table is completely untouched
    const baRecords = await db
      .select()
      .from(rateLimit)
      .where(eq(rateLimit.key, betterAuthKey));

    expect(baRecords.length).toBe(1);
    expect(baRecords[0].count).toBe(initialBetterAuthCount);
    expect(baRecords[0].lastRequest).toBe(initialBetterAuthLastRequest);

    // 4. Verify app_rate_limit table holds its own dedicated, namespaced record
    const appRecords = await db
      .select()
      .from(appRateLimit)
      .where(eq(appRateLimit.key, `${APP_RATE_LIMIT_PREFIX}${appKey}`));

    expect(appRecords.length).toBe(1);
    expect(appRecords[0].count).toBe(1);
    expect(appRecords[0].key).toBe(`app_rl:${appKey}`);

    // 5. Increment app rate limiter until blocked
    await checkRateLimit(appKey, 5, 60000);
    await checkRateLimit(appKey, 5, 60000);
    await checkRateLimit(appKey, 5, 60000);
    await checkRateLimit(appKey, 5, 60000);
    const blockedResult = await checkRateLimit(appKey, 5, 60000);
    expect(blockedResult.success).toBe(false);
    expect(blockedResult.remaining).toBe(0);

    // 6. Confirm Better Auth row is STILL untouched
    const baRecordsAfter = await db
      .select()
      .from(rateLimit)
      .where(eq(rateLimit.key, betterAuthKey));

    expect(baRecordsAfter[0].count).toBe(initialBetterAuthCount);
  });

  it("handles window expiration and sliding resets independently", async () => {
    const expireKey = `test_expire_${Date.now()}`;
    // Insert with expired timestamp (2 minutes ago for a 1 minute window)
    const twoMinutesAgo = Date.now() - 120000;
    await db.insert(appRateLimit).values({
      id: "rl_exp_" + Math.random().toString(36).substring(2, 8),
      key: `app_rl:${expireKey}`,
      count: 10,
      lastRequest: twoMinutesAgo,
    });

    // Check rate limit: should reset count to 1 and grant access
    const res = await checkRateLimit(expireKey, 5, 60000);
    expect(res.success).toBe(true);
    expect(res.remaining).toBe(4);

    const updated = await db
      .select()
      .from(appRateLimit)
      .where(eq(appRateLimit.key, `app_rl:${expireKey}`));
    expect(updated[0].count).toBe(1);
  });
});

describe("Client IP Resolution & Fail-Closed Behavior", () => {
  it("prefers x-vercel-forwarded-for header from edge proxy", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "102.221.89.122",
      "x-real-ip": "203.0.113.1",
      "x-forwarded-for": "198.51.100.2",
    });
    expect(getClientIp(headers)).toBe("102.221.89.122");
  });

  it("falls back to x-real-ip if x-vercel-forwarded-for is missing", () => {
    const headers = new Headers({
      "x-real-ip": "203.0.113.1",
      "x-forwarded-for": "198.51.100.2",
    });
    expect(getClientIp(headers)).toBe("203.0.113.1");
  });

  it("falls back to first IP in x-forwarded-for list", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.2, 10.0.0.1",
    });
    expect(getClientIp(headers)).toBe("198.51.100.2");
  });

  it("fails closed to no-trusted-ip bucket when headers are absent", () => {
    const headers = new Headers({});
    expect(getClientIp(headers)).toBe("no-trusted-ip");
  });
});
