import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConsoleEmailService } from "../services/email.service";

describe("ConsoleEmailService Production Guard", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalNextPublicVercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  const originalNextPhase = process.env.NEXT_PHASE;

  beforeEach(() => {
    delete process.env.VERCEL_ENV;
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    delete process.env.NEXT_PHASE;
  });

  afterEach(() => {
    if (originalVercelEnv !== undefined) {
      process.env.VERCEL_ENV = originalVercelEnv;
    } else {
      delete process.env.VERCEL_ENV;
    }

    if (originalNextPublicVercelEnv !== undefined) {
      process.env.NEXT_PUBLIC_VERCEL_ENV = originalNextPublicVercelEnv;
    } else {
      delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    }

    if (originalNextPhase !== undefined) {
      process.env.NEXT_PHASE = originalNextPhase;
    } else {
      delete process.env.NEXT_PHASE;
    }
  });

  it("strictly throws in production environment when VERCEL_ENV is 'production'", () => {
    process.env.VERCEL_ENV = "production";

    expect(() => new ConsoleEmailService()).toThrowError(
      /FATAL: ConsoleEmailService cannot be used in production environment/
    );
  });

  it("allows instantiation in preview environment when VERCEL_ENV is 'preview'", () => {
    process.env.VERCEL_ENV = "preview";

    expect(() => new ConsoleEmailService()).not.toThrow();
  });

  it("allows instantiation in development environment when VERCEL_ENV is 'development'", () => {
    process.env.VERCEL_ENV = "development";

    expect(() => new ConsoleEmailService()).not.toThrow();
  });

  it("allows instantiation during production build phase (NEXT_PHASE=phase-production-build)", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PHASE = "phase-production-build";

    expect(() => new ConsoleEmailService()).not.toThrow();
  });
});
