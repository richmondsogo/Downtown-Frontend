import { describe, it, expect } from "vitest";
import { assertSafeSeedEnvironment, PRODUCTION_HOST, ALLOWED_DEV_HOSTS } from "../db/guard-seed";

describe("Seed Guard Environment Safety Suite", () => {
  const validDevUrl = `postgresql://user:pass@${ALLOWED_DEV_HOSTS[0]}/downtown_dev?sslmode=require`;
  const prodUrl = `postgresql://user:pass@${PRODUCTION_HOST}/downtown_prod?sslmode=require`;
  const unauthorizedHostUrl = "postgresql://user:pass@evil-database.amazonaws.com/db";

  it("permits execution when ALLOW_SEED=1 and dev host is allowlisted", () => {
    const result = assertSafeSeedEnvironment({
      nodeEnv: "development",
      allowSeed: "1",
      databaseUrl: validDevUrl,
    });
    expect(result.host).toBe(ALLOWED_DEV_HOSTS[0]);
  });

  it("permits execution on localhost and 127.0.0.1", () => {
    const localhostResult = assertSafeSeedEnvironment({
      nodeEnv: "development",
      allowSeed: "1",
      databaseUrl: "postgresql://postgres:postgres@localhost:5432/downtown",
    });
    expect(localhostResult.host).toBe("localhost");

    const ipResult = assertSafeSeedEnvironment({
      nodeEnv: "development",
      allowSeed: "1",
      databaseUrl: "postgresql://postgres:postgres@127.0.0.1:5432/downtown",
    });
    expect(ipResult.host).toBe("127.0.0.1");
  });

  it("REFUSES execution when ALLOW_SEED is missing or not '1'", () => {
    expect(() =>
      assertSafeSeedEnvironment({
        nodeEnv: "development",
        allowSeed: undefined,
        databaseUrl: validDevUrl,
      })
    ).toThrow(/REFUSED: Seed script requires explicit ALLOW_SEED=1/);

    expect(() =>
      assertSafeSeedEnvironment({
        nodeEnv: "development",
        allowSeed: "true",
        databaseUrl: validDevUrl,
      })
    ).toThrow(/REFUSED: Seed script requires explicit ALLOW_SEED=1/);
  });

  it("REFUSES execution in production environment (NODE_ENV=production)", () => {
    expect(() =>
      assertSafeSeedEnvironment({
        nodeEnv: "production",
        allowSeed: "1",
        databaseUrl: validDevUrl,
      })
    ).toThrow(/FATAL: Seed script cannot run in production/);
  });

  it("REFUSES execution against the production Neon host even with ALLOW_SEED=1", () => {
    expect(() =>
      assertSafeSeedEnvironment({
        nodeEnv: "development",
        allowSeed: "1",
        databaseUrl: prodUrl,
      })
    ).toThrow(/REFUSED: Database host .* matches production database/);
  });

  it("REFUSES execution against unknown or unauthorized hosts", () => {
    expect(() =>
      assertSafeSeedEnvironment({
        nodeEnv: "development",
        allowSeed: "1",
        databaseUrl: unauthorizedHostUrl,
      })
    ).toThrow(/REFUSED: Database host .* is not on the dev allowlist/);
  });

  it("REFUSES execution against an unknown Neon host not in the allowlist", () => {
    const unknownNeonUrl =
      "postgresql://user:pass@ep-unknown-branch-baedn5p1-pooler.c-8.eu-central-1.aws.neon.tech/neondb?sslmode=require";
    expect(() =>
      assertSafeSeedEnvironment({
        nodeEnv: "development",
        allowSeed: "1",
        databaseUrl: unknownNeonUrl,
      })
    ).toThrow(/REFUSED: Database host .* is not on the dev allowlist/);
  });

  it("REFUSES execution when DATABASE_URL is missing or invalid", () => {
    expect(() =>
      assertSafeSeedEnvironment({
        nodeEnv: "development",
        allowSeed: "1",
        databaseUrl: undefined,
      })
    ).toThrow(/FATAL: DATABASE_URL is not set/);

    expect(() =>
      assertSafeSeedEnvironment({
        nodeEnv: "development",
        allowSeed: "1",
        databaseUrl: "not-a-valid-url",
      })
    ).toThrow(/FATAL: DATABASE_URL is not a valid URL/);
  });

  it("REFUSES localhost execution in any non-dev setting (staging / preview / test)", () => {
    expect(() =>
      assertSafeSeedEnvironment({
        nodeEnv: "staging",
        allowSeed: "1",
        databaseUrl: "postgresql://postgres:postgres@localhost:5432/downtown",
      })
    ).toThrow(/REFUSED: Database host "localhost" is not on the dev allowlist/);
  });
});
