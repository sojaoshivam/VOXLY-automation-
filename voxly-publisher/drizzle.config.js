import { defineConfig } from "drizzle-kit";
import { loadEnvFile } from "./src/lib/load-env-file.js";

loadEnvFile(".env.local");
loadEnvFile(".env");

export default defineConfig({
  // Only the tables this app owns are pushed. video_projects is owned by voxly-v2-local.
  schema: "./src/db/schema.js",
  out: "./src/db/migrations",
  dialect: "postgresql",
  // Guard rail: never let migrations/push touch the table owned by voxly-v2-local.
  tablesFilter: ["social_accounts", "scheduled_posts", "user_profiles", "user_settings", "project_metadata"],
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
