import { spawnSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production") {
  console.info("Skipping automatic migrations outside Vercel production.");
  process.exit(0);
}

const result = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  stdio: "inherit",
});

if (result.error) {
  console.error("Failed to start Prisma production migrations:", result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
