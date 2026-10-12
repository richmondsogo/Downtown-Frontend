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

