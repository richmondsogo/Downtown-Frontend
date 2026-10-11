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
