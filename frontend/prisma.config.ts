import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 does not load env files on its own. Mirror Next.js precedence so the
// CLI and the app read the same DATABASE_URL.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `prisma generate` runs without a database (CI, postinstall), so the URL is
    // only required by commands that actually connect.
    url: process.env.DATABASE_URL ?? "",
  },
});
