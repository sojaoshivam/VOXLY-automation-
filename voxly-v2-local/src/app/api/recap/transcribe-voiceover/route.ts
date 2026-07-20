import { NextResponse } from "next/server";
import fs from "fs";
import { db } from "@/db";
import { videoProjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { assertRecapProject, resolvePublicPath } from "@/lib/recap-api";
import { transcribeMediaFile } from "@/lib/transcribe-media";

export async function POST(request: Request) {
  try {
    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const { project, response } = await assertRecapProject(projectId);
    if (response || !project) return response!;

    if (!project.commentaryAudioPath) {
      return NextResponse.json(
        { error: "Voiceover audio missing. Generate voice first." },
        { status: 400 }
      );
    }

    const absoluteAudioPath = resolvePublicPath(project.commentaryAudioPath);
    if (!fs.existsSync(absoluteAudioPath)) {
      return NextResponse.json(
        { error: `Voiceover file not found: ${project.commentaryAudioPath}` },
        { status: 404 }
      );
    }

    const { transcriptJson, transcriptObj } = await transcribeMediaFile(
      absoluteAudioPath,
      { tempId: `${projectId}_voice`, mockLabel: "voiceover" }
    );

    await db
      .update(videoProjects)
      .set({
        transcriptData: transcriptJson,
        voiceoverTranscriptData: transcriptJson,
        status: "processing",
      })
      .where(eq(videoProjects.id, projectId));

    return NextResponse.json({
      success: true,
      transcript: transcriptObj,
    });
  } catch (error: unknown) {
    console.error("[Recap Transcribe Voiceover]", error);
    const message = error instanceof Error ? error.message : "Voiceover transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
