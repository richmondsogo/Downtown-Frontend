import { describe, it, expect } from "vitest";
import { formatDisplayName } from "../index";

describe("formatDisplayName Unit Suite", () => {
  it("prefers businessName when provided and non-empty", () => {
    expect(formatDisplayName("Richmond Osogbo", "Downtown Gadgets Ltd")).toBe("Downtown Gadgets Ltd");
    expect(formatDisplayName("Richmond Osogbo", "  Campus Bites  ")).toBe("Campus Bites");
  });

  it("formats individual names as First Name + Last Initial", () => {
    expect(formatDisplayName("Richmond Osogbo")).toBe("Richmond O.");
    expect(formatDisplayName("Tunde Babatunde Ade")).toBe("Tunde A.");
    expect(formatDisplayName("Chioma Stephanie Okeke")).toBe("Chioma O.");
  });

  it("preserves single-word names unchanged", () => {
    expect(formatDisplayName("Richmond")).toBe("Richmond");
    expect(formatDisplayName("Tunde")).toBe("Tunde");
  });

  it("handles leading and trailing whitespace cleanly", () => {
    expect(formatDisplayName("   Richmond Osogbo   ")).toBe("Richmond O.");
    expect(formatDisplayName("   Richmond   ")).toBe("Richmond");
  });

  it("handles unicode and accented names safely", () => {
    expect(formatDisplayName("Élodie Chukwu")).toBe("Élodie C.");
    expect(formatDisplayName("Ṣola Ògúnlẹ́yẹ")).toBe("Ṣola Ò.");
  });

  it("falls back gracefully on empty personal names", () => {
    expect(formatDisplayName("")).toBe("Seller");
    expect(formatDisplayName("   ")).toBe("Seller");
  });
});
