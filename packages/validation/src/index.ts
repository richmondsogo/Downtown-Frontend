import { z } from "zod";

export const RoleEnum = z.enum(["student", "staff", "vendor", "admin"]);
export const SignupRoleEnum = z.enum(["student", "staff", "vendor"]);
export type SignupRole = z.infer<typeof SignupRoleEnum>;

export const SellerStatusEnum = z.enum([
  "not_a_seller",
  "pending_verification",
  "verified",
  "suspended",
  "banned",
]);

export const SellerTypeEnum = z.enum([
  "student_individual",
  "student_vendor",
  "staff",
  "vendor",
]);

export const AccountStatusEnum = z.enum(["active", "suspended", "banned"]);

/**
 * Configurable matric number format regex.
 * Kept in packages/validation per architecture rules.
 */
export const MATRIC_NUMBER_REGEX = /^[A-Za-z0-9\/\-_]{6,25}$/;

/**
 * Normalizes a matric number by trimming, collapsing internal whitespace,
 * and converting to uppercase.
 */
export function normalizeMatricNumber(matric: string): string {
  return matric.trim().replace(/\s+/g, "").toUpperCase();
}

/**
 * Normalizes email address to lowercase and trimmed.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must not exceed 128 characters");

const BaseSignUp = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: PasswordSchema,
});

export const StudentSignUpSchema = BaseSignUp.extend({
  role: z.literal("student"),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  matricNumber: z
    .string({ required_error: "Matric number is required" })
    .trim()
    .min(1, "Matric number is required")
    .transform((val) => normalizeMatricNumber(val))
    .refine((val) => MATRIC_NUMBER_REGEX.test(val), {
      message: "Invalid matric number format",
    }),
});

export const StaffSignUpSchema = BaseSignUp.extend({
  role: z.literal("staff"),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
});

export const VendorSignUpSchema = BaseSignUp.extend({
  role: z.literal("vendor"),
  name: z
    .string()
    .trim()
    .min(2, "Name or business name must be at least 2 characters")
    .max(100),
});

export const SignUpSchema = z.discriminatedUnion("role", [
  StudentSignUpSchema,
  StaffSignUpSchema,
  VendorSignUpSchema,
]);

export type SignUpInput = z.infer<typeof SignUpSchema>;
export type StudentSignUpInput = z.infer<typeof StudentSignUpSchema>;
export type StaffSignUpInput = z.infer<typeof StaffSignUpSchema>;
export type VendorSignUpInput = z.infer<typeof VendorSignUpSchema>;

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required").max(128),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const VerifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Verification code must be 6 digits"),
});
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;

export const ResendOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
});
export type ResendOtpInput = z.infer<typeof ResendOtpSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: PasswordSchema,
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

/**
 * Validates a returnTo or callbackURL to ensure it is a safe, same-origin relative path.
 * Disallows absolute URLs, protocol-relative URLs (//), and backslash tricks.
 */
export function isValidReturnTo(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes(":")
  );
}

export const ReturnToSchema = z.string().refine(isValidReturnTo, {
  message: "returnTo must be a same-origin relative path",
});
