# Database Migration & Branching Workflow

This document governs schema evolution, Drizzle migrations, and Neon database branching practices for Downtown.

---

## 1. Core Principles

1. **Version-controlled migrations exclusively**: All database schema changes must be represented by deterministic, versioned SQL migration files committed to Git under `apps/api/src/db/migrations/`.
2. **Never push to production**: The command `drizzle-kit push` is strictly prohibited against staging, production, or shared database instances. `drizzle-kit push` applies unreviewed, untracked changes directly to a schema without generating a reproducible migration file.
3. **Database branching per environment & test suite**: Neon provides instant, copy-on-write branching. Development and integration tests operate on dedicated Neon branches (e.g. `dev`), keeping production completely isolated.

---

## 2. Migration Lifecycle: Generate → Review → Migrate

```
Edit schema.ts ──> pnpm db:generate ──> Review SQL ──> Commit to Git ──> pnpm db:migrate
```

### Stage 1: Define Schemas (`schema.ts`)
Define table structures, columns, and constraints using Drizzle ORM in `apps/api/src/db/schema.ts` (or domain-specific modules re-exported from `schema.ts`).

### Stage 2: Generate Migration SQL (`pnpm db:generate`)
Run the generation command from the API workspace:
```bash
pnpm --filter api db:generate
```
Drizzle Kit computes the diff between current TypeScript schemas and previously generated snapshots, producing a numbered SQL file in `apps/api/src/db/migrations/` (e.g., `0000_breezy_pete_wisdom.sql`).

### Stage 3: Review Diff
Inspect the generated `.sql` file in `apps/api/src/db/migrations/`:
- Confirm constraints, default values, and column types match requirements.
- Ensure no destructive operations (`DROP COLUMN`, `DROP TABLE`) are generated unintentionally.

### Stage 4: Apply Migrations (`pnpm db:migrate`)
Apply pending migrations to the target database:
```bash
pnpm --filter api db:migrate
```
The migration runner executes all pending migrations inside a transaction and records applied migrations in Drizzle's migration tracking table.

---

## 3. Neon Branching Strategy

| Branch | Purpose | DATABASE_URL Target | Who Runs Migrations |
|---|---|---|---|
| `main` | Production database | Neon primary branch (`main`) | CI/CD deployment or release checkpoint |
| `dev` | Shared development & integration tests | Neon branch `dev` | Developers / test runners |
| `feat/*` | Ephemeral feature validation | Neon ephemeral branch | Feature author (optional) |

### Integration Tests on Dedicated Neon Branch
Integration tests must **never** run against the production database:
1. Create a `dev` branch on Neon:
   ```bash
   # Via Neon Console or Neon CLI
   neon branches create --name dev
   ```
2. Configure `DATABASE_URL` in `apps/api/.env` or test runner environment to point to the `dev` branch endpoint.
3. Integration test runners verify database connectivity and execute schema migrations before test execution.

---

## 4. Drizzle Driver & Transaction Guarantees

Downtown uses `@neondatabase/serverless` with WebSockets (`drizzle-orm/neon-serverless` + `Pool`), **not** `drizzle-orm/neon-http`.
- `neon-http` is stateless HTTP and cannot hold open interactive transactions across multiple queries.
- `drizzle-orm/neon-serverless` with `Pool` supports full interactive transactions (`db.transaction(...)`), which is mandatory for atomic multi-statement operations such as inventory reservation in purchase flows (Steps 07–08).

---

## 5. Production Migration Guard & Verification Protocol

To prevent accidental migrations against incorrect endpoints or developer oversight, production migrations and schema seeding are strictly guarded by `scripts/run-prod-migrations.ps1`.

### Protocol & Safety Guarantees

1. **Air-Gapped Credentials**:
   - The production database connection string is stored strictly in `.env.prod.secret` at the repository root.
   - `.env.prod.secret` is permanently gitignored, must never be printed to stdout, echoed into logs, or deleted by automated agents.
2. **Mandatory Host Confirmation (`CONFIRM_PROD_HOST`)**:
   - `scripts/run-prod-migrations.ps1` extracts and prints exclusively the target database hostname (e.g. `ep-noisy-fog-bafy7lrh-pooler.c-8.eu-central-1.aws.neon.tech`).
   - The script strictly demands that the environment variable `CONFIRM_PROD_HOST` (or the parameter `-ConfirmHost`) matches the target hostname. If they differ or the variable is unset, the script immediately aborts without touching the database.
3. **Post-Merge Execution & Table Audit**:
   - After each merged step that introduces schema migrations, run migrations against production via this script:
     ```powershell
     $env:CONFIRM_PROD_HOST = "<target-neon-prod-host>"
     .\scripts\run-prod-migrations.ps1
     ```
   - The runner executes all pending migrations inside a transaction and outputs the current list of public tables:
     ```json
     [
       "account",
       "rate_limit",
       "session",
       "user",
       "verification"
     ]
     ```
