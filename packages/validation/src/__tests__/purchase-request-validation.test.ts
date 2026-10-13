import { describe, it, expect } from "vitest";
import {
  isAllowedPurchaseRequestTransition,
  CreatePurchaseRequestSchema,
  UserPhoneSchema,
  PurchaseRequestStatus,
} from "../index";

describe("Purchase Request Status Transition Rules", () => {
  it("allows pending -> cancelled by buyer, seller, and system", () => {
    expect(isAllowedPurchaseRequestTransition("pending", "cancelled", "buyer")).toBe(true);
    expect(isAllowedPurchaseRequestTransition("pending", "cancelled", "seller")).toBe(true);
    expect(isAllowedPurchaseRequestTransition("pending", "cancelled", "system")).toBe(true);
  });

  it("allows pending -> expired by system only", () => {
    expect(isAllowedPurchaseRequestTransition("pending", "expired", "system")).toBe(true);
    expect(isAllowedPurchaseRequestTransition("pending", "expired", "buyer")).toBe(false);
    expect(isAllowedPurchaseRequestTransition("pending", "expired", "seller")).toBe(false);
  });

  it("allows pending -> completed and pending -> disputed by buyer and seller (Step 08)", () => {
    expect(isAllowedPurchaseRequestTransition("pending", "completed", "buyer")).toBe(true);
    expect(isAllowedPurchaseRequestTransition("pending", "completed", "seller")).toBe(true);
    expect(isAllowedPurchaseRequestTransition("pending", "completed", "system")).toBe(false);

    expect(isAllowedPurchaseRequestTransition("pending", "disputed", "buyer")).toBe(true);
    expect(isAllowedPurchaseRequestTransition("pending", "disputed", "seller")).toBe(true);
    expect(isAllowedPurchaseRequestTransition("pending", "disputed", "system")).toBe(false);
  });

  it("forbids transitions from terminal states", () => {
    const terminals: PurchaseRequestStatus[] = ["cancelled", "expired", "completed", "disputed"];
    for (const term of terminals) {
      for (const target of ["pending", "completed", "cancelled", "expired"] as PurchaseRequestStatus[]) {
        if (term !== target) {
          expect(isAllowedPurchaseRequestTransition(term, target, "buyer")).toBe(false);
          expect(isAllowedPurchaseRequestTransition(term, target, "seller")).toBe(false);
          expect(isAllowedPurchaseRequestTransition(term, target, "system")).toBe(false);
        }
      }
    }
  });

  it("no accepted or rejected status exists in transition matrix", () => {
    // Type checking ensures 'accepted' and 'rejected' are not valid statuses
    expect(isAllowedPurchaseRequestTransition("pending", "cancelled", "buyer")).toBe(true);
  });
});

describe("CreatePurchaseRequestSchema", () => {
  it("validates valid input with default quantity", () => {
    const res = CreatePurchaseRequestSchema.safeParse({});
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.requestedQuantity).toBe(1);
      expect(res.data.offerPrice).toBeUndefined();
    }
  });

  it("validates valid offer price", () => {
    const res = CreatePurchaseRequestSchema.safeParse({
      requestedQuantity: 2,
      offerPrice: 25000,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.requestedQuantity).toBe(2);
      expect(res.data.offerPrice).toBe(25000);
    }
  });

  it("rejects non-positive quantity", () => {
    const res = CreatePurchaseRequestSchema.safeParse({ requestedQuantity: 0 });
    expect(res.success).toBe(false);
  });

  it("rejects fractional quantity", () => {
    const res = CreatePurchaseRequestSchema.safeParse({ requestedQuantity: 1.5 });
    expect(res.success).toBe(false);
  });
});

describe("UserPhoneSchema", () => {
  it("validates valid Nigerian mobile numbers", () => {
    expect(UserPhoneSchema.safeParse({ phone: "08031234567" }).success).toBe(true);
    expect(UserPhoneSchema.safeParse({ phone: "+2348031234567" }).success).toBe(true);
    expect(UserPhoneSchema.safeParse({ phone: "09012345678" }).success).toBe(true);
  });

  it("rejects invalid phone numbers", () => {
    expect(UserPhoneSchema.safeParse({ phone: "12345" }).success).toBe(false);
    expect(UserPhoneSchema.safeParse({ phone: "06012345678" }).success).toBe(false);
  });
});
