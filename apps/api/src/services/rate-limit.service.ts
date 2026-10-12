import { db } from "../db/index";
import { appRateLimit } from "../db/schema";
import { sql } from "drizzle-orm";

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Prefix for all custom application rate limit buckets.
 * Guarantees namespace isolation from Better Auth or external tables.
 */
export const APP_RATE_LIMIT_PREFIX = "app_rl:";

/**
 * Resolves client IP strictly from platform header x-vercel-forwarded-for with fail-closed fallback.
 * Prohibits cf-connecting-ip, x-real-ip, and client-set x-forwarded-for headers.
 */
export function getClientIp(headers: Headers): string {
  const vercelIp = headers.get("x-vercel-forwarded-for");
  if (vercelIp && vercelIp.trim()) {
    const firstIp = vercelIp.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  // Fail-closed fallback: unresolvable IP falls into shared constrained bucket
  return "no-trusted-ip";
}

/**
 * Atomic sliding window rate limiter backed strictly by the dedicated app_rate_limit table.
 * Uses atomic PostgreSQL INSERT ... ON CONFLICT DO UPDATE RETURNING for zero-race concurrency.
 *
 * @param rawKey Unique key for the rate limit bucket (e.g. `location_create:${userId}`)
 * @param limit Max requests allowed within the window
 * @param windowMs Window duration in milliseconds
 */
export async function checkRateLimit(
  rawKey: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const key = rawKey.startsWith(APP_RATE_LIMIT_PREFIX)
    ? rawKey
    : `${APP_RATE_LIMIT_PREFIX}${rawKey}`;

  const now = Date.now();
  const newId = "rl_" + Math.random().toString(36).substring(2, 10);

  const res = await db
    .insert(appRateLimit)
    .values({
      id: newId,
      key,
      count: 1,
      lastRequest: now,
    })
    .onConflictDoUpdate({
      target: appRateLimit.key,
      set: {
        count: sql<number>`CASE 
          WHEN (${now} - ${appRateLimit.lastRequest}) > ${windowMs} THEN 1 
          ELSE ${appRateLimit.count} + 1 
        END`,
        lastRequest: sql<number>`CASE 
          WHEN (${now} - ${appRateLimit.lastRequest}) > ${windowMs} THEN ${now} 
          ELSE ${appRateLimit.lastRequest} 
        END`,
      },
    })
    .returning({
      count: appRateLimit.count,
      lastRequest: appRateLimit.lastRequest,
    });

  const record = res[0];
  const count = Number(record.count);
  const lastRequest = Number(record.lastRequest);

  if (count > limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: lastRequest + windowMs,
    };
  }

  return {
    success: true,
    remaining: Math.max(0, limit - count),
    resetAt: lastRequest + windowMs,
  };
}
