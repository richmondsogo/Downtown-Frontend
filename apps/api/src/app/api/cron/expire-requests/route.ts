import { NextRequest, NextResponse } from "next/server";
import { purchaseRequestService } from "../../../../services/purchase-request.service";

/**
 * GET /api/cron/expire-requests
 *
 * Daily maintenance cron sweep protected by CRON_SECRET.
 * Sweeps requests where resolution_deadline <= now() and sets status = 'expired'.
 * Vercel Hobby strictly limits cron execution to once daily (0 0 * * *).
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[Cron Auth] CRON_SECRET is not configured in environment.");
      return NextResponse.json({ message: "Cron secret not configured" }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[Cron Auth] Unauthorized invocation attempt on /api/cron/expire-requests");
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const result = await purchaseRequestService.sweepExpiredRequests();

    return NextResponse.json({
      success: true,
      message: `Sweep completed. Expired ${result.expiredCount} requests.`,
      expiredCount: result.expiredCount,
    }, { status: 200 });
  } catch (error) {
    console.error("Cron sweep failed:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
