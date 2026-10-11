import { NextRequest, NextResponse } from "next/server";
import { autocompleteLocations } from "../../../../services/taxonomy.service";
import { auth } from "../../../../services/auth.service";
import { LocationAutocompleteQuerySchema } from "@downtown/validation";

/**
 * GET /api/locations/autocomplete?q=...&campusId=...
 *
 * Autocomplete location search powered by pg_trgm and prefix matching.
 * - Public callers see only curated locations (`isCurated = true`).
 * - Authenticated callers also see their own unpromoted custom submissions (`creatorId = currentUserId`).
 * - Curated results ranked first, limit 8, minimal payload.
 */
export async function GET(req: NextRequest) {
  try {
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

    // Check optional authenticated user session
    let currentUserId: string | undefined = undefined;
    try {
      const session = await auth.api.getSession({ headers: req.headers });
      if (session?.user?.id) {
        currentUserId = session.user.id;
      }
    } catch {
      // Unauthenticated caller, proceed with public visibility
    }

    const locations = await autocompleteLocations(parsedQuery.data, currentUserId);

    // Dynamic cache headers: public search is edge-cached; personalized user searches are private
    const cacheHeader = currentUserId
      ? "private, no-cache, no-store, must-revalidate"
      : "public, max-age=10, s-maxage=60, stale-while-revalidate=300";

    return NextResponse.json(locations, {
      status: 200,
      headers: {
        "Cache-Control": cacheHeader,
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
