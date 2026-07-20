import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { db } from "@/db";
import { videoProjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { exportKeyForProject, uploadLocalFile } from "@/lib/r2";
import { assertRecapProject, resolvePublicPath } from "@/lib/recap-api";
import { remotionTempEnv } from "@/lib/remotion-temp";

export async function POST(request: Request) {
  let tempTranscriptPath = "";
  try {
    const {
      projectId,
      theme = "hormozi",
      showTitle = true,
      fontSize = 64,
      textColor,
    } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const { project, response } = await assertRecapProject(projectId);
    if (response || !project) return response!;

    if (!project.transcriptData) {
      return NextResponse.json(
        { error: "Voiceover transcript missing. Transcribe voiceover first." },
        { status: 400 }
      );
    }

    if (!project.commentaryAudioPath) {
      return NextResponse.json(
        { error: "Voiceover audio missing. Generate voice first." },
        { status: 400 }
      );
    }

    const absoluteVideoPath = resolvePublicPath(project.localVideoPath);
    const absoluteAudioPath = resolvePublicPath(project.commentaryAudioPath);

    if (!fs.existsSync(absoluteVideoPath)) {
      return NextResponse.json(
        { error: `Movie clip not found: ${project.localVideoPath}` },
        { status: 404 }
      );
    }
    if (!fs.existsSync(absoluteAudioPath)) {
      return NextResponse.json(
        { error: `Voiceover not found: ${project.commentaryAudioPath}` },
        { status: 404 }
      );
    }

    await db
      .update(videoProjects)
      .set({ status: "processing" })
      .where(eq(videoProjects.id, projectId));

    const exportFileName = `${projectId}_rendered.mp4`;
    const absoluteExportPath = path.join(
      process.cwd(),
      "public",
      "local-media",
      "exports",
      exportFileName
    );
    const dbExportPath = `/local-media/exports/${exportFileName}`;

    tempTranscriptPath = path.join(
      process.cwd(),
      "public",
      "local-media",
      `temp_transcript_${projectId}.json`
    );
    fs.writeFileSync(tempTranscriptPath, project.transcriptData, "utf8");

    const renderScriptPath = path.join(
      process.cwd(),
      "scripts",
      "render-movie-recap.ts"
    );
    const tsxCli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
    const activeColorMap: Record<string, string> = {
      yellow: "#FFE600",
      white: "#FFFFFF",
      cyan: "#00FFFF",
      pink: "#FF69B4",
      green: "#3CF5B4",
    };

    const scriptArgs = [
      renderScriptPath,
      "--project-id",
      projectId,
      "--video-path",
      absoluteVideoPath,
      "--audio-path",
      absoluteAudioPath,
      "--transcript-path",
      tempTranscriptPath,
      "--title",
      project.title,
      "--output-path",
      absoluteExportPath,
      "--theme",
      theme,
      "--font-size",
      String(fontSize),
      "--show-title",
      String(showTitle),
    ];

    const mappedColor =
      textColor && activeColorMap[String(textColor).toLowerCase()];
    if (mappedColor) scriptArgs.push("--active-color", mappedColor);

    console.log(`[MovieRecap] Spawning render for project ${projectId}`);

    const renderer = spawn(process.execPath, [tsxCli, ...scriptArgs], {
      cwd: process.cwd(),
      shell: false,
      env: { ...process.env, ...remotionTempEnv() },
    });

    let stderrLog = "";

    renderer.stdout.on("data", (data) => {
      console.log(`[MovieRecap stdout]: ${data}`);
    });

    renderer.stderr.on("data", (data) => {
      stderrLog += data.toString();
      console.error(`[MovieRecap stderr]: ${data}`);
    });

    renderer.on("close", async (code) => {
      if (tempTranscriptPath && fs.existsSync(tempTranscriptPath)) {
        try {
          fs.unlinkSync(tempTranscriptPath);
        } catch {
          /* ignore */
        }
      }

      if (code === 0) {
        try {
          const objectKey = exportKeyForProject(projectId);
          const cloudUrl = await uploadLocalFile(absoluteExportPath, objectKey);
          await db
            .update(videoProjects)
            .set({
              finalExportPath: dbExportPath,
              cloudExportUrl: cloudUrl,
              status: "uploaded",
            })
            .where(eq(videoProjects.id, projectId));
        } catch (uploadErr) {
          console.error("[R2] Upload failed after movie render:", uploadErr);
          await db
            .update(videoProjects)
            .set({ finalExportPath: dbExportPath, status: "processing" })
            .where(eq(videoProjects.id, projectId));
        }
      } else {
        console.error(`[MovieRecap] Render failure:\n`, stderrLog);
        await db
          .update(videoProjects)
          .set({ status: "failed" })
          .where(eq(videoProjects.id, projectId));
      }
    });

    renderer.on("error", (err) => {
      console.error(`[MovieRecap] Spawn error:`, err);
    });

    return NextResponse.json({
      success: true,
      message: "Movie recap render initiated in the background.",
    });
  } catch (error: unknown) {
    if (tempTranscriptPath && fs.existsSync(tempTranscriptPath)) {
      try {
        fs.unlinkSync(tempTranscriptPath);
      } catch {
        /* ignore */
      }
    }
    const message = error instanceof Error ? error.message : "Render failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
