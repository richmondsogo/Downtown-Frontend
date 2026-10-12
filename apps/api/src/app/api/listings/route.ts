import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "../../../services/auth-guard";
import { listingService, ApiError } from "../../../services/listing.service";
import { DraftListingSchema } from "@downtown/validation";

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
