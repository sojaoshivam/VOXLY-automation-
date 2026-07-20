import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

/**
 * READ-ONLY reference to the table owned by `voxly-v2-local`.
 * Do not add migrations that alter this table from this app.
 * Mirrors voxly-v2-local/src/db/schema.ts.
 */
export const videoProjects = pgTable("video_projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  localVideoPath: text("local_video_path").notNull(),
  localAudioPath: text("local_audio_path"),
  transcriptData: text("transcript_data"),
  finalExportPath: text("final_export_path"),
  cloudExportUrl: text("cloud_export_url"),
  backgroundOption: text("background_option").default("blur"),
  status: text("status").notNull().default("uploading"),
  createdAt: integer("created_at").notNull(),
});

/** Connected social platform accounts, one row per (user, platform account). */
export const socialAccounts = pgTable("social_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  platform: text("platform").notNull(), // 'youtube' | 'instagram'
  accountName: text("account_name"),
  // Tokens are stored encrypted at rest (see src/lib/crypto.js). Never sent to the client.
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  platformAccountId: text("platform_account_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Publishing jobs: one row per (project, platform) post. */
export const scheduledPosts = pgTable("scheduled_posts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id").notNull(), // -> video_projects.id
  socialAccountId: text("social_account_id"), // -> social_accounts.id
  platform: text("platform").notNull(), // 'youtube' | 'instagram'
  caption: text("caption"),
  hashtags: text("hashtags"),
  // 'draft' | 'scheduled' | 'publishing' | 'posted' | 'failed'
  status: text("status").notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  platformPostId: text("platform_post_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Per-user profile and notification preferences (owned by this app). */
export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name"),
  bio: text("bio"),
  timezone: text("timezone").default("America/New_York"),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  publishReminders: boolean("publish_reminders").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Per-user AI and app preferences (owned by this app). */
export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  aiAutoGenerate: boolean("ai_auto_generate").notNull().default(false),
  aiModel: text("ai_model").notNull().default("openai/gpt-4o-mini"),
  defaultVisibility: text("default_visibility").notNull().default("public"),
  defaultCategory: text("default_category").notNull().default("Short-form"),
  /** When true, cron auto-publishes cloud-ready videos to selected platforms. */
  autoPublishEnabled: boolean("auto_publish_enabled").notNull().default(false),
  /** JSON array of platform keys, e.g. '["youtube","instagram"]'. */
  autoPublishPlatforms: text("auto_publish_platforms")
    .notNull()
    .default('["youtube","instagram"]'),
  /** 'interval' = post every N hours; 'ai_optimal' = AI picks best times. */
  autoPublishScheduleMode: text("auto_publish_schedule_mode")
    .notNull()
    .default("interval"),
  /** Hours between auto-posts when schedule mode is 'interval'. */
  autoPublishIntervalHours: integer("auto_publish_interval_hours").notNull().default(6),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** AI-generated or user-edited publish metadata per project (owned by this app). */
export const projectMetadata = pgTable("project_metadata", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().unique(),
  userId: text("user_id").notNull(),
  title: text("title"),
  caption: text("caption"),
  hashtags: text("hashtags"),
  seedKeywords: text("seed_keywords"),
  aiGeneratedAt: timestamp("ai_generated_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
