import { db } from "../db/index";
import { category, campus, location } from "../db/schema";
import { eq, and, or, sql, ilike } from "drizzle-orm";
import {
  CreateLocationInput,
  CreateLocationSchema,
  LocationAutocompleteQuery,
  LocationAutocompleteQuerySchema,
} from "@downtown/validation";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Returns all active product and service categories ordered by displayOrder.
 */
export async function getCategories() {
  return await db
    .select({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      icon: category.icon,
      displayOrder: category.displayOrder,
      isActive: category.isActive,
    })
    .from(category)
    .where(eq(category.isActive, true))
    .orderBy(category.displayOrder);
}

/**
 * Returns all UNIOSUN campuses.
 */
export async function getCampuses() {
  return await db
    .select({
      id: campus.id,
      universityId: campus.universityId,
      name: campus.name,
      slug: campus.slug,
      code: campus.code,
      address: campus.address,
    })
    .from(campus)
    .orderBy(campus.name);
}

/**
 * High-performance public location autocomplete using pg_trgm and prefix matching.
 * - Searches strictly curated locations (isCurated = true).
 * - Limit 8, minimal payload.
 */
export async function autocompleteLocations(
  query: LocationAutocompleteQuery
) {
  const parsed = LocationAutocompleteQuerySchema.parse(query);
  const q = parsed.q?.trim() || "";
  const campusId = parsed.campusId?.trim();

  const conditions = [eq(location.isCurated, true)];
  if (campusId) {
    conditions.push(eq(location.campusId, campusId));
  }

  if (q.length > 0) {
    // pg_trgm similarity or substring ILIKE matching
    conditions.push(
      or(
        ilike(location.name, `%${q}%`),
        sql`${location.name} % ${q}`
      )!
    );

    // Ranking priority: exact match (1) > prefix match (2) > general match (3)
    const matchRank = sql<number>`CASE 
      WHEN lower(${location.name}) = lower(${q}) THEN 1
      WHEN lower(${location.name}) LIKE lower(${q}) || '%' THEN 2
      ELSE 3
    END`;

    return await db
      .select({
        id: location.id,
        campusId: location.campusId,
        name: location.name,
        slug: location.slug,
        type: location.type,
        isCurated: location.isCurated,
      })
      .from(location)
      .where(and(...conditions))
      .orderBy(
        matchRank,
        sql`${location.usageCount} DESC`,
        location.name
      )
      .limit(8);
  }

  // If query is empty, return top curated locations
  return await db
    .select({
      id: location.id,
      campusId: location.campusId,
      name: location.name,
      slug: location.slug,
      type: location.type,
      isCurated: location.isCurated,
    })
    .from(location)
    .where(and(...conditions))
    .orderBy(location.name)
    .limit(8);
}

/**
 * Retrieves uncurated custom locations created by a specific authenticated user.
 */
export async function getMyLocations(userId: string, campusId?: string) {
  const conditions = [
    eq(location.creatorId, userId),
    eq(location.isCurated, false),
  ];
  if (campusId) {
    conditions.push(eq(location.campusId, campusId));
  }

  return await db
    .select({
      id: location.id,
      campusId: location.campusId,
      name: location.name,
      slug: location.slug,
      type: location.type,
      isCurated: location.isCurated,
    })
    .from(location)
    .where(and(...conditions))
    .orderBy(location.name);
}

export interface CreateCustomLocationResult {
  location: {
    id: string;
    campusId: string;
    name: string;
    slug: string;
    type: string;
    isCurated: boolean;
  };
  isDuplicate: boolean;
}

/**
 * Creates a custom location for the authenticated user.
 * Performs anti-abuse checks, duplicate handling, and stores with isCurated = false.
 */
export async function createCustomLocation(
  input: CreateLocationInput,
  creatorId: string
): Promise<CreateCustomLocationResult> {
  const validated = CreateLocationSchema.parse(input);

  // 1. Verify campus exists
  const campusRecord = await db
    .select({ id: campus.id })
    .from(campus)
    .where(eq(campus.id, validated.campusId))
    .limit(1);

  if (campusRecord.length === 0) {
    throw new Error("Specified campus does not exist");
  }

  // 2. Case-insensitive duplicate check within same campus
  const existing = await db
    .select({
      id: location.id,
      campusId: location.campusId,
      name: location.name,
      slug: location.slug,
      type: location.type,
      isCurated: location.isCurated,
    })
    .from(location)
    .where(
      and(
        eq(location.campusId, validated.campusId),
        sql`lower(${location.name}) = lower(${validated.name})`
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return {
      location: existing[0],
      isDuplicate: true,
    };
  }

  // 3. Insert new custom uncurated location
  const id = "loc_custom_" + Math.random().toString(36).substring(2, 10);
  const baseSlug = slugify(validated.name);
  const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

  const inserted = await db
    .insert(location)
    .values({
      id,
      campusId: validated.campusId,
      name: validated.name,
      slug,
      type: "custom",
      isCurated: false,
      creatorId,
      usageCount: 0,
    })
    .returning({
      id: location.id,
      campusId: location.campusId,
      name: location.name,
      slug: location.slug,
      type: location.type,
      isCurated: location.isCurated,
    });

  return {
    location: inserted[0],
    isDuplicate: false,
  };
}
