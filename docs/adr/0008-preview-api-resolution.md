# ADR 0008: Preview API Routing & Edge Caching Topology

## Status

Accepted

## Context

In our architecture ([ADR 0002: Web-API Split Topology](file:///docs/adr/0002-web-api-topology.md)), Downtown operates as two separate Vercel deployments: `downtown-web` (Next.js frontend) and `downtown-api` (Next.js serverless backend). To prevent third-party cookie restrictions during Better Auth authentication and avoid CORS overhead, `apps/web/next.config.js` configures an external rewrite forwarding `/api/:path*` to `API_INTERNAL_URL`.

In production, `API_INTERNAL_URL` points to `https://downtown-api.vercel.app`. However, in Vercel preview environments, both web and api deployments are triggered concurrently from the same feature branch (e.g. `step/03-taxonomy-locations`). Because Vercel's default environment variables in preview inherited the static production `API_INTERNAL_URL`, preview web deployments routed all API requests to the production API of `master`, causing preview tests for unmerged routes to return HTTP 404.

Furthermore, we must verify whether external Next.js rewrites on Vercel properly participate in edge caching, ensuring public reference data (such as `/api/categories` and `/api/locations/autocomplete`) is served directly from Vercel's Edge Network with high cache hit ratios.

## Decision

1. **Dynamic Preview API Origin Resolution**:
   In `apps/web/next.config.js`, when `VERCEL_ENV === "preview"` and `VERCEL_GIT_COMMIT_REF` is defined (and not `main` or `master`), dynamically derive the matching preview API branch URL:
   ```javascript
   const branchSlug = process.env.VERCEL_GIT_COMMIT_REF
     .toLowerCase()
     .replace(/[^a-z0-9-]/g, "-")
     .replace(/-+/g, "-")
     .replace(/^-|-$/g, "")
     .slice(0, 63);
   const apiBaseUrl = `https://downtown-api-git-${branchSlug}-richmondsogo.vercel.app`;
   ```
   If a developer provides an explicit `PREVIEW_API_URL` override, that value takes precedence.

2. **Edge Cache Validation via Rewrites**:
   Empirical testing confirms that Vercel Edge CDN strictly obeys upstream `Cache-Control` directives on external rewrites (`public, max-age=..., s-maxage=...`). Once the upstream API responds with edge cache directives, subsequent requests through the web domain yield instant `x-vercel-cache: HIT` responses. We retain the transparent Next.js rewrite rather than introducing an ad-hoc proxy layer or exposing direct browser cross-origin requests.

## Alternatives Considered

1. **Manual Per-Branch Environment Variable Configuration in Vercel**:
   Setting `API_INTERNAL_URL` manually on each preview deployment requires developer platform access, manual intervention per PR, and is prone to human error.
2. **Next.js Route Handlers with `fetch(..., { next: { revalidate } })`**:
   Creating dedicated route handlers in `apps/web/src/app/api/...` to fetch from the upstream API and use Next.js Data Cache adds unnecessary serverless compute costs, cold start overhead, and code duplication when Vercel's edge network already handles reverse proxy edge caching out-of-the-box.
3. **Direct Browser API Calls via `NEXT_PUBLIC_API_URL`**:
   Having client components call `https://downtown-api.vercel.app` directly requires configuring permissive CORS headers, exposes internal API infrastructure, and fractures client-side data fetching between public endpoints (direct) and authenticated endpoints (reverse-proxied for session cookies).

## Trade-offs

- **Concurrent Deployment Race Condition**: If a preview web deployment finishes building before its matching preview API deployment is live, requests through preview web may encounter 404 or 502 errors until the API deployment finishes.
- **Slug Normalization Fragility**: The derivation logic assumes Vercel's standard Git branch URL slugging rules. If branch naming rules or team slugs (`richmondsogo`) change, the derivation helper must be updated.
- **Preview Isolation**: Preview environments now cleanly isolate schema and API changes per branch, preventing premature reliance on production backend state.

## Consequences

- Preview web deployments automatically communicate with their corresponding feature branch API deployment without manual intervention.
- Public GET requests through both production and preview web domains are edge-cached by Vercel CDN, lowering serverless invocation costs and reducing latency for Nigerian student network conditions.
- Cookie-based authentication continues to function identically across all deployment tiers.
