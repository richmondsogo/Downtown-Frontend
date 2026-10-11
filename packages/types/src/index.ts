export type Role = "student" | "staff" | "vendor" | "admin";

export type SellerStatus =
  | "not_a_seller"
  | "pending_verification"
  | "verified"
  | "suspended"
  | "banned";

export type SellerType =
  | "student_individual"
  | "student_vendor"
  | "staff"
  | "vendor";

export interface User {
  id: string;
  role: Role;
  email: string;
  phone?: string | null;
  displayName: string;
  emailVerifiedAt?: Date | string | null;
  createdAt: Date | string;
}

export interface SellerProfile {
  userId: string;
  sellerType: SellerType;
  sellerStatus: SellerStatus;
  businessName?: string | null;
  businessCategory?: string | null;
  bio?: string | null;
  verifiedAt?: Date | string | null;
}

export type ListingStatus =
  | "draft"
  | "pending_moderation"
  | "published"
  | "reserved"
  | "sold"
  | "archived";

export interface Listing {
  id: string;
  sellerId: string;
  categoryId: string;
  title: string;
  description: string;
  price: number;
  isNegotiable: boolean;
  condition: string;
  locationId: string;
  quantityAvailable: number;
  quantityReserved: number;
  photos: string[];
  status: ListingStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type PurchaseRequestStatus =
  | "pending"
  | "completed"
  | "disputed"
  | "expired"
  | "cancelled";

export interface PurchaseRequest {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  requestedQuantity: number;
  unitPrice: number;
  offerPrice?: number | null;
  status: PurchaseRequestStatus;
  createdAt: Date | string;
  expiresAt: Date | string;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  service: string;
  version: string;
  database?: {
    connected: boolean;
  };
}
