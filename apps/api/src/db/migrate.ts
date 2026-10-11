import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { db, pool } from "./index";

/**
 * Programmatic migration runner.
 * Applies all pending migrations from apps/api/src/db/migrations to the connected database.
 */
async function runMigrations() {
  console.log("Running pending migrations...");
  try {
    const migrationsFolder = path.resolve(__dirname, "./migrations");
    await migrate(db, { migrationsFolder });
    console.log("Migrations applied successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
