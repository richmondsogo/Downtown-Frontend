import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "../../../../services/auth-guard";
import { listingService, ApiError } from "../../../../services/listing.service";
import { UpdateListingSchema } from "@downtown/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/listings/:id
 *
 * Owner-only private read in Step 04. IDOR protected.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await authorizeUser(req, { requireCanSell: false });
    if (auth.errorResponse) return auth.errorResponse;

    const item = await listingService.getListingById(auth.user.id, id);
    return NextResponse.json(item, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to get listing by ID:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/listings/:id
 *
 * Updates an owned listing. Requires canSell. Re-evaluates moderation on high-risk edits if published.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await authorizeUser(req, { requireCanSell: true });
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json().catch(() => ({}));
    const parsed = UpdateListingSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Invalid update payload";
      return NextResponse.json({ message: msg }, { status: 400 });
    }

    const updated = await listingService.updateListing(auth.user.id, id, parsed.data);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to update listing:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/listings/:id
 *
 * Deletes a draft listing owned by the seller.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await authorizeUser(req, { requireCanSell: true });
    if (auth.errorResponse) return auth.errorResponse;

    await listingService.deleteDraft(auth.user.id, id);
    return NextResponse.json({ success: true, message: "Draft deleted successfully" }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to delete draft listing:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
