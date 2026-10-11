import { z } from "zod";

export const RoleEnum = z.enum(["student", "staff", "vendor", "admin"]);
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
export const ListingStatusEnum = z.enum([
  "draft",
  "pending_moderation",
  "published",
  "reserved",
  "sold",
  "archived",
]);

export const SignUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: RoleEnum.default("student"),
  matricNumber: z.string().optional(),
});
export type SignUpInput = z.infer<typeof SignUpSchema>;

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const CreateListingSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().min(10, "Description must be at least 10 characters"),
  price: z.number().positive("Price must be greater than 0"),
  isNegotiable: z.boolean().default(false),
  categoryId: z.string().min(1, "Category is required"),
  condition: z.string().min(1, "Condition is required"),
  locationId: z.string().min(1, "Location is required"),
  quantity: z.number().int().positive().default(1),
  photos: z.array(z.string().url()).min(1, "At least 1 photo is required").max(5),
});
export type CreateListingInput = z.infer<typeof CreateListingSchema>;

export const CreatePurchaseRequestSchema = z.object({
  listingId: z.string().min(1),
  requestedQuantity: z.number().int().positive().default(1),
  offerPrice: z.number().positive().optional(),
});
export type CreatePurchaseRequestInput = z.infer<typeof CreatePurchaseRequestSchema>;
