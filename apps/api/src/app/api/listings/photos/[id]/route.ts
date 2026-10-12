import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "../../../../../services/auth-guard";
import { listingService, ApiError } from "../../../../../services/listing.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/listings/photos/:id
 *
 * Deletes an owned photo. IDOR protected.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await authorizeUser(req, { requireCanSell: true });
    if (auth.errorResponse) return auth.errorResponse;

    await listingService.deletePhoto(auth.user.id, id);
    return NextResponse.json({ success: true, message: "Photo deleted successfully" }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to delete photo:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
