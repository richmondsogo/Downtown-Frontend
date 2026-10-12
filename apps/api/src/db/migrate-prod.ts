import path from "path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from "ws";
import { seedTaxonomyAndLocations } from "./seeds/taxonomy-locations";

neonConfig.webSocketConstructor = ws;

/**
 * Production database migration runner and table inspection helper.
 * Designed to be invoked strictly via scripts/run-prod-migrations.ps1.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set in process environment.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });
  const db = drizzle(pool);

  const action = process.argv[2] || "migrate";

  try {
    if (action === "migrate") {
      console.log("Applying pending migrations to target database...");
      const migrationsFolder = path.resolve(__dirname, "./migrations");
      await migrate(db, { migrationsFolder });
      console.log("Migrations applied successfully.");
    } else if (action === "seed-taxonomy") {
      console.log("Seeding taxonomy & reference data to target database (idempotent)...");
      await seedTaxonomyAndLocations(db);
      console.log("Taxonomy reference data seeded successfully.");
    } else if (action === "list-tables") {
      console.log("Listing public tables in target database...");
    } else {
      console.error(`Unknown action: ${action}. Expected 'migrate', 'seed-taxonomy', or 'list-tables'.`);
      process.exit(1);
    }

    // Always query and list public tables
    const client = await pool.connect();
    try {
      const res = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
      );
      const tables = res.rows.map((r: { table_name: string }) => r.table_name);
      console.log("Public database tables:");
      console.log(JSON.stringify(tables, null, 2));
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Production database operation failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
