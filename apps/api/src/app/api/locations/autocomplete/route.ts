import { NextRequest, NextResponse } from "next/server";
import { autocompleteLocations } from "../../../../services/taxonomy.service";
import { checkRateLimit, getClientIp } from "../../../../services/rate-limit.service";
import { LocationAutocompleteQuerySchema } from "@downtown/validation";

/**
 * GET /api/locations/autocomplete?q=...&campusId=...
 *
 * Purely public autocomplete location search powered by pg_trgm and prefix matching.
 * - Rate limited per client IP (60 requests per minute) with fail-closed fallback for unresolvable IPs.
 * - Queries strictly curated locations (`isCurated = true`).
 * - Fully edge-cacheable: public, max-age=60, s-maxage=300, stale-while-revalidate=86400.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. IP-based rate limiting (60 requests/minute per client IP)
    const clientIp = getClientIp(req.headers);
    const rlKey = `location_autocomplete:${clientIp}`;
    const rlResult = await checkRateLimit(rlKey, 60, 60 * 1000);

    if (!rlResult.success) {
      const retryAfter = Math.max(1, Math.ceil((rlResult.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { message: "Too many location search requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
          },
        }
      );
    }

    // 2. Validate query params
    const { searchParams } = new URL(req.url);
    const rawQ = searchParams.get("q") ?? undefined;
    const rawCampusId = searchParams.get("campusId") ?? undefined;

    const parsedQuery = LocationAutocompleteQuerySchema.safeParse({
      q: rawQ,
      campusId: rawCampusId,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { message: parsedQuery.error.issues[0]?.message || "Invalid query parameters" },
        { status: 400 }
      );
    }

    // 3. Autocomplete public curated locations
    const locations = await autocompleteLocations(parsedQuery.data);

    // 4. Return edge-cached response
    return NextResponse.json(locations, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Failed to autocomplete locations:", error);
    return NextResponse.json(
      { message: "Failed to autocomplete locations" },
      { status: 500 }
    );
  }
}
