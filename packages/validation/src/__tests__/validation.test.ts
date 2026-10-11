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
} from "../index";

describe("Validation: normalizeMatricNumber", () => {
  it("collapses internal whitespace, trims, and converts to uppercase", () => {
    expect(normalizeMatricNumber("  uniosun / 2024 / 1234  ")).toBe("UNIOSUN/2024/1234");
    expect(normalizeMatricNumber("law \t 2021 \n 001")).toBe("LAW2021001");
    expect(normalizeMatricNumber("set-2022-999")).toBe("SET-2022-999");
  });
});

describe("Validation: SignUpSchema", () => {
  it("validates and normalizes valid student signup", () => {
    const input = {
      role: "student",
      name: "Tunde Bakare",
      email: "tunde.bakare@example.com",
      matricNumber: " uniosun / 2023 / 54321 ",
      password: "StrongPassword123",
    };

    const parsed = SignUpSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.role).toBe("student");
      expect((parsed.data as any).matricNumber).toBe("UNIOSUN/2023/54321");
      expect(parsed.data.email).toBe("tunde.bakare@example.com");
    }
  });

  it("fails student signup when matricNumber is missing", () => {
    const input = {
      role: "student",
      name: "Tunde Bakare",
      email: "tunde@example.com",
      password: "StrongPassword123",
    };

    const parsed = SignUpSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it("fails student signup when matricNumber format has invalid characters", () => {
    const input = {
      role: "student",
      name: "Tunde Bakare",
      email: "tunde@example.com",
      matricNumber: "UNIOSUN$#@!*",
      password: "StrongPassword123",
    };

    const parsed = SignUpSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it("validates valid staff signup without matricNumber", () => {
    const input = {
      role: "staff",
      name: "Dr. Adeyemi Adeleke",
      email: "a.adeleke@example.com",
      password: "StaffSecretPassword456",
    };

    const parsed = SignUpSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.role).toBe("staff");
    }
  });

  it("validates valid vendor signup without matricNumber", () => {
    const input = {
      role: "vendor",
      name: "Mama Put Special Bites",
      email: "mamaput@example.com",
      password: "VendorPassword789",
    };

    const parsed = SignUpSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.role).toBe("vendor");
    }
  });

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

  it("enforces password minimum length of 8", () => {
    const input = {
      role: "staff",
      name: "Staff Person",
      email: "staff@example.com",
      password: "short",
    };

    const parsed = SignUpSchema.safeParse(input);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message.includes("at least 8"))).toBe(true);
    }
  });

  it("enforces password maximum length of 128", () => {
    const input = {
      role: "staff",
      name: "Staff Person",
      email: "staff@example.com",
      password: "a".repeat(129),
    };

    const parsed = SignUpSchema.safeParse(input);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message.includes("128 characters"))).toBe(true);
    }
  });
});

describe("Validation: LoginSchema", () => {
  it("validates valid login input", () => {
    const parsed = LoginSchema.safeParse({
      email: "user@example.com",
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
    expect(VerifyOtpSchema.safeParse({ email: "test@example.com", otp: "123456" }).success).toBe(true);
    expect(VerifyOtpSchema.safeParse({ email: "test@example.com", otp: "000123" }).success).toBe(true);
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
