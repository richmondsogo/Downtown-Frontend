import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "../../../../../services/auth-guard";
import { savedService } from "../../../../../services/saved.service";
import { ApiError } from "../../../../../services/listing.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/listings/:id/save
 *
 * Authenticated toggle for saving / unsaving a listing.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await authorizeUser(req, { requireCanSell: false });
    if (auth.errorResponse) return auth.errorResponse;

    const result = await savedService.toggleSave(auth.user.id, id);

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
    console.error("Failed to toggle save on listing:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
