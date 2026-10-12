import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "../../../../services/auth-guard";
import { listingService, ApiError } from "../../../../services/listing.service";

/**
 * GET /api/listings/mine
 *
 * Retrieves the current seller's own listings.
 * - Requires active session, verified email, and active account.
 * - Cache-Control: private, no-cache, no-store, must-revalidate.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeUser(req, { requireCanSell: false });
    if (auth.errorResponse) return auth.errorResponse;

    const listings = await listingService.getMyListings(auth.user.id);
    return NextResponse.json(listings, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to fetch seller listings:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
