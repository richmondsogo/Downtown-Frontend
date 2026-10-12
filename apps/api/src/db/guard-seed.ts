/**
 * Central database seed execution guard.
 * Strictly enforces that seed scripts can ONLY run against local/development databases
 * with explicit ALLOW_SEED=1, and refuses execution against production under any circumstance.
 */

export interface SeedGuardOptions {
  nodeEnv?: string;
  allowSeed?: string;
  databaseUrl?: string;
}

export const ALLOWED_DEV_HOSTS = [
  "ep-shiny-credit-baedn5p1-pooler.c-8.eu-central-1.aws.neon.tech",
  "localhost",
  "127.0.0.1",
];

export const PRODUCTION_HOST = "ep-noisy-fog-bafy7lrh-pooler.c-8.eu-central-1.aws.neon.tech";

export function assertSafeSeedEnvironment(options?: SeedGuardOptions): { host: string } {
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const allowSeed = options?.allowSeed ?? process.env.ALLOW_SEED;
  const dbUrl = options?.databaseUrl ?? process.env.DATABASE_URL;

  if (nodeEnv === "production") {
    throw new Error("FATAL: Seed script cannot run in production (NODE_ENV=production).");
  }

  if (allowSeed !== "1") {
    throw new Error("REFUSED: Seed script requires explicit ALLOW_SEED=1 environment variable.");
  }

  if (!dbUrl) {
    throw new Error("FATAL: DATABASE_URL is not set.");
  }

  let host: string;
  try {
    const parsed = new URL(dbUrl);
    host = parsed.hostname;
  } catch {
    throw new Error("FATAL: DATABASE_URL is not a valid URL.");
  }

  if (host === PRODUCTION_HOST) {
    throw new Error(`REFUSED: Database host "${host}" matches production database.`);
  }

  const isAllowed = ALLOWED_DEV_HOSTS.some((allowed) => host.includes(allowed));
  if (!isAllowed) {
    throw new Error(`REFUSED: Database host "${host}" is not on the dev allowlist.`);
  }

  return { host };
}
