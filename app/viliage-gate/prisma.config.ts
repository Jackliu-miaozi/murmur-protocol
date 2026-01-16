/**
 * Prisma Configuration for Supabase (Prisma 7)
 */
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Connection URL (use DIRECT_URL for migrations, DATABASE_URL for queries)
    url: process.env["DATABASE_URL"],
  },
});
