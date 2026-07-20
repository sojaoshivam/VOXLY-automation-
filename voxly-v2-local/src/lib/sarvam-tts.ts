import fs from "fs";
import path from "path";

export type SarvamTtsOptions = {
  text: string;
  language?: string;
  speaker?: string;
  pace?: number;
  outputPath: string;
};

function sarvamApiKey(): string | null {
  const key = process.env.SARVAM_API_KEY;
  if (!key || key === "placeholder") return null;
  return key;
}

function decodeAudioPayload(data: unknown): Buffer | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  if (Array.isArray(obj.audios) && typeof obj.audios[0] === "string") {
    return Buffer.from(obj.audios[0], "base64");
  }

  if (typeof obj.audio === "string") {
    return Buffer.from(obj.audio, "base64");
  }

  if (typeof obj.data === "string") {
    return Buffer.from(obj.data, "base64");
  }

  return null;
}

export function hasSarvamKey(): boolean {
  return Boolean(sarvamApiKey());
}

export async function synthesizeSpeech(options: SarvamTtsOptions): Promise<string> {
  const apiKey = sarvamApiKey();
  if (!apiKey) {
    throw new Error("SARVAM_API_KEY is missing. Add it to .env to generate voiceover.");
  }

  const language = options.language ?? process.env.SARVAM_LANGUAGE ?? "en-IN";
  const speaker = options.speaker ?? process.env.SARVAM_SPEAKER ?? "shubh";
  const pace = options.pace ?? 1.0;

  const body: Record<string, unknown> = {
    text: options.text,
    target_language_code: language,
    model: "bulbul:v3",
    speaker,
    pace,
    speech_sample_rate: 24000,
    output_audio_codec: "wav",
  };

  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Sarvam TTS ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`);
  }

  const data = await res.json();
  const audioBuffer = decodeAudioPayload(data);

  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error("Sarvam TTS returned no audio data");
  }

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, audioBuffer);
  return options.outputPath;
}

export async function generateSegmentVoiceovers(
  segments: Array<{ id: string; narration: string; sourceStartSec: number; sourceEndSec: number }>,
  outputDir: string,
  options: { language?: string; speaker?: string }
): Promise<Array<{ id: string; filePath: string; targetSec: number }>> {
  const results: Array<{ id: string; filePath: string; targetSec: number }> = [];

  for (const segment of segments) {
    const targetSec = Math.max(0.5, segment.sourceEndSec - segment.sourceStartSec);
    const rawPath = path.join(outputDir, `${segment.id}_raw.wav`);
    const fittedPath = path.join(outputDir, `${segment.id}.wav`);

    await synthesizeSpeech({
      text: segment.narration,
      language: options.language,
      speaker: options.speaker,
      outputPath: rawPath,
    });

    const { fitAudioToDuration } = await import("./ffmpeg-media");
    await fitAudioToDuration(rawPath, fittedPath, targetSec);

    if (fs.existsSync(rawPath) && rawPath !== fittedPath) {
      try {
        fs.unlinkSync(rawPath);
      } catch {
        /* ignore */
      }
    }

    results.push({ id: segment.id, filePath: fittedPath, targetSec });
  }

  return results;
}
