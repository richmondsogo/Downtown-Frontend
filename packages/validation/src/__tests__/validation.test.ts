import { describe, it, expect } from "vitest";
import {
  SignUpSchema,
  StudentSignUpSchema,
  StaffSignUpSchema,
  VendorSignUpSchema,
  LoginSchema,
  VerifyOtpSchema,
  normalizeMatricNumber,
  isValidReturnTo,
  ReturnToSchema,
  MATRIC_NUMBER_PATTERN,
  MATRIC_NUMBER_EXAMPLE,
  normalizeLocationName,
  containsPhoneNumber,
  containsUrl,
  CreateLocationSchema,
  LocationAutocompleteQuerySchema,
  MAX_LISTING_PRICE_NAIRA,
  ListingStatusEnum,
  ListingConditionEnum,
  CATEGORY_CONDITION_RULES,
  getCategoryConditionRequirement,
  ALLOWED_LISTING_TRANSITIONS,
  isAllowedListingTransition,
  DraftListingSchema,
  SubmitListingSchema,
  UpdateListingSchema,
  isHighRiskListingEdit,
} from "../index";

describe("Validation: normalizeMatricNumber", () => {
  it("normalizes matric numbers: trims, converts \\ - and spaced separators into /", () => {
    expect(normalizeMatricNumber("  2024 / 55430  ")).toBe("2024/55430");
    expect(normalizeMatricNumber("2024 - 55430")).toBe("2024/55430");
    expect(normalizeMatricNumber("2024\\55430")).toBe("2024/55430");
    expect(normalizeMatricNumber(" 2024-55430 ")).toBe("2024/55430");
    expect(normalizeMatricNumber("  2024   /   1234  ")).toBe("2024/1234");
  });
});

describe("Validation: SignUpSchema & Matric Validation", () => {
  it("validates and normalizes valid student signup with YYYY/NNNNN format", () => {
    const input = {
      role: "student",
      name: "Tunde Bakare",
      email: "tunde.bakare@gmail.com",
      matricNumber: " 2024 - 55430 ",
      password: "StrongPassword123",
    };

    const parsed = SignUpSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.role).toBe("student");
      expect((parsed.data as any).matricNumber).toBe("2024/55430");
      expect(parsed.data.email).toBe("tunde.bakare@gmail.com");
    }
  });

  it("accepts 4 to 6 digit sequence numbers in matric", () => {
    expect(
      StudentSignUpSchema.safeParse({
        role: "student",
        name: "Test Student",
        email: "test4@gmail.com",
        matricNumber: "2024/1234",
        password: "StrongPassword123",
      }).success
    ).toBe(true);

    expect(
      StudentSignUpSchema.safeParse({
        role: "student",
        name: "Test Student",
        email: "test6@gmail.com",
        matricNumber: "2024/123456",
        password: "StrongPassword123",
      }).success
    ).toBe(true);
  });

  it("STRICTLY REJECTS UNIOSUN/ prefix with helpful error containing example", () => {
    const testCases = [
      "UNIOSUN/2024/55430",
      "uniosun/2024/55430",
      "UNIOSUN-2024-55430",
      "UNIOSUN\\2024\\55430",
    ];

    for (const matricNumber of testCases) {
      const parsed = StudentSignUpSchema.safeParse({
        role: "student",
        name: "Tunde Bakare",
        email: "tunde@gmail.com",
        matricNumber,
        password: "StrongPassword123",
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find((i) =>
          i.message.includes("Do not include the 'UNIOSUN/' prefix")
        );
        expect(issue).toBeDefined();
        expect(issue?.message).toContain(MATRIC_NUMBER_EXAMPLE);
      }
    }
  });

  it("fails student signup when matricNumber format has invalid year or digits", () => {
    const invalidMatrics = [
      "24/55430", // 2-digit year
      "2024/123", // only 3 digits sequence
      "2024/1234567", // 7 digits sequence
      "2024$55430", // invalid separator
      "abcd/55430", // non-digits
    ];

    for (const matricNumber of invalidMatrics) {
      const parsed = StudentSignUpSchema.safeParse({
        role: "student",
        name: "Tunde Bakare",
        email: "tunde@gmail.com",
        matricNumber,
        password: "StrongPassword123",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain(MATRIC_NUMBER_EXAMPLE);
      }
    }
  });

  it("fails student signup when matricNumber is missing", () => {
    const input = {
      role: "student",
      name: "Tunde Bakare",
      email: "tunde@gmail.com",
      password: "StrongPassword123",
    };

    const parsed = SignUpSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });
});

describe("Validation: Personal Email Support (Gmail, etc.)", () => {
  it("accepts Gmail and personal email for student signup", () => {
    const parsed = StudentSignUpSchema.safeParse({
      role: "student",
      name: "Student Gmail",
      email: "student.personal@gmail.com",
      matricNumber: "2024/55430",
      password: "StrongPassword123",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts Gmail and personal email for staff signup", () => {
    const parsed = StaffSignUpSchema.safeParse({
      role: "staff",
      name: "Staff Gmail",
      email: "staff.personal@gmail.com",
      password: "StrongPassword123",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts Gmail and personal email for vendor signup", () => {
    const parsed = VendorSignUpSchema.safeParse({
      role: "vendor",
      name: "Vendor Gmail",
      email: "vendor.personal@gmail.com",
      password: "StrongPassword123",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("Validation: Security & Roles", () => {
  it("STRICTLY REJECTS admin role at signup", () => {
    const input = {
      role: "admin",
      name: "Admin Attacker",
      email: "admin@example.com",
      password: "SuperSecretPassword123",
    };

    const parsed = SignUpSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown arbitrary roles", () => {
    const input = {
      role: "moderator",
      name: "Mod User",
      email: "mod@example.com",
      password: "ModPassword123",
    };

    const parsed = SignUpSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it("enforces password minimum length of 8 and max of 128", () => {
    expect(
      StaffSignUpSchema.safeParse({
        role: "staff",
        name: "Staff Person",
        email: "staff@example.com",
        password: "short",
      }).success
    ).toBe(false);

    expect(
      StaffSignUpSchema.safeParse({
        role: "staff",
        name: "Staff Person",
        email: "staff@example.com",
        password: "a".repeat(129),
      }).success
    ).toBe(false);
  });
});

describe("Validation: LoginSchema", () => {
  it("validates valid login input", () => {
    const parsed = LoginSchema.safeParse({
      email: "user@gmail.com",
      password: "MySecretPassword123",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid email and empty password", () => {
    expect(LoginSchema.safeParse({ email: "invalid-email", password: "123" }).success).toBe(false);
    expect(LoginSchema.safeParse({ email: "user@example.com", password: "" }).success).toBe(false);
  });
});

describe("Validation: VerifyOtpSchema", () => {
  it("accepts exactly 6 numeric digits", () => {
    expect(VerifyOtpSchema.safeParse({ email: "test@gmail.com", otp: "123456" }).success).toBe(true);
    expect(VerifyOtpSchema.safeParse({ email: "test@gmail.com", otp: "000123" }).success).toBe(true);
  });

  it("rejects non-6-digit OTPs", () => {
    expect(VerifyOtpSchema.safeParse({ email: "test@example.com", otp: "12345" }).success).toBe(false);
    expect(VerifyOtpSchema.safeParse({ email: "test@example.com", otp: "1234567" }).success).toBe(false);
    expect(VerifyOtpSchema.safeParse({ email: "test@example.com", otp: "12345a" }).success).toBe(false);
    expect(VerifyOtpSchema.safeParse({ email: "test@example.com", otp: "abcdef" }).success).toBe(false);
  });
});

describe("Validation: isValidReturnTo & ReturnToSchema", () => {
  it("accepts valid same-origin relative paths", () => {
    expect(isValidReturnTo("/")).toBe(true);
    expect(isValidReturnTo("/listings")).toBe(true);
    expect(isValidReturnTo("/listing/123?offer=40000")).toBe(true);
    expect(isValidReturnTo("/settings/seller")).toBe(true);
    expect(ReturnToSchema.safeParse("/listings").success).toBe(true);
  });

  it("rejects open redirects and absolute/protocol-relative URLs", () => {
    expect(isValidReturnTo("https://evil.com")).toBe(false);
    expect(isValidReturnTo("http://evil.com")).toBe(false);
    expect(isValidReturnTo("//evil.com")).toBe(false);
    expect(isValidReturnTo("/\\evil.com")).toBe(false);
    expect(isValidReturnTo("javascript:alert(1)")).toBe(false);
    expect(isValidReturnTo("")).toBe(false);
    expect(isValidReturnTo(null)).toBe(false);
    expect(ReturnToSchema.safeParse("https://evil.com").success).toBe(false);
  });
});

describe("Validation: Location & Custom Location Guardrails", () => {
  it("normalizes location names by trimming and collapsing multiple spaces", () => {
    expect(normalizeLocationName("  Al-Hassan   Hostel  ")).toBe("Al-Hassan Hostel");
    expect(normalizeLocationName("Main   Gate")).toBe("Main Gate");
    expect(normalizeLocationName("")).toBe("");
  });

  it("detects phone numbers and sequences of digits in location names", () => {
    expect(containsPhoneNumber("Hostel Call 08031234567")).toBe(true);
    expect(containsPhoneNumber("Call +234 803 123 4567")).toBe(true);
    expect(containsPhoneNumber("Room 1234567")).toBe(true);
    expect(containsPhoneNumber("Hostel Block 3")).toBe(false);
    expect(containsPhoneNumber("ETF Building Room 12")).toBe(false);
  });

  it("detects URLs and web links in location names", () => {
    expect(containsUrl("Hostel see http://hostel.com")).toBe(true);
    expect(containsUrl("Visit https://downtown.ng")).toBe(true);
    expect(containsUrl("Visit www.studentlodge.com")).toBe(true);
    expect(containsUrl("Find us at lodge.ng")).toBe(true);
    expect(containsUrl("Normal Hostel Osogbo")).toBe(false);
  });

  it("accepts valid custom location input and transforms name", () => {
    const parsed = CreateLocationSchema.safeParse({
      campusId: "campus_123",
      name: "  Green   Villa   Lodge  ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Green Villa Lodge");
      expect(parsed.data.campusId).toBe("campus_123");
    }
  });

  it("rejects location names shorter than 3 characters or longer than 80 characters", () => {
    expect(
      CreateLocationSchema.safeParse({ campusId: "campus_123", name: "AB" }).success
    ).toBe(false);
    expect(
      CreateLocationSchema.safeParse({
        campusId: "campus_123",
        name: "A".repeat(81),
      }).success
    ).toBe(false);
  });

  it("rejects custom location names containing phone numbers", () => {
    const res = CreateLocationSchema.safeParse({
      campusId: "campus_123",
      name: "Hostel Contact 08031234567",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toContain("phone numbers");
    }
  });

  it("rejects custom location names containing URLs or links", () => {
    const res = CreateLocationSchema.safeParse({
      campusId: "campus_123",
      name: "Hostel at https://hostels.ng",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toContain("URLs");
    }
  });

  it("validates location autocomplete queries with defaults and length limits", () => {
    const defaultQuery = LocationAutocompleteQuerySchema.safeParse({});
    expect(defaultQuery.success).toBe(true);
    if (defaultQuery.success) {
      expect(defaultQuery.data.q).toBe("");
      expect(defaultQuery.data.campusId).toBeUndefined();
    }

    const filteredQuery = LocationAutocompleteQuerySchema.safeParse({
      q: "Hostel",
      campusId: "campus_123",
    });
    expect(filteredQuery.success).toBe(true);

    const tooLong = LocationAutocompleteQuerySchema.safeParse({
      q: "x".repeat(85),
    });
    expect(tooLong.success).toBe(false);
  });
});

describe("Validation: Listing Status & Transitions Table", () => {
  it("defines the complete set of listing statuses", () => {
    const validStatuses = [
      "draft",
      "pending_moderation",
      "published",
      "reserved",
      "sold",
      "archived",
    ];
    for (const status of validStatuses) {
      expect(ListingStatusEnum.safeParse(status).success).toBe(true);
    }
    expect(ListingStatusEnum.safeParse("unknown_status").success).toBe(false);
  });

  it("enforces ONLY allowed Step 04 lifecycle transitions", () => {
    // Identity transitions (same status) are allowed
    expect(isAllowedListingTransition("draft", "draft")).toBe(true);
    expect(isAllowedListingTransition("pending_moderation", "pending_moderation")).toBe(true);
    expect(isAllowedListingTransition("published", "published")).toBe(true);

    // Step 04 allowed forward transitions:
    // 1. draft -> pending_moderation
    expect(isAllowedListingTransition("draft", "pending_moderation")).toBe(true);
    // 2. pending_moderation -> published (when clean)
    expect(isAllowedListingTransition("pending_moderation", "published")).toBe(true);
    // 3. published -> pending_moderation (high-risk edit re-check)
    expect(isAllowedListingTransition("published", "pending_moderation")).toBe(true);

    // Disallowed transitions in Step 04:
    expect(isAllowedListingTransition("draft", "published")).toBe(false);
    expect(isAllowedListingTransition("published", "draft")).toBe(false);
    expect(isAllowedListingTransition("pending_moderation", "draft")).toBe(false);
    expect(isAllowedListingTransition("published", "sold")).toBe(false); // Step 07/08
    expect(isAllowedListingTransition("published", "reserved")).toBe(false); // Step 07/08
    expect(isAllowedListingTransition("sold", "draft")).toBe(false);
    expect(isAllowedListingTransition("archived", "published")).toBe(false);
  });
});

describe("Validation: Category Condition Requirements Configuration", () => {
  it("maps required categories per specification", () => {
    const required = [
      "electronics",
      "fashion-accessories",
      "home-living",
      "books-study-materials",
      "beauty-personal-care",
    ];
    for (const cat of required) {
      expect(getCategoryConditionRequirement(cat)).toBe("required");
    }
  });

  it("maps not_applicable categories per specification", () => {
    const notApplicable = ["food-drinks", "services", "tickets-events"];
    for (const cat of notApplicable) {
      expect(getCategoryConditionRequirement(cat)).toBe("not_applicable");
    }
  });

  it("maps optional categories and unknown fallbacks", () => {
    expect(getCategoryConditionRequirement("other")).toBe("optional");
    expect(getCategoryConditionRequirement("cat_other")).toBe("optional");
    expect(getCategoryConditionRequirement("non_existent_category")).toBe("optional");
  });
});

describe("Validation: DraftListingSchema", () => {
  it("allows saving a partial draft with defaults", () => {
    const parsed = DraftListingSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toBe("");
      expect(parsed.data.description).toBe("");
      expect(parsed.data.isNegotiable).toBe(false);
      expect(parsed.data.quantityAvailable).toBe(1);
      expect(parsed.data.photoIds).toEqual([]);
    }
  });

  it("accepts valid partial draft fields", () => {
    const parsed = DraftListingSchema.safeParse({
      title: "Used Engineering Textbook",
      price: 4500,
      isNegotiable: true,
      categoryId: "cat_books_study_materials",
      condition: "good",
      locationId: "loc_campus_osogbo",
      quantityAvailable: 2,
      photoIds: ["photo_1", "photo_2"],
    });
    expect(parsed.success).toBe(true);
  });

  it("enforces price bounds on draft if provided", () => {
    expect(DraftListingSchema.safeParse({ price: -100 }).success).toBe(false);
    expect(DraftListingSchema.safeParse({ price: 0 }).success).toBe(false);
    expect(DraftListingSchema.safeParse({ price: 1.5 }).success).toBe(false);
    expect(DraftListingSchema.safeParse({ price: MAX_LISTING_PRICE_NAIRA + 1 }).success).toBe(false);
    expect(DraftListingSchema.safeParse({ price: MAX_LISTING_PRICE_NAIRA }).success).toBe(true);
  });

  it("limits photos to max 5", () => {
    expect(
      DraftListingSchema.safeParse({
        photoIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
      }).success
    ).toBe(false);
  });
});

describe("Validation: SubmitListingSchema", () => {
  const validSubmit = {
    title: "iPhone 11 64GB Clean",
    description: "Factory unlocked, battery health 84%, comes with original charger.",
    price: 180000,
    isNegotiable: false,
    categoryId: "cat_electronics",
    condition: "like_new",
    locationId: "loc_campus_osogbo",
    quantityAvailable: 1,
    photoIds: ["photo_front", "photo_back"],
  };

  it("accepts valid submission", () => {
    const parsed = SubmitListingSchema.safeParse(validSubmit);
    expect(parsed.success).toBe(true);
  });

  it("requires title between 3 and 100 characters", () => {
    expect(SubmitListingSchema.safeParse({ ...validSubmit, title: "ab" }).success).toBe(false);
    expect(SubmitListingSchema.safeParse({ ...validSubmit, title: "a".repeat(101) }).success).toBe(false);
    expect(SubmitListingSchema.safeParse({ ...validSubmit, title: "   " }).success).toBe(false);
  });

  it("requires price as whole integer between 1 and MAX_LISTING_PRICE_NAIRA", () => {
    expect(SubmitListingSchema.safeParse({ ...validSubmit, price: 0 }).success).toBe(false);
    expect(SubmitListingSchema.safeParse({ ...validSubmit, price: -500 }).success).toBe(false);
    expect(SubmitListingSchema.safeParse({ ...validSubmit, price: 49.99 }).success).toBe(false);
    expect(SubmitListingSchema.safeParse({ ...validSubmit, price: MAX_LISTING_PRICE_NAIRA + 1 }).success).toBe(false);
    expect(SubmitListingSchema.safeParse({ ...validSubmit, price: 1 }).success).toBe(true);
  });

  it("requires category and location", () => {
    expect(SubmitListingSchema.safeParse({ ...validSubmit, categoryId: "" }).success).toBe(false);
    expect(SubmitListingSchema.safeParse({ ...validSubmit, locationId: "" }).success).toBe(false);
  });

  it("requires 1 to 5 photos", () => {
    expect(SubmitListingSchema.safeParse({ ...validSubmit, photoIds: [] }).success).toBe(false);
    expect(
      SubmitListingSchema.safeParse({
        ...validSubmit,
        photoIds: ["1", "2", "3", "4", "5", "6"],
      }).success
    ).toBe(false);
    expect(
      SubmitListingSchema.safeParse({
        ...validSubmit,
        photoIds: ["1"],
      }).success
    ).toBe(true);
  });

  it("enforces quantityAvailable between 1 and 999", () => {
    expect(SubmitListingSchema.safeParse({ ...validSubmit, quantityAvailable: 0 }).success).toBe(false);
    expect(SubmitListingSchema.safeParse({ ...validSubmit, quantityAvailable: 1000 }).success).toBe(false);
    expect(SubmitListingSchema.safeParse({ ...validSubmit, quantityAvailable: 999 }).success).toBe(true);
  });
});

describe("Validation: isHighRiskListingEdit", () => {
  const original = {
    title: "Calculus Textbook 8th Edition",
    description: "Good condition, slight highlight on chapter 2",
    price: 3500,
    categoryId: "cat_books_study_materials",
    condition: "good",
    photoIds: ["photo_1"],
  };

  it("classifies description and location changes as low risk", () => {
    expect(
      isHighRiskListingEdit(original, {
        description: "New updated description wording",
      })
    ).toBe(false);
  });

  it("flags title edits as high risk", () => {
    expect(
      isHighRiskListingEdit(original, {
        title: "Calculus Textbook 9th Edition",
      })
    ).toBe(true);
  });

  it("flags price edits as high risk", () => {
    expect(
      isHighRiskListingEdit(original, {
        price: 5000,
      })
    ).toBe(true);
  });

  it("flags category edits as high risk", () => {
    expect(
      isHighRiskListingEdit(original, {
        categoryId: "cat_electronics",
      })
    ).toBe(true);
  });

  it("flags condition edits as high risk", () => {
    expect(
      isHighRiskListingEdit(original, {
        condition: "like_new",
      })
    ).toBe(true);
  });

  it("flags photo list changes as high risk", () => {
    expect(
      isHighRiskListingEdit(original, {
        photoIds: ["photo_1", "photo_2"],
      })
    ).toBe(true);
  });
});


