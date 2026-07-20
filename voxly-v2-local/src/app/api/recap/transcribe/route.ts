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

    const absoluteVideoPath = resolvePublicPath(project.localVideoPath);
    if (!fs.existsSync(absoluteVideoPath)) {
      return NextResponse.json(
        { error: `Movie clip not found: ${project.localVideoPath}` },
        { status: 404 }
      );
    }

    const { transcriptJson, transcriptObj } = await transcribeMediaFile(
      absoluteVideoPath,
      { tempId: `${projectId}_source`, mockLabel: "source-clip" }
    );

    await db
      .update(videoProjects)
      .set({ sourceTranscriptData: transcriptJson, status: "processing" })
      .where(eq(videoProjects.id, projectId));

    return NextResponse.json({
      success: true,
      transcript: transcriptObj,
    });
  } catch (error: unknown) {
    console.error("[Recap Transcribe]", error);
    const message = error instanceof Error ? error.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
