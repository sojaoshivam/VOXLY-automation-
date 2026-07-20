ALTER TABLE "video_projects" ADD COLUMN IF NOT EXISTS "project_type" text DEFAULT 'podcast' NOT NULL;
ALTER TABLE "video_projects" ADD COLUMN IF NOT EXISTS "source_transcript_data" text;
ALTER TABLE "video_projects" ADD COLUMN IF NOT EXISTS "recap_script_data" text;
ALTER TABLE "video_projects" ADD COLUMN IF NOT EXISTS "commentary_audio_path" text;
ALTER TABLE "video_projects" ADD COLUMN IF NOT EXISTS "voiceover_transcript_data" text;
