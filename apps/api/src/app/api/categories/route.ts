import { NextResponse } from "next/server";
import { getCategories } from "../../../services/taxonomy.service";

/**
 * GET /api/categories
 * Public endpoint returning all active categories.
 * Configured with long-lived public edge cache headers.
 */
export async function GET() {
  try {
    const categories = await getCategories();

    return NextResponse.json(categories, {
      status: 200,
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json(
      { message: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
