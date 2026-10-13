import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "../../../services/auth-guard";
import { purchaseRequestService } from "../../../services/purchase-request.service";
import { ApiError } from "../../../services/listing.service";

/**
 * GET /api/requests
 *
 * Query params:
 * ?type=buying (default) - lists requests created by the buyer
 * ?type=selling - lists requests received by the seller
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeUser(req);
    if (auth.errorResponse) return auth.errorResponse;

    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "buying";
    const origin = req.headers.get("origin") || req.nextUrl.origin;

    if (type === "selling") {
      const requests = await purchaseRequestService.getSellerRequests(auth.user.id);
      return NextResponse.json({ requests }, { status: 200 });
    } else {
      const requests = await purchaseRequestService.getBuyerRequests(auth.user.id, origin);
      return NextResponse.json({ requests }, { status: 200 });
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to list purchase requests:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
