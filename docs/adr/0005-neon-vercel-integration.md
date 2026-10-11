# ADR 0005: Neon Vercel Integration vs. Static Branch Scoping

## Status

Proposed (Recommendation: Static Branch Scoping; do not enable auto per-preview integration yet)

## Context

Neon offers an official Vercel integration that automatically provisions an ephemeral Neon database branch for every Vercel preview deployment. 

As part of Step 02b follow-ups, we must scope database environments across Vercel environments:
1. `Production` deployments must strictly point to the production Neon database.
2. `Preview` and `Development` deployments must point to non-production environments.

We evaluated whether to enable Neon's automated per-preview branch Vercel integration or maintain explicit static branch scoping.

## Evaluation of Neon's Automated Vercel Integration

### Advantages
1. **Isolated Preview Environments**: Every pull request preview deployment gets its own isolated Postgres branch with copy-on-write snapshot data.
2. **Safe Schema Migrations**: Destructive or experimental schema migrations on a preview PR branch do not affect fellow developers or shared test instances.
3. **Automated Teardown**: Neon can automatically delete preview branches when PRs are closed or merged.

### Disadvantages & Constraints for Downtown
1. **Branch Quotas**: Neon's current plan enforces strict branch limits (free/starter tiers cap at 10 branches total). A surge in PR previews or multiple active branches quickly exhausts this quota, causing Vercel preview builds to fail abruptly.
2. **Compute & Concurrency Limits**: Each active branch provisions a compute endpoint. Concurrently active preview endpoints consume compute quotas and risk throttling.
3. **Migration Execution Pipeline**: Dynamic branch provisioning injects dynamically generated environment variables (`DATABASE_URL`) during Vercel build time. Running Drizzle migrations reliably during preview builds requires custom build scripts or webhooks.
4. **Credential Surface Area**: Automatic credential injection across environments increases complexity and reduces auditability compared to explicit environment variable configuration in Vercel.

## Recommendation

**Do not enable Neon's automated per-preview Vercel integration at this stage.**

Instead, implement **Static Environment Scoping**:
- **Vercel Production**: Point `DATABASE_URL` exclusively to the Neon `main` (production) branch pooled connection string.
- **Vercel Preview & Development**: Point `DATABASE_URL` exclusively to the Neon `dev` branch pooled connection string.

This provides:
- Complete isolation of production data from all preview, pull request, and local development traffic.
- Zero risk of exhausting Neon branch quotas during active pull request cycles.
- Predictable and stable migration targets (`drizzle-kit migrate` runs against `dev` for testing, and explicitly against `main` for production releases).

## Consequences

- Neon project `misty-paper-37733898` maintains two distinct branches: `main` (production) and `dev` (development & preview).
- Vercel project environment variables for both `downtown-api` and `downtown-web` are configured with target scoping (Production vs Preview/Development).
- If team scale or testing demands isolated branches in the future, the integration can be revisited when upgraded to a Neon Pro plan.
