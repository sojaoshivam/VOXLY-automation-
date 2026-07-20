import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { completeVision, hasLlmProvider } from "./llm";

export type FocalPoint = {
  focalXOffset: number;
  focalYOffset: number;
};

function getFfmpegPath(): string {
  const binary = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  return path.join(process.cwd(), "node_modules", "ffmpeg-static", binary);
}

/** Extract a single JPEG frame for vision analysis. */
function extractFrame(videoPath: string, seconds: number, outPath: string): boolean {
  const ffmpeg = getFfmpegPath();
  if (!fs.existsSync(ffmpeg)) return false;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const result = spawnSync(
    ffmpeg,
    [
      "-ss",
      String(seconds),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      "-y",
      outPath,
    ],
    { encoding: "utf8" }
  );
  return result.status === 0 && fs.existsSync(outPath);
}

/**
 * Detect the main speaker's face center via vision LLM (Gemini → OpenRouter)
 * and map it to the -1..1 focal offsets used by StageLayout object-position.
 */
export async function detectFaceFocal(
  videoPath: string,
  durationSec: number
): Promise<FocalPoint | null> {
  if (!hasLlmProvider()) return null;

  const sampleSec = Math.min(Math.max(durationSec * 0.25, 1), durationSec - 0.5);
  const framePath = path.join(
    process.cwd(),
    "public",
    "local-media",
    "_face_probe.jpg"
  );

  if (!extractFrame(videoPath, sampleSec, framePath)) return null;

  try {
    const imageBase64 = fs.readFileSync(framePath).toString("base64");
    const prompt = [
      "This is a frame from a talking-head / podcast video.",
      "Find the primary speaker's face (the person most likely speaking).",
      "Return ONLY valid JSON: {\"xPercent\": number, \"yPercent\": number}",
      "where xPercent and yPercent are the face center as percentages of",
      "image width/height (0=left/top, 100=right/bottom).",
      "If no face is visible, return {\"xPercent\": 50, \"yPercent\": 40}.",
    ].join(" ");

    const result = await completeVision(prompt, imageBase64);
    if (!result?.text) {
      console.warn("[FaceFocal] Vision LLM returned no text");
      return null;
    }

    const jsonText = result.text.replace(/```json|```/g, "").trim();
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as {
      xPercent?: number;
      yPercent?: number;
    };

    const x = typeof parsed.xPercent === "number" ? parsed.xPercent : 50;
    const y = typeof parsed.yPercent === "number" ? parsed.yPercent : 40;

    const focalXOffset = Math.max(-1, Math.min(1, (x - 50) / 50));
    const focalYOffset = Math.max(-1, Math.min(1, (y - 50) / 50));

    console.log(
      `[FaceFocal] (${result.provider}) Face at ${x.toFixed(0)}%, ${y.toFixed(0)}% → focal (${focalXOffset.toFixed(2)}, ${focalYOffset.toFixed(2)})`
    );

    return { focalXOffset, focalYOffset };
  } catch (err) {
    console.warn("[FaceFocal] Detection failed:", err);
    return null;
  } finally {
    try {
      fs.unlinkSync(framePath);
    } catch {
      /* ignore */
    }
  }
}

/** Podcast talking-head default when vision is unavailable. */
export const PODCAST_FOCAL_FALLBACK: FocalPoint = {
  focalXOffset: 0,
  focalYOffset: -0.12,
};
