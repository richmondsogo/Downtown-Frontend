import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

/**
 * Neon Serverless PostgreSQL connection.
 * Table schemas are added per vertical slice (Step 02+).
 */
const connectionString = process.env.DATABASE_URL;

export const db = connectionString ? drizzle(neon(connectionString)) : null;

export async function checkDatabaseConnection(): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    return false;
  }
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database connection check failed:", error);
    return false;
  }
}
