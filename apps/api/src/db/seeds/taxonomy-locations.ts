import dotenv from "dotenv";
import path from "path";
import fs from "fs";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import { db, pool } from "../index";
import { university, campus, category, location } from "../schema";
import { eq } from "drizzle-orm";

export const UNIOSUN_UNIVERSITY = {
  id: "univ_uniosun",
  name: "Osun State University",
  slug: "uniosun",
  shortCode: "UNIOSUN",
};

/**
 * Six UNIOSUN campuses (to be confirmed by founders)
 */
export const UNIOSUN_CAMPUSES = [
  {
    id: "campus_osogbo",
    universityId: "univ_uniosun",
    name: "Osogbo (Main Campus)",
    slug: "osogbo",
    code: "OSG",
    address: "Oke-Baale, Osogbo, Osun State",
  },
  {
    id: "campus_ikire",
    universityId: "univ_uniosun",
    name: "Ikire Campus",
    slug: "ikire",
    code: "IKR",
    address: "College of Humanities and Culture, Ikire, Osun State",
  },
  {
    id: "campus_okuku",
    universityId: "univ_uniosun",
    name: "Okuku Campus",
    slug: "okuku",
    code: "OKK",
    address: "College of Management and Social Sciences, Okuku, Osun State",
  },
  {
    id: "campus_ifetedo",
    universityId: "univ_uniosun",
    name: "Ifetedo Campus",
    slug: "ifetedo",
    code: "IFD",
    address: "College of Law, Ifetedo, Osun State",
  },
  {
    id: "campus_ipetu_ijesha",
    universityId: "univ_uniosun",
    name: "Ipetu-Ijesha Campus",
    slug: "ipetu-ijesha",
    code: "IPJ",
    address: "College of Education, Ipetu-Ijesha, Osun State",
  },
  {
    id: "campus_ejigbo",
    universityId: "univ_uniosun",
    name: "Ejigbo Campus",
    slug: "ejigbo",
    code: "EJB",
    address: "College of Agriculture, Ejigbo, Osun State",
  },
];

/**
 * Exactly one reference Location row per campus (type=campus, is_curated=true).
 * No speculative campus landmarks in initial seeds.
 */
export const CAMPUS_LOCATIONS = [
  {
    id: "loc_campus_osogbo",
    campusId: "campus_osogbo",
    name: "Osogbo Campus",
    slug: "osogbo-campus",
    type: "campus",
    isCurated: true,
  },
  {
    id: "loc_campus_ikire",
    campusId: "campus_ikire",
    name: "Ikire Campus",
    slug: "ikire-campus",
    type: "campus",
    isCurated: true,
  },
  {
    id: "loc_campus_okuku",
    campusId: "campus_okuku",
    name: "Okuku Campus",
    slug: "okuku-campus",
    type: "campus",
    isCurated: true,
  },
  {
    id: "loc_campus_ifetedo",
    campusId: "campus_ifetedo",
    name: "Ifetedo Campus",
    slug: "ifetedo-campus",
    type: "campus",
    isCurated: true,
  },
  {
    id: "loc_campus_ipetu_ijesha",
    campusId: "campus_ipetu_ijesha",
    name: "Ipetu-Ijesha Campus",
    slug: "ipetu-ijesha-campus",
    type: "campus",
    isCurated: true,
  },
  {
    id: "loc_campus_ejigbo",
    campusId: "campus_ejigbo",
    name: "Ejigbo Campus",
    slug: "ejigbo-campus",
    type: "campus",
    isCurated: true,
  },
];

/**
 * Category names and slugs strictly per GOAL.md 5.3 (no subcategories)
 */
export const V1_CATEGORIES = [
  {
    id: "cat_electronics",
    name: "Electronics",
    slug: "electronics",
    description: "Phones, laptops, accessories, gadgets, and tech gear",
    icon: "laptop",
    displayOrder: 1,
  },
  {
    id: "cat_fashion_accessories",
    name: "Fashion & Accessories",
    slug: "fashion-accessories",
    description: "Clothes, footwear, bags, jewelry, and thrift wears",
    icon: "shirt",
    displayOrder: 2,
  },
  {
    id: "cat_food_drinks",
    name: "Food & Drinks",
    slug: "food-drinks",
    description: "Campus meals, snacks, provisions, and beverages",
    icon: "utensils",
    displayOrder: 3,
  },
  {
    id: "cat_home_living",
    name: "Home & Living",
    slug: "home-living",
    description: "Hostel furniture, mattresses, kitchenware, and decor",
    icon: "home",
    displayOrder: 4,
  },
  {
    id: "cat_books_study_materials",
    name: "Books & Study Materials",
    slug: "books-study-materials",
    description: "Textbooks, notebooks, handouts, stationery, and past questions",
    icon: "book-open",
    displayOrder: 5,
  },
  {
    id: "cat_beauty_personal_care",
    name: "Beauty & Personal Care",
    slug: "beauty-personal-care",
    description: "Skincare, haircare, fragrances, and grooming products",
    icon: "sparkles",
    displayOrder: 6,
  },
  {
    id: "cat_services",
    name: "Services",
    slug: "services",
    description: "Tutoring, printing, laundry, repair, styling, and graphics",
    icon: "wrench",
    displayOrder: 7,
  },
  {
    id: "cat_tickets_events",
    name: "Tickets & Events",
    slug: "tickets-events",
    description: "Campus shows, dinners, workshops, seminars, and tickets",
    icon: "ticket",
    displayOrder: 8,
  },
  {
    id: "cat_other",
    name: "Other",
    slug: "other",
    description: "Miscellaneous student items and equipment",
    icon: "more-horizontal",
    displayOrder: 9,
  },
];

/**
 * Loads student-area locations from docs/data/student-areas.csv if populated.
 */
export async function loadStudentAreasFromCsv(): Promise<Array<{
  campusSlug: string;
  name: string;
  slug: string;
  description?: string;
}>> {
  const csvPath = path.resolve(__dirname, "../../../../../docs/data/student-areas.csv");
  if (!fs.existsSync(csvPath)) {
    console.log(`[SEED] student-areas.csv not found at ${csvPath}`);
    return [];
  }

  const raw = fs.readFileSync(csvPath, "utf-8").trim();
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length <= 1) {
    console.log(`[SEED] docs/data/student-areas.csv contains headers only (0 student-area rows).`);
    return [];
  }

  const records: Array<{ campusSlug: string; name: string; slug: string; description?: string }> = [];
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
      records.push({
        campusSlug: parts[0],
        name: parts[1],
        slug: parts[2],
        description: parts[3] || undefined,
      });
    }
  }

  console.log(`[SEED] Loaded ${records.length} student-area locations from CSV.`);
  return records;
}

/**
 * Main idempotent reference data seed function.
 */
export async function seedTaxonomyAndLocations(customDb?: any) {
  const targetDb = customDb || db;
  console.log("=== Seeding Taxonomy & Locations Reference Data ===");

  // 1. Seed University (UNIOSUN)
  await targetDb
    .insert(university)
    .values(UNIOSUN_UNIVERSITY)
    .onConflictDoNothing({ target: university.slug });
  console.log("[SEED] University (UNIOSUN) ensured.");

  // 2. Seed Campuses
  for (const c of UNIOSUN_CAMPUSES) {
    await targetDb
      .insert(campus)
      .values(c)
      .onConflictDoNothing({ target: campus.slug });
  }
  console.log(`[SEED] Campuses (${UNIOSUN_CAMPUSES.length}) ensured.`);

  // 3. Seed Campus Locations (one per campus, curated)
  for (const loc of CAMPUS_LOCATIONS) {
    await targetDb
      .insert(location)
      .values({
        id: loc.id,
        campusId: loc.campusId,
        name: loc.name,
        slug: loc.slug,
        type: loc.type,
        isCurated: loc.isCurated,
        usageCount: 0,
      })
      .onConflictDoNothing({ target: location.id });
  }
  console.log(`[SEED] Campus locations (${CAMPUS_LOCATIONS.length}) ensured.`);

  // 4. Seed Categories (GOAL.md 5.3)
  for (const cat of V1_CATEGORIES) {
    await targetDb
      .insert(category)
      .values({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        displayOrder: cat.displayOrder,
        isActive: true,
      })
      .onConflictDoNothing({ target: category.slug });
  }
  console.log(`[SEED] Categories (${V1_CATEGORIES.length}) ensured.`);

  // 5. Seed Student Areas from CSV
  const studentAreas = await loadStudentAreasFromCsv();
  if (studentAreas.length > 0) {
    const campusRows = await targetDb.select().from(campus);
    const campusMap = new Map(campusRows.map((r: any) => [r.slug, r.id]));

    for (const sa of studentAreas) {
      const cId = campusMap.get(sa.campusSlug);
      if (cId) {
        const locId = `loc_sa_${sa.campusSlug}_${sa.slug}`;
        await targetDb
          .insert(location)
          .values({
            id: locId,
            campusId: cId,
            name: sa.name,
            slug: sa.slug,
            type: "student_area",
            isCurated: true,
            usageCount: 0,
          })
          .onConflictDoNothing({ target: location.id });
      }
    }
  }

  console.log("=== Taxonomy & Locations Reference Data Complete ===");
}

// Allow direct CLI invocation via `tsx src/db/seeds/taxonomy-locations.ts`
if (require.main === module) {
  seedTaxonomyAndLocations()
    .catch((err) => {
      console.error("Taxonomy seed failed:", err);
      process.exit(1);
    })
    .finally(async () => {
      await pool.end();
    });
}
