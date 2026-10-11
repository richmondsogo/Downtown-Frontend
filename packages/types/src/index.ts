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

export type LocationType = "campus" | "student_area" | "custom";

export interface University {
  id: string;
  name: string;
  slug: string;
  shortCode: string;
  createdAt: Date | string;
}

export interface Campus {
  id: string;
  universityId: string;
  name: string;
  slug: string;
  code: string;
  address?: string | null;
  createdAt: Date | string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date | string;
}

export interface Location {
  id: string;
  campusId: string;
  name: string;
  slug: string;
  type: LocationType;
  isCurated: boolean;
  creatorId?: string | null;
  usageCount: number;
  createdAt: Date | string;
}

export interface LocationAutocompleteItem {
  id: string;
  campusId: string;
  name: string;
  slug: string;
  type: LocationType;
  isCurated: boolean;
}

export interface CreateLocationInput {
  campusId: string;
  name: string;
}

export interface LocationAutocompleteQuery {
  q?: string;
  campusId?: string;
}
