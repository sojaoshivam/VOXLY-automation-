import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { videoProjects } from "@/db/schema";
import { probeDurationSec } from "@/lib/ffmpeg-media";
import { recapError } from "@/lib/recap-api";

const MAX_CLIP_SEC = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const title = (formData.get("title") as string)?.trim();
    const videoFile = formData.get("video") as File | null;

    if (!title || !videoFile) {
      return recapError("Project title and movie clip (MP4) are required.");
    }

    const projectId = uuidv4();
    const mediaDir = path.join(process.cwd(), "public", "local-media");
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }

    const videoExt = path.extname(videoFile.name) || ".mp4";
    const finalVideoFileName = `${projectId}_movie${videoExt}`;
    const finalVideoPath = path.join(mediaDir, finalVideoFileName);

    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    await fs.promises.writeFile(finalVideoPath, videoBuffer);

    const durationSec = await probeDurationSec(finalVideoPath);
    if (durationSec > MAX_CLIP_SEC) {
      fs.unlinkSync(finalVideoPath);
      return recapError(
        `Movie clip must be ${MAX_CLIP_SEC}s or shorter (got ${durationSec.toFixed(1)}s). Trim before upload.`
      );
    }

    const videoDbPath = `/local-media/${finalVideoFileName}`;

    const newProject = {
      id: projectId,
      title,
      projectType: "movie_recap" as const,
      localVideoPath: videoDbPath,
      status: "uploading" as const,
      createdAt: Math.floor(Date.now() / 1000),
    };

    await db.insert(videoProjects).values(newProject);

    return NextResponse.json({
      success: true,
      project: newProject,
      durationSec,
    });
  } catch (error: unknown) {
    console.error("[Recap Upload]", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
