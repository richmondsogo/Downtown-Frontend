import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { SellerStatus } from "@downtown/types";

/**
 * Combines Tailwind classes cleanly resolving conflicts.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format currency in Nigerian Naira (₦).
 * Example: 45000 -> ₦45,000
 */
export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Single source of truth for seller capability across Downtown.
 * A user can sell if and only if their sellerStatus is strictly "verified".
 * No other seller permission logic may be defined anywhere in the codebase.
 */
export function canSell(
  user: { sellerStatus: SellerStatus } | null | undefined
): boolean {
  if (!user) return false;
  return user.sellerStatus === "verified";
}

/**
 * Formats a privacy-safe public display name for sellers:
 * - If businessName is present and non-empty, displays the business name.
 * - Otherwise for individuals, formats as First Name + Last Initial (e.g. "Richmond O.").
 * - Single-word names remain unchanged (e.g. "Richmond").
 * - Multi-part names take the first part and the initial of the last part (e.g. "Richmond Osogbo" -> "Richmond O.").
 * - Trimmed and unicode-safe.
 */
export function formatDisplayName(
  personalName: string,
  businessName?: string | null
): string {
  if (businessName && businessName.trim().length > 0) {
    return businessName.trim();
  }

  const trimmed = personalName.trim();
  if (!trimmed) return "Seller";

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0];
  }

  const firstName = parts[0];
  const lastPart = parts[parts.length - 1];
  const lastInitial = Array.from(lastPart)[0] || "";

  return `${firstName} ${lastInitial.toUpperCase()}.`;
}

/**
 * Formats a join date as Month Year (e.g. "Oct 2026").
 */
export function formatMemberSince(date: Date | string | null | undefined): string {
  if (!date) return "Recently";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Recently";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/**
 * Formats relative time friendly for listings (e.g. "2h ago", "3d ago").
 */
export function formatTimeAgo(date: Date | string | null | undefined): string {
  if (!date) return "Recently";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Recently";
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Normalizes a Nigerian mobile phone number to canonical E.164 format (+234XXXXXXXXXX).
 * Accepts:
 * - 0803..., 070..., 090..., 091...
 * - 803..., 70..., 90...
 * - +234803...
 * - 234803...
 * Handles punctuation, spaces, and dashes.
 * Ensures the first digit following +234 is strictly 7, 8, or 9.
 */
export function normalizeNigerianPhone(raw: string): string {
  if (!raw || typeof raw !== "string") {
    throw new Error("Phone number is required");
  }

  // Remove whitespace, dashes, parentheses, dots
  let cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, "");

  if (cleaned.startsWith("+234")) {
    cleaned = cleaned.slice(4);
  } else if (cleaned.startsWith("234")) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith("0")) {
    cleaned = cleaned.slice(1);
  }

  // At this point, cleaned should be exactly 10 digits
  if (!/^\d{10}$/.test(cleaned)) {
    throw new Error("Invalid Nigerian phone number length");
  }

  // First digit of the 10-digit national number must be 7, 8, or 9
  const firstDigit = cleaned[0];
  if (firstDigit !== "7" && firstDigit !== "8" && firstDigit !== "9") {
    throw new Error("Invalid Nigerian phone number prefix (must start with 7, 8, or 9)");
  }

  return `+234${cleaned}`;
}

/**
 * Checks whether an input is a valid Nigerian mobile phone number.
 */
export function isValidNigerianPhone(raw: string): boolean {
  try {
    normalizeNigerianPhone(raw);
    return true;
  } catch {
    return false;
  }
}

export interface WhatsAppMessageParams {
  sellerPhone: string;
  sellerName: string;
  listingTitle: string;
  listingUrl: string;
  quantity?: number;
  offerPrice?: number | null;
}

/**
 * Generates a pre-filled WhatsApp direct messaging URL (https://wa.me/234...?text=...).
 * - Uses exact SRS templates for standard and offer requests.
 * - If quantity > 1, appends " I need N."
 * - Uses seller first name only.
 * - Strips control characters from listing title.
 * - Formats Naira without decimals.
 * - Caps message body to 300 characters.
 */
export function generateWhatsAppUrl(params: WhatsAppMessageParams): string {
  const { sellerPhone, sellerName, listingTitle, listingUrl, quantity = 1, offerPrice } = params;

  const normalizedPhone = normalizeNigerianPhone(sellerPhone);
  const phoneDigits = normalizedPhone.replace(/^\+/, "");

  // Extract seller first name only
  const trimmedName = (sellerName || "Seller").trim();
  const sellerFirstName = trimmedName.split(/\s+/)[0] || "Seller";

  // Sanitize listing title: strip control characters and newlines
  const cleanTitle = (listingTitle || "").replace(/[\r\n\t]/g, " ").trim();

  // Quantity suffix amendment
  const quantitySuffix = quantity > 1 ? ` I need ${quantity}.` : "";

  // Template construction
  let baseTemplate: (title: string) => string;
  if (offerPrice && offerPrice > 0) {
    const formattedOffer = offerPrice.toLocaleString("en-NG");
    baseTemplate = (t) =>
      `Hello ${sellerFirstName}, I saw your listing for "${t}" on Downtown (${listingUrl}). Would you accept ₦${formattedOffer} for it?${quantitySuffix}`;
  } else {
    baseTemplate = (t) =>
      `Hello ${sellerFirstName}, I saw your listing for "${t}" on Downtown (${listingUrl}). Is it still available?${quantitySuffix}`;
  }

  let finalTitle = cleanTitle;
  let message = baseTemplate(finalTitle);

  // Enforce 300 character cap
  if (message.length > 300) {
    const excess = message.length - 300;
    const maxTitleLen = Math.max(10, cleanTitle.length - excess - 3);
    finalTitle = cleanTitle.slice(0, maxTitleLen) + "...";
    message = baseTemplate(finalTitle);
    if (message.length > 300) {
      message = message.slice(0, 300);
    }
  }

  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}

