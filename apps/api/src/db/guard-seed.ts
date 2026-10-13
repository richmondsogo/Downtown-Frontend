/**
 * Central database seed execution guard.
 * Strictly enforces that seed scripts can ONLY run against local/development databases
 * with explicit ALLOW_SEED=1, and refuses execution against production under any circumstance.
 */

export interface SeedGuardOptions {
  nodeEnv?: string;
  allowSeed?: string;
  databaseUrl?: string;
  allowedDevHosts?: string[];
}

export const DEFAULT_ALLOWED_DEV_HOSTS = [
  "ep-shiny-credit-baedn5p1-pooler.c-8.eu-central-1.aws.neon.tech",
  "localhost",
  "127.0.0.1",
];

export const ALLOWED_DEV_HOSTS = DEFAULT_ALLOWED_DEV_HOSTS;

export const PRODUCTION_HOST = "ep-noisy-fog-bafy7lrh-pooler.c-8.eu-central-1.aws.neon.tech";

export function getAllowedDevHosts(nodeEnv?: string): string[] {
  const env = nodeEnv ?? process.env.NODE_ENV ?? "development";
  const hosts = ["ep-shiny-credit-baedn5p1-pooler.c-8.eu-central-1.aws.neon.tech"];
  // Localhost is strictly restricted to development environments
  if (env === "development") {
    hosts.push("localhost", "127.0.0.1");
  }
  if (process.env.DEV_DB_HOST && process.env.DEV_DB_HOST.trim()) {
    hosts.push(process.env.DEV_DB_HOST.trim());
  }
  return hosts;
}

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

  const allowedHosts = options?.allowedDevHosts ?? getAllowedDevHosts(nodeEnv);
  const isAllowed = allowedHosts.includes(host);
  if (!isAllowed) {
    throw new Error(`REFUSED: Database host "${host}" is not on the dev allowlist.`);
  }

  return { host };
}

export const guardSeedDatabase = assertSafeSeedEnvironment;
