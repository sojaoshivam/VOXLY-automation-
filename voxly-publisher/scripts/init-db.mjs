import { createPgPool } from "../src/lib/db-pool.js";
import { loadEnvFile } from "../src/lib/load-env-file.js";

loadEnvFile(".env.local");
loadEnvFile(".env");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

// Idempotent creation of the tables this app owns (safe to re-run).
// video_projects is owned by voxly-v2-local and is intentionally untouched.
const SQL = `
CREATE TABLE IF NOT EXISTS social_accounts (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  platform text NOT NULL,
  account_name text,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  platform_account_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  project_id text NOT NULL,
  social_account_id text,
  platform text NOT NULL,
  caption text,
  hashtags text,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  posted_at timestamptz,
  platform_post_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_accounts_user_idx ON social_accounts (user_id);
CREATE INDEX IF NOT EXISTS scheduled_posts_user_idx ON scheduled_posts (user_id);
CREATE INDEX IF NOT EXISTS scheduled_posts_due_idx ON scheduled_posts (status, scheduled_at);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id text PRIMARY KEY,
  display_name text,
  bio text,
  timezone text DEFAULT 'America/New_York',
  email_notifications boolean NOT NULL DEFAULT true,
  publish_reminders boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id text PRIMARY KEY,
  ai_auto_generate boolean NOT NULL DEFAULT false,
  ai_model text NOT NULL DEFAULT 'gpt-4o-mini',
  default_visibility text NOT NULL DEFAULT 'public',
  default_category text NOT NULL DEFAULT 'Short-form',
  auto_publish_enabled boolean NOT NULL DEFAULT false,
  auto_publish_platforms text NOT NULL DEFAULT '["youtube","instagram"]',
  auto_publish_schedule_mode text NOT NULL DEFAULT 'interval',
  auto_publish_interval_hours integer NOT NULL DEFAULT 6,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS auto_publish_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS auto_publish_platforms text NOT NULL DEFAULT '["youtube","instagram"]';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS auto_publish_schedule_mode text NOT NULL DEFAULT 'interval';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS auto_publish_interval_hours integer NOT NULL DEFAULT 6;

CREATE TABLE IF NOT EXISTS project_metadata (
  id text PRIMARY KEY,
  project_id text NOT NULL UNIQUE,
  user_id text NOT NULL,
  title text,
  caption text,
  hashtags text,
  seed_keywords text,
  ai_generated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_metadata_user_idx ON project_metadata (user_id);
`;

const pool = createPgPool(connectionString);
try {
  await pool.query(SQL);
  console.log("✓ Publisher tables are ready.");
} catch (err) {
  console.error("Failed to initialize tables:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
