import { NextRequest, NextResponse } from "next/server";
import { listingService, ApiError } from "../../../../../services/listing.service";
import { getClientIp } from "../../../../../services/rate-limit.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/listings/:id/view
 *
 * Lightweight view counter increment with IP rate limiting and abuse prevention.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const clientIp = getClientIp(req.headers);

    const result = await listingService.incrementViewCount(id, clientIp);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to increment view count:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
