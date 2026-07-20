import { NextResponse } from "next/server";
import { db } from "@/db";
import { videoProjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { assertRecapProject } from "@/lib/recap-api";
import type { RecapScriptData } from "@/lib/recap-types";
import { v4 as uuidv4 } from "uuid";

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { projectId, script } = body as {
      projectId?: string;
      script?: RecapScriptData;
    };

    if (!projectId || !script?.segments?.length) {
      return NextResponse.json(
        { error: "projectId and script with segments are required" },
        { status: 400 }
      );
    }

    const { project, response } = await assertRecapProject(projectId);
    if (response || !project) return response!;

    const normalized: RecapScriptData = {
      language: script.language || "en-IN",
      sarvamSpeaker: script.sarvamSpeaker || "shubh",
      segments: script.segments.map((seg) => ({
        id: seg.id || uuidv4(),
        sourceStartSec: Number(seg.sourceStartSec),
        sourceEndSec: Number(seg.sourceEndSec),
        narration: String(seg.narration || "").trim(),
      })).filter((seg) => seg.narration.length > 0),
    };

    if (!normalized.segments.length) {
      return NextResponse.json({ error: "At least one narration segment is required" }, { status: 400 });
    }

    await db
      .update(videoProjects)
      .set({ recapScriptData: JSON.stringify(normalized) })
      .where(eq(videoProjects.id, projectId));

    return NextResponse.json({ success: true, script: normalized });
  } catch (error: unknown) {
    console.error("[Recap Script Update]", error);
    const message = error instanceof Error ? error.message : "Failed to save script";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
