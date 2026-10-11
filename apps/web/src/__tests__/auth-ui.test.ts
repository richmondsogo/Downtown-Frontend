import { describe, it, expect } from "vitest";
import {
  isValidReturnTo,
  SignUpSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyOtpSchema,
} from "@downtown/validation";

describe("Web Auth & Safety UI Contract Tests", () => {
  describe("1. Open Redirect & returnTo Protection", () => {
    it("permits safe same-origin relative paths", () => {
      expect(isValidReturnTo("/")).toBe(true);
      expect(isValidReturnTo("/listings/macbook-air")).toBe(true);
      expect(isValidReturnTo("/deals?tab=active&order=desc")).toBe(true);
      expect(isValidReturnTo("/profile/settings#notifications")).toBe(true);
    });

    it("STRICTLY REJECTS external protocols and open redirect attacks", () => {
      expect(isValidReturnTo("https://evil.com")).toBe(false);
      expect(isValidReturnTo("http://attacker.com/steal-token")).toBe(false);
      expect(isValidReturnTo("//malicious.com")).toBe(false);
      expect(isValidReturnTo("/\\evil.com")).toBe(false);
      expect(isValidReturnTo("javascript:alert(1)")).toBe(false);
      expect(isValidReturnTo("data:text/html,attack")).toBe(false);
      expect(isValidReturnTo(null)).toBe(false);
      expect(isValidReturnTo(undefined)).toBe(false);
      expect(isValidReturnTo("")).toBe(false);
    });
  });

  describe("2. Client-side Role Validation Rules", () => {
    it("Student registration requires valid matric number", () => {
      // Missing matric
      const resMissing = SignUpSchema.safeParse({
        role: "student",
        name: "Bolaji",
        email: "bolaji@example.com",
        password: "ValidPassword123!",
      });
      expect(resMissing.success).toBe(false);

      // Invalid format (too short)
      const resInvalid = SignUpSchema.safeParse({
        role: "student",
        name: "Bolaji",
        email: "bolaji@example.com",
        matricNumber: "inv",
        password: "ValidPassword123!",
      });
      expect(resInvalid.success).toBe(false);

      // Valid matric with whitespace and separator variations
      const resValid = SignUpSchema.safeParse({
        role: "student",
        name: "Bolaji",
        email: "bolaji@gmail.com",
        matricNumber: " 2024 - 55430 ",
        password: "ValidPassword123!",
      });
      expect(resValid.success).toBe(true);
      if (resValid.success && resValid.data.role === "student") {
        expect(resValid.data.matricNumber).toBe("2024/55430");
      }

      // Rejects UNIOSUN/ prefix
      const resPrefix = SignUpSchema.safeParse({
        role: "student",
        name: "Bolaji",
        email: "bolaji@gmail.com",
        matricNumber: "UNIOSUN/2024/55430",
        password: "ValidPassword123!",
      });
      expect(resPrefix.success).toBe(false);
    });

    it("Staff and Vendor registration do not accept or require matric numbers", () => {
      const resStaff = SignUpSchema.safeParse({
        role: "staff",
        name: "Prof. Adeleke",
        email: "adeleke@uniosun.edu.ng",
        password: "ValidPassword123!",
      });
      expect(resStaff.success).toBe(true);
      if (resStaff.success) {
        expect((resStaff.data as any).matricNumber).toBeUndefined();
      }

      const resVendor = SignUpSchema.safeParse({
        role: "vendor",
        name: "Campus Tech Store",
        email: "store@example.com",
        password: "ValidPassword123!",
      });
      expect(resVendor.success).toBe(true);
      if (resVendor.success) {
        expect((resVendor.data as any).matricNumber).toBeUndefined();
      }
    });

    it("Admin role is strictly forbidden in client signup schema", () => {
      const resAdmin = SignUpSchema.safeParse({
        role: "admin",
        name: "Intruder",
        email: "hacker@evil.com",
        password: "Password123!",
      });
      expect(resAdmin.success).toBe(false);
    });
  });

  describe("3. 6-Digit Email OTP Constraints", () => {
    it("enforces strict 6-digit numerical format", () => {
      expect(
        VerifyOtpSchema.safeParse({
          email: "user@example.com",
          otp: "123456",
        }).success
      ).toBe(true);

      expect(
        VerifyOtpSchema.safeParse({
          email: "user@example.com",
          otp: "12345", // 5 digits
        }).success
      ).toBe(false);

      expect(
        VerifyOtpSchema.safeParse({
          email: "user@example.com",
          otp: "1234567", // 7 digits
        }).success
      ).toBe(false);

      expect(
        VerifyOtpSchema.safeParse({
          email: "user@example.com",
          otp: "abcdef", // non-numeric
        }).success
      ).toBe(false);
    });
  });

  describe("4. Password Length & Security Policies", () => {
    it("enforces minimum 8 and maximum 128 characters", () => {
      const short = ResetPasswordSchema.safeParse({
        token: "sample-token",
        newPassword: "short",
      });
      expect(short.success).toBe(false);

      const valid = ResetPasswordSchema.safeParse({
        token: "sample-token",
        newPassword: "SecurePassword123!",
      });
      expect(valid.success).toBe(true);

      const tooLong = ResetPasswordSchema.safeParse({
        token: "sample-token",
        newPassword: "a".repeat(129),
      });
      expect(tooLong.success).toBe(false);
    });
  });
});
