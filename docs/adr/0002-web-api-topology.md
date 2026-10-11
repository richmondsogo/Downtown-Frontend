# ADR 0002: Web <-> API Communication Topology

## Status

Accepted

## Context

Downtown consists of a frontend web application (`apps/web`), a backend API service (`apps/api`), and a future native mobile application (`apps/mobile` via React Native + Expo post-MVP).

In production on Vercel and in local development, we need to decide how `apps/web` communicates with `apps/api`. Specifically, we must resolve:
1. **Cookie & Authentication Storage**: Session and authentication tokens stored in `httpOnly` secure cookies must not suffer from third-party or cross-subdomain cookie blocking issues, especially on mobile browsers (Safari ITP, Chrome Privacy Sandbox, aggressive mobile browsers on Android like Phoenix/Opera Mini).
2. **CORS Complexity**: Cross-Origin Resource Sharing (CORS) preflight requests (`OPTIONS`) introduce additional latency on mobile 3G/4G campus connections.
3. **Platform Independence for Mobile**: When the React Native / Expo mobile app is introduced post-MVP, it does not use a browser origin and must communicate directly with the API using bearer tokens or headers.
4. **Independent Deployment**: Web and API should be deployable independently on Vercel without tightly coupling server instances.

## Decision

We will use a **Web Reverse Proxy Rewrite** pattern as the default topology:
- In `apps/web/next.config.js`, all incoming browser requests matching `/api/:path*` are rewritten to the backend API origin (`process.env.API_INTERNAL_URL` or `http://localhost:3001/:path*`).
- In production, Vercel routes `/api/*` from `downtown.ng/api/*` to the deployed `api` project via Next.js rewrites or Vercel project routing.
- This ensures the browser communicates with `apps/web` and `apps/api` on the **exact same origin** (`downtown.ng`), granting full first-party cookie privileges without CORS preflight requests.
- The `apps/api` application remains a standalone HTTP API accessible directly (e.g. `api.downtown.ng`). When `apps/mobile` launches, it will call `api.downtown.ng` directly using Authorization headers.

## Alternatives Considered

1. **Subdomain Separation (`app.downtown.ng` and `api.downtown.ng`)**:
   - *Pros*: Completely separate DNS endpoints.
   - *Cons*: Requires cross-origin requests, CORS header maintenance, preflight round-trips on every non-simple request, and cross-subdomain cookie handling (`domain=.downtown.ng`), which can be intermittently dropped by restrictive mobile Android browsers.
2. **Single Monolithic Next.js App (Merging Web and API into `apps/web`)**:
   - *Pros*: Simplest configuration, no proxying needed.
   - *Cons*: Violates clean separation of concerns. Makes it harder for the upcoming React Native / Expo app to consume a standalone, decoupled API service. Blurs backend service layer dependencies with frontend React components.
3. **Dedicated API Gateway / Reverse Proxy (e.g. Kong, Envoy, Cloudflare Workers)**:
   - *Pros*: Centralized rate limiting, routing, and telemetry.
   - *Cons*: Unnecessary infrastructure overhead for a 3-person team with zero revenue. Violates the Build Protocol rule against speculative infrastructure.

## Trade-offs

- The web server acts as a proxy for browser API requests, adding a minor hop in local development or serverless execution.
- Path prefixes must be standardized: `apps/web` rewrites `/api/*` to `apps/api/*`, so route handlers in `apps/api` reside under `app/api/...` or the rewrite maps `/api/:path*` -> `/:path*`. Standardizing on `apps/api` having `/health` or `/api/health` keeps routes predictable.

## Consequences

- Same-origin authentication cookies (`httpOnly`, `SameSite=Lax`, `Secure`) will work seamlessly on all mobile browsers without CORS configuration.
- Zero CORS preflight overhead for the web client.
- `apps/api` is still fully standalone with its own test suite and can be called directly by Postman, curl, and future native mobile apps via `api.downtown.ng`.
- Local development runs `apps/web` on port 3000 and `apps/api` on port 3001, with proxying configured out of the box.
