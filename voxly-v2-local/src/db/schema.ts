import { pgTable, text, integer } from "drizzle-orm/pg-core";

export const videoProjects = pgTable("video_projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  projectType: text("project_type").notNull().default("podcast"),
  localVideoPath: text("local_video_path").notNull(),
  localAudioPath: text("local_audio_path"),
  transcriptData: text("transcript_data"),
  sourceTranscriptData: text("source_transcript_data"),
  recapScriptData: text("recap_script_data"),
  commentaryAudioPath: text("commentary_audio_path"),
  voiceoverTranscriptData: text("voiceover_transcript_data"),
  finalExportPath: text("final_export_path"),
  cloudExportUrl: text("cloud_export_url"),
  backgroundOption: text("background_option").default("blur"),
  status: text("status").notNull().default("uploading"),
  createdAt: integer("created_at").notNull(),
});

export type ProjectType = "podcast" | "movie_recap";

export type VideoProjectStatus =
  | "uploading"
  | "processing"
  | "uploaded"
  | "failed";
