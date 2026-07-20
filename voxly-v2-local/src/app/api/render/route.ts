import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { db } from "@/db";
import { videoProjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { exportKeyForProject, uploadLocalFile } from "@/lib/r2";
import { remotionTempEnv } from "@/lib/remotion-temp";

export async function POST(request: Request) {
  let tempTranscriptPath = "";
  try {
    const {
      projectId,
      backgroundOption = "blur",
      theme = "hormozi",
      showTitle = true,
      enableZoom = true,
      enableBroll = Boolean(process.env.PEXELS_API_KEY),
      focalXOffset = 0,
      focalYOffset = 0,
      fontSize = 64,
      textColor,
    } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const [project] = await db
      .select()
      .from(videoProjects)
      .where(eq(videoProjects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await db
      .update(videoProjects)
      .set({ backgroundOption, status: "processing" })
      .where(eq(videoProjects.id, projectId));

    if (!project.transcriptData) {
      return NextResponse.json(
        { error: "No transcription found. Please transcribe the video first." },
        { status: 400 }
      );
    }

    const absoluteVideoPath = path.join(
      process.cwd(),
      "public",
      project.localVideoPath
    );

    if (!fs.existsSync(absoluteVideoPath)) {
      return NextResponse.json(
        { error: `Source video not found: ${project.localVideoPath}` },
        { status: 404 }
      );
    }

    const exportFileName = `${projectId}_rendered.mp4`;
    const absoluteExportPath = path.join(
      process.cwd(),
      "public",
      "local-media",
      "exports",
      exportFileName
    );
    const dbExportPath = `/local-media/exports/${exportFileName}`;

    // Write transcript to temp file to avoid Windows CLI length limits
    tempTranscriptPath = path.join(
      process.cwd(),
      "public",
      "local-media",
      `temp_transcript_${projectId}.json`
    );
    fs.writeFileSync(tempTranscriptPath, project.transcriptData, "utf8");

    const renderScriptPath = path.join(process.cwd(), "scripts", "render-remotion.ts");
    const tsxCli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
    const activeColorMap: Record<string, string> = {
      yellow: "#FFE600",
      white: "#FFFFFF",
      cyan: "#00FFFF",
      pink: "#FF69B4",
      green: "#3CF5B4",
      red: "#FF4444",
      orange: "#FFA500",
    };

    const scriptArgs = [
      renderScriptPath,
      "--project-id", projectId,
      "--video-path", absoluteVideoPath,
      "--transcript-path", tempTranscriptPath,
      "--title", project.title,
      "--background", backgroundOption,
      "--output-path", absoluteExportPath,
      "--theme", theme,
      "--font-size", String(fontSize),
      "--show-title", String(showTitle),
      "--zoom", String(enableZoom),
      "--focal-x", String(focalXOffset),
      "--focal-y", String(focalYOffset),
    ];

    const mappedColor =
      textColor && activeColorMap[String(textColor).toLowerCase()];
    if (mappedColor) scriptArgs.push("--active-color", mappedColor);
    if (enableBroll) scriptArgs.push("--broll", "true");
    scriptArgs.push("--auto-framing", "true");

    console.log(`[Remotion] Spawning render for project ${projectId} (broll=${enableBroll})`);

    const renderer = spawn(process.execPath, [tsxCli, ...scriptArgs], {
      cwd: process.cwd(),
      shell: false,
      env: { ...process.env, ...remotionTempEnv() },
    });

    let stderrLog = "";

    renderer.stdout.on("data", (data) => {
      console.log(`[Remotion stdout]: ${data}`);
    });

    renderer.stderr.on("data", (data) => {
      stderrLog += data.toString();
      console.error(`[Remotion stderr]: ${data}`);
    });

    renderer.on("close", async (code) => {
      console.log(`[Remotion] process exited with code ${code}`);

      if (tempTranscriptPath && fs.existsSync(tempTranscriptPath)) {
        try {
          fs.unlinkSync(tempTranscriptPath);
        } catch {
          /* ignore */
        }
      }

      if (code === 0) {
        console.log(`[Remotion] Render complete! Uploading to R2...`);
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
          console.log(`[R2] Uploaded ${objectKey} -> ${cloudUrl}`);
        } catch (uploadErr) {
          console.error("[R2] Upload failed after render:", uploadErr);
          await db
            .update(videoProjects)
            .set({ finalExportPath: dbExportPath, status: "processing" })
            .where(eq(videoProjects.id, projectId));
        }
      } else {
        console.error(`[Remotion] Render failure. Logs:\n`, stderrLog);
        await db
          .update(videoProjects)
          .set({ status: "failed" })
          .where(eq(videoProjects.id, projectId));
      }
    });

    renderer.on("error", (err) => {
      console.error(`[Remotion] Spawn error:`, err);
      if (tempTranscriptPath && fs.existsSync(tempTranscriptPath)) {
        try {
          fs.unlinkSync(tempTranscriptPath);
        } catch {
          /* ignore */
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: "Remotion render initiated in the background.",
    });
  } catch (error: unknown) {
    console.error("Local rendering engine failed:", error);

    if (tempTranscriptPath && fs.existsSync(tempTranscriptPath)) {
      try {
        fs.unlinkSync(tempTranscriptPath);
      } catch {
        /* ignore */
      }
    }

    const message =
      error instanceof Error ? error.message : "Remotion render process failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
