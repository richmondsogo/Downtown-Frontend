import { NextRequest, NextResponse } from "next/server";
import { createCustomLocation } from "../../../services/taxonomy.service";
import { auth } from "../../../services/auth.service";
import { checkRateLimit } from "../../../services/rate-limit.service";
import { CreateLocationSchema } from "@downtown/validation";

/**
 * POST /api/locations
 *
 * Authenticated submission for custom locations.
 * - Enforces session authentication.
 * - Rate limited to 5 submissions per 10 minutes per user.
 * - Strictly validates length (3-80 chars) and normalizes whitespace.
 * - Rejects phone numbers and URLs.
 * - Deduplicates case-insensitively within the campus.
 * - Created as is_curated = false, returned ONLY to the creator.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Enforce authentication
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Authentication required to submit a custom location." },
        { status: 401 }
      );
    }

    // 2. Enforce rate limit (5 requests per 10 minutes)
    const rateLimitKey = `location_create:${session.user.id}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 5, 10 * 60 * 1000);
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          message:
            "Too many location submissions. Please wait before submitting another.",
        },
        { status: 429 }
      );
    }

    // 3. Validate request payload
    const body = await req.json().catch(() => null);
    const parsed = CreateLocationSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Invalid location input";
      return NextResponse.json({ message: firstError }, { status: 400 });
    }

    // 4. Create location or resolve duplicate
    const result = await createCustomLocation(parsed.data, session.user.id);

    if (result.isDuplicate) {
      return NextResponse.json(
        {
          location: result.location,
          isDuplicate: true,
          message: "Location already exists in this campus.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        location: result.location,
        isDuplicate: false,
        message: "Custom location submitted successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "Failed to create location";
    const status = errMessage.includes("does not exist") ? 404 : 500;
    return NextResponse.json({ message: errMessage }, { status });
  }
}
