CREATE TABLE IF NOT EXISTS "video_projects" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "local_video_path" text NOT NULL,
  "local_audio_path" text,
  "transcript_data" text,
  "final_export_path" text,
  "cloud_export_url" text,
  "background_option" text DEFAULT 'blur',
  "status" text DEFAULT 'uploading' NOT NULL,
  "created_at" integer NOT NULL
);
