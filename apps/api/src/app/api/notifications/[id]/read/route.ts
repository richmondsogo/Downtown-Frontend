import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "../../../../../services/auth-guard";
import { db } from "../../../../../db/index";
import { notification } from "../../../../../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { ApiError } from "../../../../../services/listing.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/notifications/:id/read
 *
 * Marks an owned notification as read.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: notifId } = await params;
    const auth = await authorizeUser(req);
    if (auth.errorResponse) return auth.errorResponse;

    await db
      .update(notification)
      .set({ readAt: sql`now()` })
      .where(and(eq(notification.id, notifId), eq(notification.userId, auth.user.id)));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to mark notification as read:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteParams) {
  return PATCH(req, context);
}
