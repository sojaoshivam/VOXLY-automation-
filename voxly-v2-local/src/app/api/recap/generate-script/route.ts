import { NextResponse } from "next/server";
import { db } from "@/db";
import { videoProjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { assertRecapProject, resolvePublicPath } from "@/lib/recap-api";
import { generateRecapScript } from "@/lib/recap-script";
import { probeDurationSec } from "@/lib/ffmpeg-media";
import fs from "fs";
import { hasLlmProvider } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const { project, response } = await assertRecapProject(projectId);
    if (response || !project) return response!;

    if (!project.sourceTranscriptData) {
      return NextResponse.json(
        { error: "Source transcript missing. Transcribe the clip first." },
        { status: 400 }
      );
    }

    if (!hasLlmProvider()) {
      return NextResponse.json(
        { error: "LLM provider missing. Set GEMINI_API_KEY or OPENROUTER_API_KEY." },
        { status: 400 }
      );
    }

    const clipPath = resolvePublicPath(project.localVideoPath);
    const clipDurationSec = fs.existsSync(clipPath)
      ? await probeDurationSec(clipPath)
      : 30;

    const script = await generateRecapScript(
      project.sourceTranscriptData,
      clipDurationSec,
      project.title
    );

    await db
      .update(videoProjects)
      .set({ recapScriptData: JSON.stringify(script) })
      .where(eq(videoProjects.id, projectId));

    return NextResponse.json({ success: true, script });
  } catch (error: unknown) {
    console.error("[Recap Generate Script]", error);
    const message = error instanceof Error ? error.message : "Script generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
