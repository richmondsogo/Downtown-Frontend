import { sql, SQL } from "drizzle-orm";
import { listing, location } from "../db/schema";

export interface CursorPayload {
  v: number | string;
  id: string;
}

/**
 * Encodes keyset cursor as base64 string.
 */
export function encodeCursor(sortValue: number | string, id: string): string {
  const payload: CursorPayload = { v: sortValue, id };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/**
 * Decodes base64 keyset cursor. Returns null if invalid.
 */
export function decodeCursor(cursor?: string | null): CursorPayload | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === "string" && parsed.v !== undefined) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Constructs multi-signal relevance scoring SQL expression complying with GOAL.md 6.3:
 * Relevance (ts_rank_cd + trigram) -> Availability -> Campus boost -> Recency -> Seller trust (weight 0).
 */
export function buildRankScoreSql(q?: string, viewerCampusId?: string): SQL<number> {
  const campusBonus = viewerCampusId
    ? sql<number>`CASE WHEN ${location.campusId} = ${viewerCampusId} THEN 0.25 ELSE 0.0 END`
    : sql<number>`0.0`;

  // Status scoring: published=1.0, reserved=0.5, sold=-100.0 (sold always ranked last)
  const statusScore = sql<number>`CASE 
    WHEN ${listing.status} = 'published' THEN 1.0 
    WHEN ${listing.status} = 'reserved' THEN 0.5 
    ELSE -100.0 
  END`;

  // Recency decay bonus (normalized timestamp)
  const recencyScore = sql<number>`(EXTRACT(EPOCH FROM ${listing.createdAt}) / 1000000000.0)`;

  if (q && q.trim().length > 0) {
    const cleanQ = q.trim();
    return sql<number>`(
      (ts_rank_cd(${listing.searchVector}, websearch_to_tsquery('simple', ${cleanQ})) * 2.0)
      + (word_similarity(${cleanQ}, ${listing.title}) * 1.5)
      + ${statusScore}
      + ${campusBonus}
      + ${recencyScore}
    )`;
  }

  return sql<number>`(${statusScore} + ${campusBonus} + ${recencyScore})`;
}
