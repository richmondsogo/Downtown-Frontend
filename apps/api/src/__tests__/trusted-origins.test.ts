import { describe, it, expect } from "vitest";
import { getTrustedOrigins } from "../services/auth.service";

// If matchesOriginPattern is not directly exposed from the top level, Better Auth exports it internally:
// We also implement pattern matching test using the actual Better Auth wildcard logic or Better Auth's trusted origins helper.

describe("trustedOrigins Narrowing", () => {
  describe("Production Environment", () => {
    it("trusts ONLY the production web origin in production", () => {
      const origins = getTrustedOrigins({
        VERCEL_ENV: "production",
        BETTER_AUTH_URL: "https://downtown-web-five.vercel.app",
      });

      expect(origins).toEqual(["https://downtown-web-five.vercel.app"]);
      expect(origins).not.toContain("http://localhost:3000");
      expect(origins).not.toContain("http://localhost:3001");
      expect(origins).not.toContain("https://*.vercel.app");
      expect(origins.some((o) => o.includes("*"))).toBe(false);
    });

    it("defaults to canonical production web origin when BETTER_AUTH_URL is unset", () => {
      const origins = getTrustedOrigins({
        VERCEL_ENV: "production",
      });

      expect(origins).toEqual(["https://downtown-web-five.vercel.app"]);
    });
  });

  describe("Preview & Development Environment", () => {
    it("trusts localhost and project-scoped preview patterns in non-prod", () => {
      const origins = getTrustedOrigins({
        VERCEL_ENV: "preview",
        BETTER_AUTH_URL: "https://downtown-web-five.vercel.app",
      });

      expect(origins).toContain("http://localhost:3000");
      expect(origins).toContain("http://localhost:3001");
      expect(origins).toContain("https://downtown-web-five.vercel.app");
      expect(origins).toContain("https://downtown-web-*.vercel.app");
      expect(origins).toContain("https://downtown-web-*-richmondsogo.vercel.app");
      expect(origins).toContain("https://downtown-*-richmondsogo.vercel.app");

      // STRICT NEGATIVE ASSERTION: Never bare *.vercel.app
      expect(origins).not.toContain("https://*.vercel.app");
      expect(origins).not.toContain("*.vercel.app");
    });

    it("matches our project's preview domains and rejects arbitrary vercel.app domains", () => {
      const origins = getTrustedOrigins({
        VERCEL_ENV: "preview",
      });

      // Wildcard matcher helper consistent with Better Auth origin check
      const isAllowed = (url: string) => {
        return origins.some((pattern) => {
          if (pattern === url) return true;
          if (pattern.includes("*")) {
            // Regex from wildcard pattern
            const regex = new RegExp(
              "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"
            );
            return regex.test(url);
          }
          return false;
        });
      };

      // Allowed
      expect(isAllowed("http://localhost:3000")).toBe(true);
      expect(isAllowed("http://localhost:3001")).toBe(true);
      expect(isAllowed("https://downtown-web-five.vercel.app")).toBe(true);
      expect(isAllowed("https://downtown-web-git-step-02d-richmondsogo.vercel.app")).toBe(true);
      expect(isAllowed("https://downtown-em3dqew3f-richmondsogo.vercel.app")).toBe(true);
      expect(isAllowed("https://downtown-web-preview-branch.vercel.app")).toBe(true);

      // Strictly rejected: Arbitrary Vercel apps or evil attackers
      expect(isAllowed("https://evil.vercel.app")).toBe(false);
      expect(isAllowed("https://malicious-app.vercel.app")).toBe(false);
      expect(isAllowed("https://attacker-downtown.vercel.app")).toBe(false);
      expect(isAllowed("https://otherproject.vercel.app")).toBe(false);
      expect(isAllowed("https://evil.com")).toBe(false);
    });
  });
});
