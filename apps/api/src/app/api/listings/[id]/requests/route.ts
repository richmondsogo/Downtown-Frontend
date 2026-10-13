import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "../../../../../services/auth-guard";
import { purchaseRequestService } from "../../../../../services/purchase-request.service";
import { CreatePurchaseRequestSchema } from "@downtown/validation";
import { ApiError } from "../../../../../services/listing.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/listings/:id/requests
 *
 * Submits a purchase request on a listing.
 * - Authenticated buyer only.
 * - Soft gate / prompt phone if phone missing.
 * - Concurrency guarded with SELECT ... FOR UPDATE.
 * - Idempotent: returns existing request + wa.me link with HTTP 200 if already live.
 * - Returns newly created request + wa.me link with HTTP 201.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: listingId } = await params;
    const auth = await authorizeUser(req);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json().catch(() => ({}));
    const parsed = CreatePurchaseRequestSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Invalid purchase request payload";
      return NextResponse.json({ message: msg }, { status: 400 });
    }

    const clientIp = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "no-trusted-ip";
    const origin = req.headers.get("origin") || req.nextUrl.origin;

    const result = await purchaseRequestService.createRequest({
      buyerId: auth.user.id,
      listingId,
      input: parsed.data,
      clientIp,
      origin,
    });

    const statusCode = result.isExisting ? 200 : 201;
    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to create purchase request:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
