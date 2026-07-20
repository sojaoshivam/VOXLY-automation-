/**
 * Creates MVP tables if they do not exist. Safe to run multiple times.
 * Usage: npx tsx scripts/init-postgres.ts
 */
import fs from "fs";
import path from "path";
import { loadEnvFile } from "../src/lib/load-env-file";
import { createPgPool } from "../src/lib/db-pool";

loadEnvFile();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL missing in .env");
  process.exit(1);
}

const pool = createPgPool(connectionString);

async function main() {
  const migrationsDir = path.resolve(process.cwd(), "src/db/migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  try {
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      await client.query(sql);
      console.log(`Applied migration: ${file}`);
    }
    console.log("PostgreSQL schema ready (video_projects).");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  const host =
    process.env.DATABASE_URL?.match(/@([^/]+)/)?.[1] || "(unknown host)";
  console.error("init-postgres failed:", err.message || err);
  console.error("DATABASE_URL host:", host);
  process.exit(1);
});
