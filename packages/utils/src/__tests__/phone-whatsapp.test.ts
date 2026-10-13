import { describe, it, expect } from "vitest";
import {
  normalizeNigerianPhone,
  isValidNigerianPhone,
  generateWhatsAppUrl,
} from "../index";

describe("Nigerian Phone Normalization", () => {
  const validCases = [
    { input: "08031234567", expected: "+2348031234567", desc: "standard 080 prefix" },
    { input: "8031234567", expected: "+2348031234567", desc: "10-digit without leading 0" },
    { input: "+2348031234567", expected: "+2348031234567", desc: "full international with +" },
    { input: "2348031234567", expected: "+2348031234567", desc: "international without +" },
    { input: "07012345678", expected: "+2347012345678", desc: "070 prefix" },
    { input: "09098765432", expected: "+2349098765432", desc: "090 prefix" },
    { input: "09123456789", expected: "+2349123456789", desc: "091 prefix" },
    { input: " 0803 123 4567 ", expected: "+2348031234567", desc: "internal and outer spaces" },
    { input: "0803-123-4567", expected: "+2348031234567", desc: "dashes" },
    { input: "+234 (803) 123-4567", expected: "+2348031234567", desc: "parentheses and dashes" },
    { input: "234.803.123.4567", expected: "+2348031234567", desc: "dots" },
  ];

  for (const { input, expected, desc } of validCases) {
    it(`normalizes correctly for ${desc}: "${input}" -> "${expected}"`, () => {
      expect(normalizeNigerianPhone(input)).toBe(expected);
      expect(isValidNigerianPhone(input)).toBe(true);
    });
  }

  const invalidCases = [
    { input: "", desc: "empty string" },
    { input: "0803123456", desc: "too short (10 chars with leading 0)" },
    { input: "080312345678", desc: "too long (12 chars with leading 0)" },
    { input: "06012345678", desc: "invalid prefix 060 (not 7/8/9)" },
    { input: "+2345012345678", desc: "invalid international prefix 50 (not 7/8/9)" },
    { input: "+14155552671", desc: "US phone number (+1)" },
    { input: "+447911123456", desc: "UK phone number (+44)" },
    { input: "0803abc4567", desc: "alphanumeric string" },
    { input: "not-a-number", desc: "arbitrary string" },
  ];

  for (const { input, desc } of invalidCases) {
    it(`rejects invalid input for ${desc}: "${input}"`, () => {
      expect(() => normalizeNigerianPhone(input)).toThrow();
      expect(isValidNigerianPhone(input)).toBe(false);
    });
  }
});

describe("WhatsApp URL Generation", () => {
  it("generates standard inquiry template correctly", () => {
    const url = generateWhatsAppUrl({
      sellerPhone: "08031234567",
      sellerName: "Richmond Osogbo",
      listingTitle: "Calculus Textbook",
      listingUrl: "https://downtown.ng/listings/123",
      quantity: 1,
    });

    expect(url.startsWith("https://wa.me/2348031234567?text=")).toBe(true);
    const decoded = decodeURIComponent(url.split("?text=")[1]);
    expect(decoded).toBe(
      'Hello Richmond, I saw your listing for "Calculus Textbook" on Downtown (https://downtown.ng/listings/123). Is it still available?'
    );
  });

  it("appends ' I need N.' when quantity > 1", () => {
    const url = generateWhatsAppUrl({
      sellerPhone: "08031234567",
      sellerName: "Adebayo Salami",
      listingTitle: "Drawing Board Clips",
      listingUrl: "https://downtown.ng/listings/123",
      quantity: 3,
    });

    const decoded = decodeURIComponent(url.split("?text=")[1]);
    expect(decoded).toBe(
      'Hello Adebayo, I saw your listing for "Drawing Board Clips" on Downtown (https://downtown.ng/listings/123). Is it still available? I need 3.'
    );
  });

  it("generates offer request template with formatted Naira", () => {
    const url = generateWhatsAppUrl({
      sellerPhone: "08031234567",
      sellerName: "Chidinma Okeke",
      listingTitle: "Casio Scientific Calculator",
      listingUrl: "https://downtown.ng/listings/456",
      quantity: 1,
      offerPrice: 15000,
    });

    const decoded = decodeURIComponent(url.split("?text=")[1]);
    expect(decoded).toBe(
      'Hello Chidinma, I saw your listing for "Casio Scientific Calculator" on Downtown (https://downtown.ng/listings/456). Would you accept ₦15,000 for it?'
    );
  });

  it("handles offer with quantity > 1", () => {
    const url = generateWhatsAppUrl({
      sellerPhone: "08031234567",
      sellerName: "Folake",
      listingTitle: "Lab Coats (Size M)",
      listingUrl: "https://downtown.ng/listings/789",
      quantity: 2,
      offerPrice: 7000,
    });

    const decoded = decodeURIComponent(url.split("?text=")[1]);
    expect(decoded).toBe(
      'Hello Folake, I saw your listing for "Lab Coats (Size M)" on Downtown (https://downtown.ng/listings/789). Would you accept ₦7,000 for it? I need 2.'
    );
  });

  it("strips control characters like newlines and tabs from listing title", () => {
    const url = generateWhatsAppUrl({
      sellerPhone: "08031234567",
      sellerName: "Richmond",
      listingTitle: "Clean\nHP\tCharger\rOriginal",
      listingUrl: "https://downtown.ng/listings/999",
    });

    const decoded = decodeURIComponent(url.split("?text=")[1]);
    expect(decoded).toContain('"Clean HP Charger Original"');
    expect(decoded).not.toMatch(/[\r\n\t]/);
  });

  it("caps total message body to at most 300 characters", () => {
    const veryLongTitle = "A".repeat(400);
    const url = generateWhatsAppUrl({
      sellerPhone: "08031234567",
      sellerName: "Richmond",
      listingTitle: veryLongTitle,
      listingUrl: "https://downtown.ng/listings/long",
    });

    const decoded = decodeURIComponent(url.split("?text=")[1]);
    expect(decoded.length).toBeLessThanOrEqual(300);
    expect(decoded.endsWith("...\" on Downtown (https://downtown.ng/listings/long). Is it still available?")).toBe(true);
  });
});
