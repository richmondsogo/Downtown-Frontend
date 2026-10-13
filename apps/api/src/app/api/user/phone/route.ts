import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "../../../../services/auth-guard";
import { db } from "../../../../db/index";
import { user } from "../../../../db/schema";
import { UserPhoneSchema } from "@downtown/validation";
import { normalizeNigerianPhone } from "@downtown/utils";
import { eq, sql } from "drizzle-orm";
import { ApiError } from "../../../../services/listing.service";

/**
 * PATCH /api/user/phone
 *
 * Updates authenticated user's self-declared Nigerian mobile phone number.
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await authorizeUser(req);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json().catch(() => ({}));
    const parsed = UserPhoneSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Invalid Nigerian mobile phone number";
      return NextResponse.json({ message: msg }, { status: 400 });
    }

    const normalizedPhone = normalizeNigerianPhone(parsed.data.phone);

    await db
      .update(user)
      .set({
        phone: normalizedPhone,
        updatedAt: sql`now()`,
      })
      .where(eq(user.id, auth.user.id));

    return NextResponse.json({ success: true, phone: normalizedPhone }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to update user phone:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return PATCH(req);
}
