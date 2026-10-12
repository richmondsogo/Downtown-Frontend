import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "../../../../services/auth-guard";
import { savedService } from "../../../../services/saved.service";
import { ApiError } from "../../../../services/listing.service";

/**
 * GET /api/listings/saved
 *
 * Retrieves all saved listings for the current authenticated user.
 * - Requires active session.
 * - Cache-Control: private, no-cache, no-store, must-revalidate.
 * - Preserves sold status: sold items are included so UI can render them greyed out.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeUser(req, { requireCanSell: false });
    if (auth.errorResponse) return auth.errorResponse;

    const items = await savedService.getSavedListings(auth.user.id);

    return NextResponse.json(
      { items },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to fetch saved listings:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
