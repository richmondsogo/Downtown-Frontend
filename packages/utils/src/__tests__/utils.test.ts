import { describe, it, expect } from "vitest";
import { canSell, formatNaira, cn, formatMemberSince, formatTimeAgo } from "../index";

describe("Utils: canSell", () => {
  it("returns true only for verified sellers", () => {
    expect(canSell({ sellerStatus: "verified" })).toBe(true);
  });

  it("returns false for not_a_seller", () => {
    expect(canSell({ sellerStatus: "not_a_seller" })).toBe(false);
  });

  it("returns false for pending_verification", () => {
    expect(canSell({ sellerStatus: "pending_verification" })).toBe(false);
  });

  it("returns false for suspended sellers", () => {
    expect(canSell({ sellerStatus: "suspended" })).toBe(false);
  });

  it("returns false for banned sellers", () => {
    expect(canSell({ sellerStatus: "banned" })).toBe(false);
  });

  it("returns false for null or undefined user objects", () => {
    expect(canSell(null)).toBe(false);
    expect(canSell(undefined)).toBe(false);
  });
});

describe("Utils: formatNaira", () => {
  it("formats numbers into Nigerian Naira (₦)", () => {
    const formatted = formatNaira(45000);
    // Accommodate standard NGN format across environments
    expect(formatted).toContain("45,000");
    expect(formatted).toMatch(/₦|NGN/);
  });

  it("formats zero amount correctly", () => {
    const formatted = formatNaira(0);
    expect(formatted).toContain("0");
  });
});

describe("Utils: cn", () => {
  it("combines classes and resolves Tailwind conflicts", () => {
    expect(cn("px-2 py-1", "bg-red-500")).toBe("px-2 py-1 bg-red-500");
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("text-red-500", undefined, null, false && "hidden")).toBe("text-red-500");
  });
});

describe("Utils: formatMemberSince & formatTimeAgo", () => {
  it("formats member join dates into Month Year", () => {
    expect(formatMemberSince(new Date("2026-10-01"))).toMatch(/Oct 2026/);
    expect(formatMemberSince(null)).toBe("Recently");
    expect(formatMemberSince("invalid")).toBe("Recently");
  });

  it("formats relative time ago", () => {
    const now = new Date();
    expect(formatTimeAgo(now)).toBe("Just now");
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    expect(formatTimeAgo(fiveMinAgo)).toBe("5m ago");
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(formatTimeAgo(twoHoursAgo)).toBe("2h ago");
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(fourDaysAgo)).toBe("4d ago");
    expect(formatTimeAgo(null)).toBe("Recently");
  });
});

