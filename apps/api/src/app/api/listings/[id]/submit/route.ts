import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "../../../../../services/auth-guard";
import { listingService, ApiError } from "../../../../../services/listing.service";
import { SubmitListingSchema } from "@downtown/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/listings/:id/submit
 *
 * Submits a draft listing for review and publication.
 * - Requires active session, email verified, active account, and canSell.
 * - Validates complete submission requirements.
 * - Scans content against prohibited terms list.
 * - Clean -> published (auto).
 * - Flagged -> stays pending_moderation with moderation record.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await authorizeUser(req, { requireCanSell: true });
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json().catch(() => undefined);
    let validatedInput;
    if (body) {
      const parsed = SubmitListingSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message || "Validation failed";
        return NextResponse.json({ message: msg }, { status: 400 });
      }
      validatedInput = parsed.data;
    }

    const submitted = await listingService.submitListing(auth.user.id, id, validatedInput);
    return NextResponse.json(submitted, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to submit listing:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
