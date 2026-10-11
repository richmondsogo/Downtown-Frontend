import { describe, it, expect } from "vitest";
import {
  SignUpSchema,
  StudentSignUpSchema,
  StaffSignUpSchema,
  VendorSignUpSchema,
  LoginSchema,
  VerifyOtpSchema,
  normalizeMatricNumber,
  isValidReturnTo,
  ReturnToSchema,
  MATRIC_NUMBER_PATTERN,
  MATRIC_NUMBER_EXAMPLE,
} from "../index";

describe("Validation: normalizeMatricNumber", () => {
  it("normalizes matric numbers: trims, converts \\ - and spaced separators into /", () => {
    expect(normalizeMatricNumber("  2024 / 55430  ")).toBe("2024/55430");
    expect(normalizeMatricNumber("2024 - 55430")).toBe("2024/55430");
    expect(normalizeMatricNumber("2024\\55430")).toBe("2024/55430");
    expect(normalizeMatricNumber(" 2024-55430 ")).toBe("2024/55430");
    expect(normalizeMatricNumber("  2024   /   1234  ")).toBe("2024/1234");
  });
});

describe("Validation: SignUpSchema & Matric Validation", () => {
  it("validates and normalizes valid student signup with YYYY/NNNNN format", () => {
    const input = {
      role: "student",
      name: "Tunde Bakare",
      email: "tunde.bakare@gmail.com",
      matricNumber: " 2024 - 55430 ",
      password: "StrongPassword123",
    };

    const parsed = SignUpSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.role).toBe("student");
      expect((parsed.data as any).matricNumber).toBe("2024/55430");
      expect(parsed.data.email).toBe("tunde.bakare@gmail.com");
    }
  });

  it("accepts 4 to 6 digit sequence numbers in matric", () => {
    expect(
      StudentSignUpSchema.safeParse({
        role: "student",
        name: "Test Student",
        email: "test4@gmail.com",
        matricNumber: "2024/1234",
        password: "StrongPassword123",
      }).success
    ).toBe(true);

    expect(
      StudentSignUpSchema.safeParse({
        role: "student",
        name: "Test Student",
        email: "test6@gmail.com",
        matricNumber: "2024/123456",
        password: "StrongPassword123",
      }).success
    ).toBe(true);
  });

  it("STRICTLY REJECTS UNIOSUN/ prefix with helpful error containing example", () => {
    const testCases = [
      "UNIOSUN/2024/55430",
      "uniosun/2024/55430",
      "UNIOSUN-2024-55430",
      "UNIOSUN\\2024\\55430",
    ];

    for (const matricNumber of testCases) {
      const parsed = StudentSignUpSchema.safeParse({
        role: "student",
        name: "Tunde Bakare",
        email: "tunde@gmail.com",
        matricNumber,
        password: "StrongPassword123",
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find((i) =>
          i.message.includes("Do not include the 'UNIOSUN/' prefix")
        );
        expect(issue).toBeDefined();
        expect(issue?.message).toContain(MATRIC_NUMBER_EXAMPLE);
      }
    }
  });

  it("fails student signup when matricNumber format has invalid year or digits", () => {
    const invalidMatrics = [
      "24/55430", // 2-digit year
      "2024/123", // only 3 digits sequence
      "2024/1234567", // 7 digits sequence
      "2024$55430", // invalid separator
      "abcd/55430", // non-digits
    ];

    for (const matricNumber of invalidMatrics) {
      const parsed = StudentSignUpSchema.safeParse({
        role: "student",
        name: "Tunde Bakare",
        email: "tunde@gmail.com",
        matricNumber,
        password: "StrongPassword123",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain(MATRIC_NUMBER_EXAMPLE);
      }
    }
  });

  it("fails student signup when matricNumber is missing", () => {
    const input = {
      role: "student",
      name: "Tunde Bakare",
      email: "tunde@gmail.com",
      password: "StrongPassword123",
    };

    const parsed = SignUpSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });
});

describe("Validation: Personal Email Support (Gmail, etc.)", () => {
  it("accepts Gmail and personal email for student signup", () => {
    const parsed = StudentSignUpSchema.safeParse({
      role: "student",
      name: "Student Gmail",
      email: "student.personal@gmail.com",
      matricNumber: "2024/55430",
      password: "StrongPassword123",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts Gmail and personal email for staff signup", () => {
    const parsed = StaffSignUpSchema.safeParse({
      role: "staff",
      name: "Staff Gmail",
      email: "staff.personal@gmail.com",
      password: "StrongPassword123",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts Gmail and personal email for vendor signup", () => {
    const parsed = VendorSignUpSchema.safeParse({
      role: "vendor",
      name: "Vendor Gmail",
      email: "vendor.personal@gmail.com",
      password: "StrongPassword123",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("Validation: Security & Roles", () => {
  it("STRICTLY REJECTS admin role at signup", () => {
    const input = {
      role: "admin",
      name: "Admin Attacker",
      email: "admin@example.com",
      password: "SuperSecretPassword123",
    };

    const parsed = SignUpSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown arbitrary roles", () => {
    const input = {
      role: "moderator",
      name: "Mod User",
      email: "mod@example.com",
      password: "ModPassword123",
    };

    const parsed = SignUpSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it("enforces password minimum length of 8 and max of 128", () => {
    expect(
      StaffSignUpSchema.safeParse({
        role: "staff",
        name: "Staff Person",
        email: "staff@example.com",
        password: "short",
      }).success
    ).toBe(false);

    expect(
      StaffSignUpSchema.safeParse({
        role: "staff",
        name: "Staff Person",
        email: "staff@example.com",
        password: "a".repeat(129),
      }).success
    ).toBe(false);
  });
});

describe("Validation: LoginSchema", () => {
  it("validates valid login input", () => {
    const parsed = LoginSchema.safeParse({
      email: "user@gmail.com",
      password: "MySecretPassword123",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid email and empty password", () => {
    expect(LoginSchema.safeParse({ email: "invalid-email", password: "123" }).success).toBe(false);
    expect(LoginSchema.safeParse({ email: "user@example.com", password: "" }).success).toBe(false);
  });
});

describe("Validation: VerifyOtpSchema", () => {
  it("accepts exactly 6 numeric digits", () => {
    expect(VerifyOtpSchema.safeParse({ email: "test@gmail.com", otp: "123456" }).success).toBe(true);
    expect(VerifyOtpSchema.safeParse({ email: "test@gmail.com", otp: "000123" }).success).toBe(true);
  });

  it("rejects non-6-digit OTPs", () => {
    expect(VerifyOtpSchema.safeParse({ email: "test@example.com", otp: "12345" }).success).toBe(false);
    expect(VerifyOtpSchema.safeParse({ email: "test@example.com", otp: "1234567" }).success).toBe(false);
    expect(VerifyOtpSchema.safeParse({ email: "test@example.com", otp: "12345a" }).success).toBe(false);
    expect(VerifyOtpSchema.safeParse({ email: "test@example.com", otp: "abcdef" }).success).toBe(false);
  });
});

describe("Validation: isValidReturnTo & ReturnToSchema", () => {
  it("accepts valid same-origin relative paths", () => {
    expect(isValidReturnTo("/")).toBe(true);
    expect(isValidReturnTo("/listings")).toBe(true);
    expect(isValidReturnTo("/listing/123?offer=40000")).toBe(true);
    expect(isValidReturnTo("/settings/seller")).toBe(true);
    expect(ReturnToSchema.safeParse("/listings").success).toBe(true);
  });

  it("rejects open redirects and absolute/protocol-relative URLs", () => {
    expect(isValidReturnTo("https://evil.com")).toBe(false);
    expect(isValidReturnTo("http://evil.com")).toBe(false);
    expect(isValidReturnTo("//evil.com")).toBe(false);
    expect(isValidReturnTo("/\\evil.com")).toBe(false);
    expect(isValidReturnTo("javascript:alert(1)")).toBe(false);
    expect(isValidReturnTo("")).toBe(false);
    expect(isValidReturnTo(null)).toBe(false);
    expect(ReturnToSchema.safeParse("https://evil.com").success).toBe(false);
  });
});
