import { db } from "../db/index";
import { rateLimit } from "../db/schema";
import { eq } from "drizzle-orm";

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Atomic sliding window rate limiter backed by the PostgreSQL rate_limit table.
 *
 * @param key Unique key for the rate limit bucket (e.g. `location_create:${userId}`)
 * @param limit Max requests allowed within the window
 * @param windowMs Window duration in milliseconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();

  const existing = await db
    .select()
    .from(rateLimit)
    .where(eq(rateLimit.key, key))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(rateLimit).values({
      id: "rl_" + Math.random().toString(36).substring(2, 10),
      key,
      count: 1,
      lastRequest: now,
    });
    return {
      success: true,
      remaining: limit - 1,
      resetAt: now + windowMs,
    };
  }

  const record = existing[0];
  const elapsed = now - record.lastRequest;

  if (elapsed > windowMs) {
    // Window expired, reset bucket
    await db
      .update(rateLimit)
      .set({
        count: 1,
        lastRequest: now,
      })
      .where(eq(rateLimit.key, key));

    return {
      success: true,
      remaining: limit - 1,
      resetAt: now + windowMs,
    };
  }

  if (record.count >= limit) {
    // Exceeded
    return {
      success: false,
      remaining: 0,
      resetAt: record.lastRequest + windowMs,
    };
  }

  // Increment
  await db
    .update(rateLimit)
    .set({
      count: record.count + 1,
    })
    .where(eq(rateLimit.key, key));

  return {
    success: true,
    remaining: limit - (record.count + 1),
    resetAt: record.lastRequest + windowMs,
  };
}
