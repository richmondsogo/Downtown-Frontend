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

/**
 * Maximum listing price in Nigerian Naira (₦50,000,000).
 */
export const MAX_LISTING_PRICE_NAIRA = 50_000_000;

export const ListingStatusEnum = z.enum([
  "draft",
  "pending_moderation",
  "published",
  "reserved",
  "sold",
  "archived",
]);
export type ListingStatus = z.infer<typeof ListingStatusEnum>;

export const ListingConditionEnum = z.enum(["new", "like_new", "good", "fair"]);
export type ListingCondition = z.infer<typeof ListingConditionEnum>;

export type CategoryConditionRequirement =
  | "required"
  | "not_applicable"
  | "optional";

/**
 * Single source of truth configuration map for category condition requirements.
 * Default:
 * - required: Electronics, Fashion & Accessories, Home & Living, Books & Study Materials, Beauty & Personal Care
 * - not_applicable: Food & Drinks, Services, Tickets & Events
 * - optional: Other
 */
export const CATEGORY_CONDITION_RULES: Record<string, CategoryConditionRequirement> = {
  // Slugs
  "electronics": "required",
  "fashion-accessories": "required",
  "home-living": "required",
  "books-study-materials": "required",
  "beauty-personal-care": "required",
  "food-drinks": "not_applicable",
  "services": "not_applicable",
  "tickets-events": "not_applicable",
  "other": "optional",
  // IDs
  "cat_electronics": "required",
  "cat_fashion_accessories": "required",
  "cat_home_living": "required",
  "cat_books_study_materials": "required",
  "cat_beauty_personal_care": "required",
  "cat_food_drinks": "not_applicable",
  "cat_services": "not_applicable",
  "cat_tickets_events": "not_applicable",
  "cat_other": "optional",
  // Names
  "Electronics": "required",
  "Fashion & Accessories": "required",
  "Home & Living": "required",
  "Books & Study Materials": "required",
  "Beauty & Personal Care": "required",
  "Food & Drinks": "not_applicable",
  "Services": "not_applicable",
  "Tickets & Events": "not_applicable",
  "Other": "optional",
};

export function getCategoryConditionRequirement(
  categoryIdentifier: string
): CategoryConditionRequirement {
  return CATEGORY_CONDITION_RULES[categoryIdentifier] ?? "optional";
}

/**
 * Allowed status transitions for Step 04.
 * draft -> pending_moderation -> published (when clean) or stay pending_moderation (flagged).
 * published -> pending_moderation (on high-risk edit).
 * Reserved/Sold come in Steps 07-08.
 */
export const ALLOWED_LISTING_TRANSITIONS: Record<
  ListingStatus,
  readonly ListingStatus[]
> = {
  draft: ["pending_moderation"],
  pending_moderation: ["published"],
  published: ["pending_moderation"],
  reserved: [],
  sold: [],
  archived: [],
};

export function isAllowedListingTransition(
  from: ListingStatus,
  to: ListingStatus
): boolean {
  if (from === to) return true;
  return ALLOWED_LISTING_TRANSITIONS[from]?.includes(to) ?? false;
}

export const DraftListingSchema = z.object({
  title: z.string().trim().max(100).optional().default(""),
  description: z.string().trim().max(2000).optional().default(""),
  price: z
    .number()
    .int("Price must be a whole integer in Naira")
    .min(1, "Price must be at least ₦1")
    .max(MAX_LISTING_PRICE_NAIRA, `Price cannot exceed ₦${MAX_LISTING_PRICE_NAIRA.toLocaleString()}`)
    .optional()
    .nullable(),
  isNegotiable: z.boolean().optional().default(false),
  categoryId: z.string().trim().optional().nullable(),
  condition: ListingConditionEnum.optional().nullable(),
  locationId: z.string().trim().optional().nullable(),
  quantityAvailable: z
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(999, "Quantity cannot exceed 999")
    .optional()
    .default(1),
  photoIds: z.array(z.string().trim()).max(5, "Maximum 5 photos allowed").optional().default([]),
});
export type DraftListingInput = z.input<typeof DraftListingSchema>;

export const SubmitListingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title cannot exceed 100 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description cannot exceed 2000 characters")
    .optional()
    .default(""),
  price: z
    .number({ required_error: "Price is required" })
    .int("Price must be a whole integer in Naira")
    .min(1, "Price must be at least ₦1")
    .max(MAX_LISTING_PRICE_NAIRA, `Price cannot exceed ₦${MAX_LISTING_PRICE_NAIRA.toLocaleString()}`),
  isNegotiable: z.boolean().optional().default(false),
  categoryId: z.string().trim().min(1, "Category is required"),
  condition: ListingConditionEnum.optional().nullable(),
  locationId: z.string().trim().min(1, "Location is required"),
  quantityAvailable: z
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(999, "Quantity cannot exceed 999")
    .optional()
    .default(1),
  photoIds: z
    .array(z.string().trim())
    .min(1, "At least 1 photo is required")
    .max(5, "Maximum 5 photos allowed"),
});
export type SubmitListingInput = z.input<typeof SubmitListingSchema>;

export const UpdateListingSchema = z.object({
  title: z.string().trim().min(3).max(100).optional(),
  description: z.string().trim().max(2000).optional(),
  price: z.number().int().min(1).max(MAX_LISTING_PRICE_NAIRA).optional(),
  isNegotiable: z.boolean().optional(),
  categoryId: z.string().trim().min(1).optional(),
  condition: ListingConditionEnum.optional().nullable(),
  locationId: z.string().trim().min(1).optional(),
  quantityAvailable: z.number().int().min(1).max(999).optional(),
  photoIds: z.array(z.string().trim()).min(1).max(5).optional(),
});
export type UpdateListingInput = z.infer<typeof UpdateListingSchema>;

/**
 * Determines whether an edit constitutes a high-risk change.
 * High-risk fields per SRS 5.5: price, category, photos, title, condition.
 * Low-risk fields: description wording, location.
 */
export function isHighRiskListingEdit(
  original: {
    title: string;
    price: number;
    categoryId: string;
    condition?: string | null;
    photoIds?: string[];
  },
  changes: Partial<UpdateListingInput>
): boolean {
  if (changes.title !== undefined && changes.title !== original.title) return true;
  if (changes.price !== undefined && changes.price !== original.price) return true;
  if (changes.categoryId !== undefined && changes.categoryId !== original.categoryId) return true;
  if (changes.condition !== undefined && changes.condition !== original.condition) return true;
  if (changes.photoIds !== undefined) {
    const orig = original.photoIds ?? [];
    if (orig.length !== changes.photoIds.length || orig.some((p, i) => p !== changes.photoIds?.[i])) {
      return true;
    }
  }
  return false;
}

export const SearchSortOptionEnum = z.enum([
  "relevance",
  "newest",
  "price_asc",
  "price_desc",
]);
export type SearchSortOption = z.infer<typeof SearchSortOptionEnum>;

export const SearchAvailabilityFilterEnum = z.enum(["all", "in_stock"]);
export type SearchAvailabilityFilter = z.infer<typeof SearchAvailabilityFilterEnum>;

export const SearchQuerySchema = z.object({
  q: z.string().trim().max(80, "Search query cannot exceed 80 characters").optional(),
  categoryId: z.string().trim().min(1).optional(),
  minPrice: z.coerce.number().int().min(0, "Minimum price must be non-negative").max(MAX_LISTING_PRICE_NAIRA).optional(),
  maxPrice: z.coerce.number().int().min(0).max(MAX_LISTING_PRICE_NAIRA).optional(),
  condition: z
    .union([
      ListingConditionEnum,
      z.array(ListingConditionEnum),
      z.string().transform((v) => v.split(",").map((s) => s.trim())),
    ])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const arr = Array.isArray(val) ? val : [val];
      return arr.filter((c): c is ListingCondition => ["new", "like_new", "good", "fair"].includes(c));
    }),
  locationId: z.string().trim().min(1).optional(),
  campusId: z.string().trim().min(1).optional(),
  verifiedOnly: z
    .union([z.boolean(), z.string().transform((v) => v === "true" || v === "1")])
    .optional(),
  availability: z.enum(["all", "in_stock"]).default("all"),
  sort: z.enum(["relevance", "newest", "price_asc", "price_desc"]).default("relevance"),
  cursor: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(30).default(20),
});
export type SearchQueryInput = z.infer<typeof SearchQuerySchema>;

export const SuggestQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, "Suggestion query must be at least 2 characters")
    .max(80, "Query cannot exceed 80 characters"),
});
export type SuggestQueryInput = z.infer<typeof SuggestQuerySchema>;

/**
 * Canonical lifecycle eligibility function for marketplace discovery.
 * - published: discoverable in home feed, category browsing, and search.
 * - reserved: discoverable in home feed, category browsing, and search; ranked below published.
 * - sold: discoverable ONLY when an explicit keyword is present (isSearchQuery = true) AND availability filter != "in_stock".
 * - draft, pending_moderation, archived: NEVER discoverable under any circumstance.
 */
export function isListingDiscoverable(
  status: string,
  isSearchQuery: boolean = false,
  availabilityFilter: string = "all"
): boolean {
  if (status === "draft" || status === "pending_moderation" || status === "archived") {
    return false;
  }
  if (status === "published") {
    return true;
  }
  if (status === "reserved") {
    return true;
  }
  if (status === "sold") {
    if (!isSearchQuery) return false;
    if (availabilityFilter === "in_stock" || availabilityFilter === "available") return false;
    return true;
  }
  return false;
}


