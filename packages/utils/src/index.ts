import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
 * Generates standardized pre-filled WhatsApp handoff message per GOAL.md Section 7.1.
 */
export function generateWhatsAppMessage(options: {
  sellerName: string;
  itemTitle: string;
  price: number;
  dateListed?: string;
  offerPrice?: number | null;
}): string {
  const { sellerName, itemTitle, price, dateListed, offerPrice } = options;
  if (offerPrice && offerPrice > 0) {
    return `Hi ${sellerName}, I saw your ${itemTitle} on Downtown for ${formatNaira(price)}. I'd like to offer ${formatNaira(offerPrice)}. Is it still available?`;
  }
  const dateStr = dateListed ? ` listed on Downtown on ${dateListed}` : " listed on Downtown";
  return `Hi ${sellerName}, I saw your ${itemTitle}${dateStr} for ${formatNaira(price)}. Is it still available?`;
}

/**
 * Encodes a phone number and message into a WhatsApp Click-to-Chat URL.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
