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
 * Single exported matric number regex and example format.
 * Format is YYYY/NNNNN (e.g. 2024/55430), NOT UNIOSUN/2024/55430.
 */
export const MATRIC_NUMBER_PATTERN = /^\d{4}\/\d{4,6}$/;
export const MATRIC_NUMBER_EXAMPLE = "2024/55430";

/**
 * Normalizes a matric number:
 * - trim leading/trailing whitespace
 * - treat \, -, and spaces around the separator as /
 * - collapse any remaining whitespace
 */
export function normalizeMatricNumber(matric: string): string {
  return matric
    .trim()
    .replace(/\s*([\\/\-])\s*/g, "/")
    .replace(/\s+/g, "");
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
    .superRefine((val, ctx) => {
      const trimmed = val.trim();
      if (/^UNIOSUN/i.test(trimmed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Do not include the 'UNIOSUN/' prefix. Example: ${MATRIC_NUMBER_EXAMPLE}`,
        });
        return;
      }
      const normalized = normalizeMatricNumber(trimmed);
      if (!MATRIC_NUMBER_PATTERN.test(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid matric number format. Example: ${MATRIC_NUMBER_EXAMPLE}`,
        });
        return;
      }
    })
    .transform((val) => normalizeMatricNumber(val)),
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

/**
 * Normalizes location names: trims leading/trailing whitespace and collapses internal multiple spaces.
 */
export function normalizeLocationName(name: string): string {
  if (!name) return "";
  return name.trim().replace(/\s+/g, " ");
}

const PHONE_PATTERN = /(?:\+?234|0)?[789][01]\d{8}/;
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s]+|\b[a-zA-Z0-9-]+\.(?:com|ng|edu|org|net|gov|app|io|co)\b/i;

/**
 * Checks whether a text contains phone numbers or sequential digits likely to be phone numbers.
 */
export function containsPhoneNumber(text: string): boolean {
  if (PHONE_PATTERN.test(text.replace(/[\s-]/g, ""))) return true;
  const digitsOnly = text.replace(/\D/g, "");
  return digitsOnly.length >= 7;
}

/**
 * Checks whether a text contains a URL or domain reference.
 */
export function containsUrl(text: string): boolean {
  return URL_PATTERN.test(text);
}

export const LocationTypeSchema = z.enum(["campus", "student_area", "custom"]);

export const CreateLocationSchema = z.object({
  campusId: z.string().trim().min(1, "Campus ID is required"),
  name: z
    .string()
    .transform(normalizeLocationName)
    .pipe(
      z
        .string()
        .min(3, "Location name must be at least 3 characters")
        .max(80, "Location name cannot exceed 80 characters")
        .refine((val) => !containsPhoneNumber(val), {
          message: "Location name cannot contain phone numbers",
        })
        .refine((val) => !containsUrl(val), {
          message: "Location name cannot contain web links or URLs",
        })
    ),
});
export type CreateLocationInput = z.infer<typeof CreateLocationSchema>;

export const LocationAutocompleteQuerySchema = z.object({
  q: z
    .string()
    .max(80, "Search query cannot exceed 80 characters")
    .optional()
    .default(""),
  campusId: z.string().trim().optional(),
});
export type LocationAutocompleteQuery = z.infer<typeof LocationAutocompleteQuerySchema>;
