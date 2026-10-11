import { auth } from "@/services/auth.service";
import { toNextJsHandler } from "better-auth/next-js";

export const dynamic = "force-dynamic";

const nextHandler = toNextJsHandler(auth);

function resolveDebugIP(req: Request) {
  const headers = req.headers;
  const ipHeaders = ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"];
  for (const h of ipHeaders) {
    const val = headers.get(h);
    if (val) {
      const parts = val.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length === 1) {
        return { ip: parts[0], header: h };
      }
    }
  }
  return { ip: null, header: null };
}

export async function POST(req: Request) {
  const resolved = resolveDebugIP(req);
  console.log("[IP_LIMITER_DEBUG]", {
    url: req.url,
    resolvedIp: resolved.ip,
    resolvedHeader: resolved.header,
    xVercel: req.headers.get("x-vercel-forwarded-for"),
    xReal: req.headers.get("x-real-ip"),
    xFwd: req.headers.get("x-forwarded-for"),
  });

  const res = await nextHandler.POST(req);

  const newHeaders = new Headers(res.headers);
  newHeaders.set("x-debug-resolved-ip", resolved.ip || "null");
  newHeaders.set("x-debug-resolved-header", resolved.header || "null");
  if (req.headers.get("x-vercel-forwarded-for")) {
    newHeaders.set("x-debug-in-x-vercel", req.headers.get("x-vercel-forwarded-for")!);
  }
  if (req.headers.get("x-forwarded-for")) {
    newHeaders.set("x-debug-in-x-fwd", req.headers.get("x-forwarded-for")!);
  }

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: newHeaders,
  });
}

export const GET = nextHandler.GET;

