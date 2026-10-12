import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "../../../services/auth-guard";
import { listingService, ApiError } from "../../../services/listing.service";
import { searchService } from "../../../services/search.service";
import { checkRateLimit, getClientIp } from "../../../services/rate-limit.service";
import { DraftListingSchema, SearchQuerySchema } from "@downtown/validation";

/**
 * GET /api/listings
 *
 * Public discovery feed and marketplace search endpoint.
 * - Validates query params using SearchQuerySchema.
 * - Rate limited per client IP (60 requests per minute) with fail-closed fallback.
 * - Strictly privacy-safe (zero seller PII exposed in PublicListingCard).
 * - Edge cached: public, s-maxage=60, stale-while-revalidate=120.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. IP rate limiting (60 requests/min per client IP)
    const clientIp = getClientIp(req.headers);
    const rlKey = `listings_search:${clientIp}`;
    const rlResult = await checkRateLimit(rlKey, 60, 60 * 1000);

    if (!rlResult.success) {
      const retryAfter = Math.max(1, Math.ceil((rlResult.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { message: "Too many search requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
          },
        }
      );
    }

    // 2. Parse and validate query parameters
    const { searchParams } = new URL(req.url);
    const rawParams = {
      q: searchParams.get("q") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      minPrice: searchParams.get("minPrice") ?? undefined,
      maxPrice: searchParams.get("maxPrice") ?? undefined,
      condition: searchParams.get("condition") ?? undefined,
      locationId: searchParams.get("locationId") ?? undefined,
      campusId: searchParams.get("campusId") ?? undefined,
      verifiedOnly: searchParams.get("verifiedOnly") ?? undefined,
      availability: searchParams.get("availability") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    };

    const parsed = SearchQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Invalid search query parameters";
      return NextResponse.json({ message: msg }, { status: 400 });
    }

    // Optional viewer campus for proximity boost
    const viewerCampusId = searchParams.get("viewerCampusId") ?? undefined;

    // 3. Execute search
    const results = await searchService.search(parsed.data, viewerCampusId);

    // 4. Return edge cached response
    return NextResponse.json(results, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Failed to query listings:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/listings
 *
 * Creates or saves a draft listing.
 * - Requires active session, verified email, active account, and canSell (sellerStatus === "verified").
 * - Validates input using DraftListingSchema.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeUser(req, { requireCanSell: true });
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json().catch(() => ({}));
    const parsed = DraftListingSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Invalid draft listing payload";
      return NextResponse.json({ message: msg }, { status: 400 });
    }

    const created = await listingService.createDraft(auth.user.id, parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to create draft listing:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
