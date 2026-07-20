import { NextResponse } from "next/server";
import { db } from "@/db";
import { videoProjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { assertRecapProject } from "@/lib/recap-api";
import { parseRecapScript } from "@/lib/recap-types";
import { buildRecapVoiceover } from "@/lib/recap-voiceover";
import { hasSarvamKey } from "@/lib/sarvam-tts";

export async function POST(request: Request) {
  try {
    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    if (!hasSarvamKey()) {
      return NextResponse.json(
        { error: "SARVAM_API_KEY is missing. Add it to .env to generate voiceover." },
        { status: 400 }
      );
    }

    const { project, response } = await assertRecapProject(projectId);
    if (response || !project) return response!;

    const script = parseRecapScript(project.recapScriptData);
    if (!script?.segments?.length) {
      return NextResponse.json(
        { error: "Recap script missing. Generate or edit the script first." },
        { status: 400 }
      );
    }

    const { webPath } = await buildRecapVoiceover(projectId, script);

    await db
      .update(videoProjects)
      .set({ commentaryAudioPath: webPath, status: "processing" })
      .where(eq(videoProjects.id, projectId));

    return NextResponse.json({
      success: true,
      commentaryAudioPath: webPath,
    });
  } catch (error: unknown) {
    console.error("[Recap Generate Voice]", error);
    const message = error instanceof Error ? error.message : "Voice generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
