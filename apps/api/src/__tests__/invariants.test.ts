import { describe, it, expect } from "vitest";
import { DEFAULT_STORAGE_SOFT_CAP_BYTES } from "../services/listing.service";
import { getClientIp } from "../services/rate-limit.service";
import {
  StudentSignUpSchema,
  StaffSignUpSchema,
  VendorSignUpSchema,
  ListingStatusEnum,
  MATRIC_NUMBER_PATTERN,
  normalizeMatricNumber,
} from "@downtown/validation";
import { assertSafeSeedEnvironment } from "../db/guard-seed";

describe("System & Architectural Invariants (docs/invariants.md)", () => {
  describe("Invariant 1: Storage soft cap is 800 MB and token policy", () => {
    it("STORAGE_SOFT_CAP_BYTES defaults to exactly 800 MB (838,860,800 bytes)", () => {
      expect(DEFAULT_STORAGE_SOFT_CAP_BYTES).toBe(800 * 1024 * 1024);
      expect(DEFAULT_STORAGE_SOFT_CAP_BYTES).toBe(838_860_800);
    });
  });

  describe("Invariant 2: Rate-limit client IP extraction & fail-closed bucket", () => {
    it("extracts IP strictly from x-vercel-forwarded-for platform header", () => {
      const headers = new Headers();
      headers.set("x-vercel-forwarded-for", "102.89.23.4");
      expect(getClientIp(headers)).toBe("102.89.23.4");
    });

    it("takes the first IP when x-vercel-forwarded-for contains a chain", () => {
      const headers = new Headers();
      headers.set("x-vercel-forwarded-for", "102.89.23.4, 198.51.100.1");
      expect(getClientIp(headers)).toBe("102.89.23.4");
    });

    it("strictly ignores untrusted headers (x-forwarded-for, cf-connecting-ip, x-real-ip)", () => {
      const headers = new Headers();
      headers.set("x-forwarded-for", "1.2.3.4");
      headers.set("cf-connecting-ip", "5.6.7.8");
      headers.set("x-real-ip", "9.10.11.12");

      // Without x-vercel-forwarded-for, untrusted headers are ignored
      expect(getClientIp(headers)).toBe("no-trusted-ip");
    });

    it("routes null/missing IP to shared fail-closed sentinel bucket 'no-trusted-ip'", () => {
      const emptyHeaders = new Headers();
      expect(getClientIp(emptyHeaders)).toBe("no-trusted-ip");
    });
  });

  describe("Invariant 3: Matriculation number regex and prefix rejection", () => {
    it("strictly rejects 'UNIOSUN/' prefix with an actionable error showing the valid example", () => {
      const result = StudentSignUpSchema.safeParse({
        email: "student@gmail.com",
        password: "Password123!",
        name: "Test Student",
        phone: "08012345678",
        role: "student",
        matricNumber: "UNIOSUN/2024/55430",
        campusId: "osogbo",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const matricError = result.error.issues.find((i) => i.path.includes("matricNumber"));
        expect(matricError).toBeDefined();
        expect(matricError?.message).toContain("Do not include the 'UNIOSUN/' prefix");
        expect(matricError?.message).toContain("2024/55430");
      }
    });

    it("accepts canonical format '2024/55430' and 4-digit sequence '2024/5543'", () => {
      expect(normalizeMatricNumber("2024/55430")).toBe("2024/55430");
      expect(normalizeMatricNumber("2024/5543")).toBe("2024/5543");
      expect(normalizeMatricNumber("2021/123456")).toBe("2021/123456");
      expect(MATRIC_NUMBER_PATTERN.test(normalizeMatricNumber("2024/55430"))).toBe(true);
      expect(MATRIC_NUMBER_PATTERN.test(normalizeMatricNumber("2024/5543"))).toBe(true);
    });

    it("normalizes hyphens and internal whitespace to canonical slash format", () => {
      expect(normalizeMatricNumber("2024-55430")).toBe("2024/55430");
      expect(normalizeMatricNumber(" 2024 / 55430 ")).toBe("2024/55430");
      expect(normalizeMatricNumber("2024 - 55430")).toBe("2024/55430");
      expect(MATRIC_NUMBER_PATTERN.test(normalizeMatricNumber(" 2024 / 55430 "))).toBe(true);
    });

    it("rejects invalid formats, short years, or excessive digits via pattern", () => {
      expect(MATRIC_NUMBER_PATTERN.test(normalizeMatricNumber("24/55430"))).toBe(false);
      expect(MATRIC_NUMBER_PATTERN.test(normalizeMatricNumber("2024/55"))).toBe(false);
      expect(MATRIC_NUMBER_PATTERN.test(normalizeMatricNumber("2024/1234567"))).toBe(false);
      expect(MATRIC_NUMBER_PATTERN.test(normalizeMatricNumber("ABC/2024/55430"))).toBe(false);
    });
  });

  describe("Invariant 4: Public signup roles & system-controlled fields", () => {
    it("public roles are strictly student, staff, or vendor; admin is rejected", () => {
      const student = StudentSignUpSchema.safeParse({
        email: "test@gmail.com",
        password: "Password123!",
        name: "Test User",
        phone: "08012345678",
        role: "admin", // Attempted admin role
        matricNumber: "2024/55430",
        campusId: "osogbo",
      });
      expect(student.success).toBe(false);

      const staff = StaffSignUpSchema.safeParse({
        email: "test@gmail.com",
        password: "Password123!",
        name: "Test Staff",
        phone: "08012345678",
        role: "admin",
        staffId: "STF/1234",
        department: "Computer Science",
      });
      expect(staff.success).toBe(false);

      const vendor = VendorSignUpSchema.safeParse({
        email: "test@gmail.com",
        password: "Password123!",
        name: "Test Vendor",
        phone: "08012345678",
        role: "admin",
        businessName: "Downtown Tech",
      });
      expect(vendor.success).toBe(false);
    });

    it("sellerStatus and accountStatus are not accepted from public client inputs", () => {
      const parsed = StudentSignUpSchema.parse({
        email: "test@gmail.com",
        password: "Password123!",
        name: "Test User",
        phone: "08012345678",
        role: "student",
        matricNumber: "2024/55430",
        campusId: "osogbo",
        // Extra injection attempt
        sellerStatus: "approved",
        accountStatus: "active",
      } as any);

      expect((parsed as any).sellerStatus).toBeUndefined();
      expect((parsed as any).accountStatus).toBeUndefined();
    });
  });

  describe("Invariant 5: Listing lifecycle statuses", () => {
    it("allows only the six permitted listing statuses", () => {
      const allowed = ["draft", "pending_moderation", "published", "reserved", "sold", "archived"];
      expect([...ListingStatusEnum.options].sort()).toEqual(allowed.sort());

      for (const status of allowed) {
        expect(ListingStatusEnum.safeParse(status).success).toBe(true);
      }
    });

    it("strictly rejects 'active' or any unapproved status", () => {
      expect(ListingStatusEnum.safeParse("active").success).toBe(false);
      expect(ListingStatusEnum.safeParse("inactive").success).toBe(false);
      expect(ListingStatusEnum.safeParse("pending").success).toBe(false);
    });
  });

  describe("Invariant 7: Seed guard requires ALLOW_SEED=1 and exact dev host match", () => {
    it("refuses seed execution when ALLOW_SEED != 1", () => {
      expect(() =>
        assertSafeSeedEnvironment({
          databaseUrl: "postgresql://dev:secret@ep-shiny-credit-baedn5p1-pooler.c-8.eu-central-1.aws.neon.tech/neondb",
          allowSeed: undefined,
          nodeEnv: "development",
        })
      ).toThrow(/requires explicit ALLOW_SEED=1/);
    });

    it("refuses seed execution against production host even with ALLOW_SEED=1", () => {
      expect(() =>
        assertSafeSeedEnvironment({
          databaseUrl: "postgresql://prod:secret@ep-noisy-fog-bafy7lrh-pooler.c-8.eu-central-1.aws.neon.tech/neondb",
          allowSeed: "1",
          nodeEnv: "development",
        })
      ).toThrow(/matches production database/);
    });

    it("refuses seed execution against unknown Neon hosts", () => {
      expect(() =>
        assertSafeSeedEnvironment({
          databaseUrl: "postgresql://unknown:secret@ep-attacker-cluster-1234.c-8.eu-central-1.aws.neon.tech/neondb",
          allowSeed: "1",
          nodeEnv: "development",
          allowedDevHosts: ["ep-shiny-credit-baedn5p1-pooler.c-8.eu-central-1.aws.neon.tech"],
        })
      ).toThrow(/not on the dev allowlist/);
    });

    it("allows seed execution when host exactly matches configured dev host allowlist", () => {
      expect(() =>
        assertSafeSeedEnvironment({
          databaseUrl: "postgresql://dev:secret@ep-shiny-credit-baedn5p1-pooler.c-8.eu-central-1.aws.neon.tech/neondb",
          allowSeed: "1",
          nodeEnv: "development",
          allowedDevHosts: ["ep-shiny-credit-baedn5p1-pooler.c-8.eu-central-1.aws.neon.tech"],
        })
      ).not.toThrow();
    });
  });

  describe("Invariant 8: Student emails are personal; no institution restriction", () => {
    it("accepts generic webmail providers for students", () => {
      const emails = ["student@gmail.com", "seller@yahoo.com", "user@outlook.com", "student@icloud.com"];
      for (const email of emails) {
        const res = StudentSignUpSchema.safeParse({
          email,
          password: "Password123!",
          name: "Test Student",
          phone: "08012345678",
          role: "student",
          matricNumber: "2024/55430",
          campusId: "osogbo",
        });
        expect(res.success).toBe(true);
      }
    });
  });
});
