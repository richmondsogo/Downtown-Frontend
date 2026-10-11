import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

import dotenv from "dotenv";
import path from "path";

if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  dotenv.config({ path: path.resolve(process.cwd(), "apps/api/.env") });
}

/**
 * Neon Serverless PostgreSQL connection using WebSocket Pool.
 * Supports interactive multi-statement transactions (mandatory for inventory reservation).
 * db export is non-nullable; throws if DATABASE_URL is missing.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

if (!process.env.VERCEL && typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
export * from "./schema";

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Database connection check failed:", error);
    return false;
  }
}
