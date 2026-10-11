import { NextResponse } from "next/server";
import { getCampuses } from "../../../services/taxonomy.service";

/**
 * GET /api/campuses
 * Public endpoint returning UNIOSUN campuses.
 * Configured with long-lived public edge cache headers.
 */
export async function GET() {
  try {
    const campuses = await getCampuses();

    return NextResponse.json(campuses, {
      status: 200,
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("Failed to fetch campuses:", error);
    return NextResponse.json(
      { message: "Failed to fetch campuses" },
      { status: 500 }
    );
  }
}
