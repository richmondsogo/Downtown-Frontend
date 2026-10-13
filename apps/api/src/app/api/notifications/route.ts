import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "../../../services/auth-guard";
import { db } from "../../../db/index";
import { notification } from "../../../db/schema";
import { eq, desc, isNull, and, count, sql } from "drizzle-orm";
import { ApiError } from "../../../services/listing.service";

/**
 * GET /api/notifications
 *
 * Retrieves in-app notifications for authenticated user, including unread count.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeUser(req);
    if (auth.errorResponse) return auth.errorResponse;

    const [unreadCountRow] = await db
      .select({ count: count() })
      .from(notification)
      .where(and(eq(notification.userId, auth.user.id), isNull(notification.readAt)));

    const rows = await db
      .select()
      .from(notification)
      .where(eq(notification.userId, auth.user.id))
      .orderBy(desc(notification.createdAt))
      .limit(30);

    const notifications = rows.map((r) => {
      let parsedPayload: Record<string, any> = {};
      try {
        parsedPayload = JSON.parse(r.payload);
      } catch {
        parsedPayload = {};
      }
      return {
        id: r.id,
        userId: r.userId,
        type: r.type,
        payload: parsedPayload,
        readAt: r.readAt?.toISOString() || null,
        createdAt: r.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      unreadCount: Number(unreadCountRow?.count) || 0,
      notifications,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to get notifications:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
