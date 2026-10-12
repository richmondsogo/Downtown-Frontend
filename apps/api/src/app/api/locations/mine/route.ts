import { NextRequest, NextResponse } from "next/server";
import { getMyLocations } from "../../../../services/taxonomy.service";
import { auth } from "../../../../services/auth.service";

/**
 * GET /api/locations/mine?campusId=...
 *
 * Authenticated endpoint for retrieving the current user's custom created locations.
 * - Requires active session (HTTP 401 if unauthenticated).
 * - Strictly private and uncacheable: Cache-Control: private, no-cache, no-store, must-revalidate.
 * - Returns only custom locations created by this user (isCurated = false, creatorId = session.user.id).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Authentication required to view your custom locations." },
        {
          status: 401,
          headers: {
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
          },
        }
      );
    }

    const { searchParams } = new URL(req.url);
    const campusId = searchParams.get("campusId") || undefined;

    const myLocations = await getMyLocations(session.user.id, campusId);

    return NextResponse.json(myLocations, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Failed to fetch custom locations:", error);
    return NextResponse.json(
      { message: "Failed to fetch custom locations" },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  }
}
