import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "../../../../../services/auth-guard";
import { purchaseRequestService } from "../../../../../services/purchase-request.service";
import { CancelPurchaseRequestSchema } from "@downtown/validation";
import { ApiError } from "../../../../../services/listing.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/requests/:id/cancel
 *
 * Cancels a pending purchase request.
 * Buyer can cancel their own request.
 * Seller can cancel/release any pending request on their listing.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: requestId } = await params;
    const auth = await authorizeUser(req);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json().catch(() => ({}));
    const parsed = CancelPurchaseRequestSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Invalid cancellation payload";
      return NextResponse.json({ message: msg }, { status: 400 });
    }

    const result = await purchaseRequestService.cancelRequest(
      auth.user.id,
      requestId,
      parsed.data.reason
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to cancel purchase request:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
