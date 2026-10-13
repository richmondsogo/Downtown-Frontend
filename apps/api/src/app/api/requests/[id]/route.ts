import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "../../../../services/auth-guard";
import { purchaseRequestService } from "../../../../services/purchase-request.service";
import { ApiError } from "../../../../services/listing.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/requests/:id
 *
 * Retrieves purchase request details with strict IDOR protection.
 * Only the buyer or seller can view this request.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: requestId } = await params;
    const auth = await authorizeUser(req);
    if (auth.errorResponse) return auth.errorResponse;

    const origin = req.headers.get("origin") || req.nextUrl.origin;
    const result = await purchaseRequestService.getRequestById(auth.user.id, requestId, origin);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to get purchase request:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
