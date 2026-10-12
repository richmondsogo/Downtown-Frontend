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

export type ListingStatus =
  | "draft"
  | "pending_moderation"
  | "published"
  | "reserved"
  | "sold"
  | "archived";

export type ListingCondition = "new" | "like_new" | "good" | "fair";

export type CategoryConditionRequirement = "required" | "not_applicable" | "optional";

export interface ListingPhoto {
  id: string;
  ownerId: string;
  listingId?: string | null;
  key: string;
  thumbKey: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  bytes: number;
  position: number;
  createdAt: Date | string;
}

export interface Listing {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  isNegotiable: boolean;
  categoryId: string;
  category?: Category;
  condition?: ListingCondition | null;
  locationId: string;
  location?: Location;
  quantityAvailable: number;
  quantityReserved: number;
  status: ListingStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
  photos?: ListingPhoto[];
}

export interface ModerationRecord {
  id: string;
  listingId: string;
  type: string;
  result: "clean" | "flagged";
  flags: string[];
  reviewedBy?: string | null;
  createdAt: Date | string;
}

export type ListingAvailability = "available" | "reserved" | "sold";

export interface PublicListingSeller {
  displayName: string;
  isVerified: boolean;
}

export interface PublicListingThumb {
  url: string;
  width: number;
  height: number;
}

export interface PublicListingCard {
  id: string;
  title: string;
  price: number;
  isNegotiable: boolean;
  condition?: ListingCondition | null;
  thumb: PublicListingThumb | null;
  locationName: string;
  campusName: string;
  campusSlug: string;
  seller: PublicListingSeller;
  availability: ListingAvailability;
  status: ListingStatus;
  createdAt: string;
}

export type SearchSortOption = "relevance" | "newest" | "price_asc" | "price_desc";
export type SearchAvailabilityFilter = "all" | "in_stock";

export interface SearchQuery {
  q?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: ListingCondition[];
  locationId?: string;
  campusId?: string;
  verifiedOnly?: boolean;
  availability?: SearchAvailabilityFilter;
  sort?: SearchSortOption;
  cursor?: string;
  limit?: number;
}

export interface SearchResultPage {
  items: PublicListingCard[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SearchSuggestion {
  title: string;
}

