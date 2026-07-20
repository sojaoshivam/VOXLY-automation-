import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { videoProjects } from "@/db/schema";
import ffmpegPath from "ffmpeg-static";
export async function POST(request: Request) {
  let rawVideoPath = "";
  try {
    const formData = await request.formData();
    const title = formData.get("title") as string;
    const videoFile = formData.get("video") as File | null;
    const audioFile = formData.get("audio") as File | null; // optional background MP3

    if (!title || !videoFile) {
      return NextResponse.json(
        { error: "Project Title and Video file are required." },
        { status: 400 }
      );
    }

    const projectId = uuidv4();

    // Ensure output directories exist locally inside the public static folder
    const mediaDir = path.join(process.cwd(), "public", "local-media");
    const exportsDir = path.join(mediaDir, "exports");
    
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Resolve FFmpeg path dynamically
    const binaryName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const resolvedFfmpegPath = path.join(
      process.cwd(),
      "node_modules",
      "ffmpeg-static",
      binaryName
    );

    const videoExt = path.extname(videoFile.name) || ".mp4";
    const finalVideoFileName = `${projectId}_video${videoExt}`;
    const finalVideoPath = path.join(mediaDir, finalVideoFileName);

    const selectedBgm = formData.get("selectedBgm") as string | null;
    const bgmStartOffset = formData.get("bgmStartOffset") as string | null;
    const bgmVolume = formData.get("bgmVolume") as string | null;
    let audioDbPath: string | null = null;
    const hasUploadedAudio = audioFile && audioFile.size > 0;
    const hasSelectedBgm = selectedBgm && selectedBgm.trim().length > 0;
    const hasAudio = hasUploadedAudio || hasSelectedBgm;

    if (hasAudio) {
      // 1. We have a background track. First save the raw video to a temp file
      const tempVideoFileName = `${projectId}_raw${videoExt}`;
      rawVideoPath = path.join(mediaDir, tempVideoFileName);
      const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
      await fs.promises.writeFile(rawVideoPath, videoBuffer);

      let audioFilePath = "";
      if (hasUploadedAudio) {
        // Save background MP3 BGM file from custom upload
        const audioExt = path.extname(audioFile.name) || ".mp3";
        const audioFileName = `${projectId}_audio${audioExt}`;
        audioFilePath = path.join(mediaDir, audioFileName);
        const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
        await fs.promises.writeFile(audioFilePath, audioBuffer);
        audioDbPath = `/local-media/${audioFileName}`;
      } else {
        // Use selected pre-downloaded BGM playlist track from public/bgm folder
        audioFilePath = path.join(process.cwd(), "public", "bgm", selectedBgm!);
        audioDbPath = `/bgm/${selectedBgm}`;
      }

      // Calculate BGM volume multiplier based on user preference (0-100 mapped to 0.0 - 1.0)
      let bgmVolumeMultiplier = "0.10";
      if (bgmVolume && !isNaN(parseFloat(bgmVolume))) {
        bgmVolumeMultiplier = (parseFloat(bgmVolume) / 100).toFixed(2);
      }

      // 2. Mix them instantly using FFmpeg stream copy for video
      // Copies the video track directly (-c:v copy) to render in <1 second with zero quality loss!
      const mixArgs = [
        "-i", rawVideoPath,
      ];
      if (bgmStartOffset && parseFloat(bgmStartOffset) > 0) {
        mixArgs.push("-ss", bgmStartOffset);
      }
      mixArgs.push(
        "-i", audioFilePath,
        "-filter_complex", `[1:a]volume=${bgmVolumeMultiplier}[bg];[0:a][bg]amix=inputs=2:duration=first[a]`,
        "-map", "0:v",
        "-map", "[a]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-y", finalVideoPath
      );

      console.log(`[Ingest Mixing] Spawning FFmpeg at: ${resolvedFfmpegPath}`);
      await new Promise<void>((resolve, reject) => {
        const ffmpegProcess = spawn(resolvedFfmpegPath, mixArgs) as any;
        let stderrLog = "";

        ffmpegProcess.stderr.on("data", (data: any) => {
          stderrLog += data.toString();
        });

        ffmpegProcess.on("close", (code: any) => {
          if (code === 0) {
            resolve();
          } else {
            console.error("FFmpeg Ingest Mixing failure logs:\n", stderrLog);
            reject(new Error(`FFmpeg mixing exited with code ${code}`));
          }
        });

        ffmpegProcess.on("error", (err: any) => {
          reject(err);
        });
      });

      // Cleanup temp raw video
      if (fs.existsSync(rawVideoPath)) {
        fs.unlinkSync(rawVideoPath);
      }

    } else {
      // No background track, save video directly
      const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
      await fs.promises.writeFile(finalVideoPath, videoBuffer);
    }

    const videoDbPath = `/local-media/${finalVideoFileName}`;

    // Write to SQLite
    const newProject = {
      id: projectId,
      title,
      localVideoPath: videoDbPath,
      localAudioPath: audioDbPath,
      status: "uploading",
      createdAt: Math.floor(Date.now() / 1000),
    };

    await db.insert(videoProjects).values(newProject);

    return NextResponse.json({
      success: true,
      project: newProject,
    });
  } catch (error: any) {
    console.error("Local Ingest Upload Error:", error);
    // Cleanup raw video if present on error
    if (rawVideoPath && fs.existsSync(rawVideoPath)) {
      try {
        fs.unlinkSync(rawVideoPath);
      } catch (e) {}
    }
    return NextResponse.json(
      { error: error?.message || "Internal Server Error in file ingestion." },
      { status: 500 }
    );
  }
}
