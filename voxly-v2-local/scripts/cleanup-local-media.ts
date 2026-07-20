import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, isNotNull } from "drizzle-orm";
import { createPgPool } from "../src/lib/db-pool";
import { videoProjects } from "../src/db/schema";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

loadEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set in .env");
  process.exit(1);
}

const pool = createPgPool(connectionString);
const db = drizzle(pool, { schema: { videoProjects } });

function resolvePublicPath(dbPath: string | null): string | null {
  if (!dbPath) return null;
  const normalized = dbPath.startsWith("/") ? dbPath.slice(1) : dbPath;
  return path.join(process.cwd(), "public", normalized);
}

function deleteIfExists(filePath: string | null): number {
  if (!filePath || !fs.existsSync(filePath)) return 0;
  const stat = fs.statSync(filePath);
  fs.unlinkSync(filePath);
  return stat.size;
}

async function main() {
  const uploaded = await db
    .select()
    .from(videoProjects)
    .where(
      and(eq(videoProjects.status, "uploaded"), isNotNull(videoProjects.cloudExportUrl))
    );

  console.log(`Found ${uploaded.length} uploaded project(s) with cloud URLs.\n`);

  let totalFreed = 0;
  let filesDeleted = 0;

  for (const project of uploaded) {
    const sourcePath = resolvePublicPath(project.localVideoPath);
    const exportPath = resolvePublicPath(project.finalExportPath);

    let projectFreed = 0;

    if (sourcePath && fs.existsSync(sourcePath)) {
      const size = deleteIfExists(sourcePath);
      projectFreed += size;
      filesDeleted++;
      console.log(`  ✓ source  ${path.basename(sourcePath)} (${(size / 1e6).toFixed(1)} MB)`);
    }

    if (exportPath && fs.existsSync(exportPath)) {
      const size = deleteIfExists(exportPath);
      projectFreed += size;
      filesDeleted++;
      console.log(`  ✓ export  ${path.basename(exportPath)} (${(size / 1e6).toFixed(1)} MB)`);
    }

    if (projectFreed > 0) {
      console.log(`    ${project.title} — freed ${(projectFreed / 1e6).toFixed(1)} MB\n`);
      totalFreed += projectFreed;
    }
  }

  // Remove orphaned temp files
  const mediaDir = path.join(process.cwd(), "public", "local-media");
  const tempPatterns = [/^extract_.*\.wav$/, /^temp_.*\.(ass|json)$/];
  for (const file of fs.readdirSync(mediaDir)) {
    if (tempPatterns.some((re) => re.test(file))) {
      const fp = path.join(mediaDir, file);
      const size = deleteIfExists(fp);
      if (size > 0) {
        filesDeleted++;
        totalFreed += size;
        console.log(`  ✓ temp    ${file}`);
      }
    }
  }

  console.log(`\nDone: ${filesDeleted} file(s) deleted, ${(totalFreed / 1e9).toFixed(2)} GB freed on D:`);
  console.log("Uploaded projects remain in DB; final videos still on R2.");

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
