import { NextRequest, NextResponse } from "next/server";
import { searchService } from "../../../../services/search.service";
import { checkRateLimit, getClientIp } from "../../../../services/rate-limit.service";
import { SuggestQuerySchema } from "@downtown/validation";

/**
 * GET /api/search/suggest?q=...
 *
 * Fast title prefix suggestions endpoint (Amendment c).
 * - Requires min 2 characters.
 * - Server limit 6 items, payload < 2 KB.
 * - Rate limited per client IP (60 req/min).
 * - Edge cached: public, s-maxage=60, stale-while-revalidate=120.
 */
export async function GET(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const rlKey = `search_suggest:${clientIp}`;
    const rlResult = await checkRateLimit(rlKey, 60, 60 * 1000);

    if (!rlResult.success) {
      const retryAfter = Math.max(1, Math.ceil((rlResult.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { message: "Too many suggestion requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
          },
        }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawQ = searchParams.get("q") ?? "";

    const parsed = SuggestQuerySchema.safeParse({ q: rawQ });
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid suggestion query" },
        { status: 400 }
      );
    }

    const suggestions = await searchService.suggest(parsed.data.q);

    return NextResponse.json(suggestions, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Failed to fetch suggestions:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
