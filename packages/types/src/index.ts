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

export type AccountStatus = "active" | "suspended" | "banned";

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role: Role;
  phone?: string | null;
  matricNumber?: string | null;
  sellerStatus: SellerStatus;
  accountStatus: AccountStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
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

export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  service: string;
  version: string;
  database?: {
    connected: boolean;
  };
}
