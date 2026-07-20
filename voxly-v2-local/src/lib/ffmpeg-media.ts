import fs from "fs";
import path from "path";
import { spawn } from "child_process";

function getFfmpegPath(): string {
  const binary = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  return path.join(process.cwd(), "node_modules", "ffmpeg-static", binary);
}

export function runFfmpeg(args: string[]): Promise<void> {
  const ffmpeg = getFfmpegPath();
  if (!fs.existsSync(ffmpeg)) {
    return Promise.reject(new Error("ffmpeg-static binary not found"));
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, args);
    let stderr = "";

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-400)}`));
    });

    proc.on("error", reject);
  });
}

/** Parse duration in seconds from ffmpeg -i stderr output. */
export async function probeDurationSec(mediaPath: string): Promise<number> {
  const ffmpeg = getFfmpegPath();
  if (!fs.existsSync(ffmpeg)) {
    throw new Error("ffmpeg-static binary not found");
  }
  if (!fs.existsSync(mediaPath)) {
    throw new Error(`Media file not found: ${mediaPath}`);
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, ["-i", mediaPath]);
    let stderr = "";

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!match) {
        reject(new Error("Could not parse media duration"));
        return;
      }
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseFloat(match[3]);
      resolve(hours * 3600 + minutes * 60 + seconds);
    });

    proc.on("error", reject);
  });
}

export async function extractAudioWav(
  inputPath: string,
  outputPath: string
): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await runFfmpeg([
    "-i",
    inputPath,
    "-vn",
    "-acodec",
    "pcm_s16le",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-y",
    outputPath,
  ]);
}

export async function concatAudioFiles(
  inputPaths: string[],
  outputPath: string
): Promise<void> {
  if (!inputPaths.length) {
    throw new Error("No audio files to concatenate");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  if (inputPaths.length === 1) {
    fs.copyFileSync(inputPaths[0], outputPath);
    return;
  }

  const listPath = `${outputPath}.concat.txt`;
  const listContent = inputPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  fs.writeFileSync(listPath, listContent, "utf8");

  try {
    await runFfmpeg([
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      "-y",
      outputPath,
    ]);
  } finally {
    if (fs.existsSync(listPath)) fs.unlinkSync(listPath);
  }
}

/** Pad or trim audio to target duration using apad/atrim. */
export async function fitAudioToDuration(
  inputPath: string,
  outputPath: string,
  targetSec: number
): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await runFfmpeg([
    "-i",
    inputPath,
    "-af",
    `apad=pad_dur=${targetSec},atrim=0:${targetSec}`,
    "-y",
    outputPath,
  ]);
}
