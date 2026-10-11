import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

import { db, pool } from "./index";
import { user } from "./schema";
import { eq } from "drizzle-orm";

/**
 * Development-only database seed script.
 * Strict Allowlist Guard: Requires ALLOW_SEED=1 AND host matching a configured dev-branch value.
 * Refuses execution in production or against the production Neon host.
 */
async function seed() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const allowSeed = process.env.ALLOW_SEED;
  const dbUrl = process.env.DATABASE_URL;

  if (nodeEnv === "production") {
    console.error("FATAL: Seed script cannot run in production (NODE_ENV=production).");
    process.exit(1);
  }

  if (allowSeed !== "1") {
    console.error("REFUSED: Seed script requires explicit ALLOW_SEED=1 environment variable.");
    process.exit(1);
  }

  if (!dbUrl) {
    console.error("FATAL: DATABASE_URL is not set.");
    process.exit(1);
  }

  const parsedUrl = new URL(dbUrl);
  const host = parsedUrl.hostname;

  // Strict allowlist: Must be dev branch endpoint or local Postgres
  const allowedDevHosts = [
    "ep-shiny-credit-baedn5p1-pooler.c-8.eu-central-1.aws.neon.tech",
    "localhost",
    "127.0.0.1",
  ];
  const prodHost = "ep-noisy-fog-bafy7lrh-pooler.c-8.eu-central-1.aws.neon.tech";

  if (host === prodHost || !allowedDevHosts.some((h) => host.includes(h))) {
    console.error(`REFUSED: Database host "${host}" is not on the dev allowlist.`);
    process.exit(1);
  }

  console.log(`[SEED] Verified allowlist for host: ${host}`);

  try {
    // 1. Create or ensure test student
    const studentEmail = "tunde.student@uniosun.edu.ng";
    const existingStudent = await db
      .select()
      .from(user)
      .where(eq(user.email, studentEmail))
      .limit(1);

    if (existingStudent.length === 0) {
      await db.insert(user).values({
        id: "seed-student-001",
        name: "Tunde UNIOSUN",
        email: studentEmail,
        emailVerified: true,
        role: "student",
        matricNumber: "2023/1001",
        sellerStatus: "verified", // Flipped to verified seller
        accountStatus: "active",
      });
      console.log(`[SEED] Created student with sellerStatus=verified: ${studentEmail}`);
    } else {
      await db
        .update(user)
        .set({ sellerStatus: "verified" })
        .where(eq(user.email, studentEmail));
      console.log(`[SEED] Updated existing student to sellerStatus=verified: ${studentEmail}`);
    }

    // 2. Create or ensure test staff
    const staffEmail = "ade.staff@uniosun.edu.ng";
    const existingStaff = await db
      .select()
      .from(user)
      .where(eq(user.email, staffEmail))
      .limit(1);

    if (existingStaff.length === 0) {
      await db.insert(user).values({
        id: "seed-staff-001",
        name: "Dr. Ade Staff",
        email: staffEmail,
        emailVerified: true,
        role: "staff",
        sellerStatus: "not_a_seller",
        accountStatus: "active",
      });
      console.log(`[SEED] Created staff user: ${staffEmail}`);
    }

    // 3. Create or ensure test vendor
    const vendorEmail = "campus.bites@downtown.ng";
    const existingVendor = await db
      .select()
      .from(user)
      .where(eq(user.email, vendorEmail))
      .limit(1);

    if (existingVendor.length === 0) {
      await db.insert(user).values({
        id: "seed-vendor-001",
        name: "Campus Bites & Refreshments",
        email: vendorEmail,
        emailVerified: true,
        role: "vendor",
        sellerStatus: "verified",
        accountStatus: "active",
      });
      console.log(`[SEED] Created vendor with sellerStatus=verified: ${vendorEmail}`);
    }

    console.log("[SEED] Seeding completed successfully!");
  } catch (error) {
    console.error("[SEED] Error during seeding:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
