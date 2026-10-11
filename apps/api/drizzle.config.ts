import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "./.env") });
dotenv.config();

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
