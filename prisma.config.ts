import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Client generation during Vercel builds does not connect to the database.
    // Keep the URL optional here so Preview builds don't need production secrets.
    // Commands that connect still need the schema's database URL variables; the
    // empty fallback only keeps generate-only builds from failing at config load.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
