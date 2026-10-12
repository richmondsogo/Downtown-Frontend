import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import { db } from "../index";
import { sql } from "drizzle-orm";
import { assertSafeSeedEnvironment } from "../guard-seed";

async function main() {
  assertSafeSeedEnvironment();
  // Delete ephemeral test listings that have no photos
  await db.execute(sql`DELETE FROM listings WHERE id NOT LIKE 'lst_seed_500_%'`);
  // Update created_at so the 500 listings have current timestamps
  await db.execute(sql`
    UPDATE listings 
    SET created_at = NOW() - ((500 - CAST(SUBSTRING(id FROM 14) AS INTEGER)) * INTERVAL '1 minute')
    WHERE id LIKE 'lst_seed_500_%'
  `);
  console.log("Cleaned ephemeral listings and refreshed timestamps on 500 seed listings!");
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
