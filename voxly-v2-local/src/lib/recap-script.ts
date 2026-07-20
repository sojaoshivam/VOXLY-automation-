import fs from "fs";
import path from "path";
import { completeText } from "./llm";
import { buildCaptionBlocks, parseDeepgramWords } from "./deepgram";
import type { RecapScriptData, RecapScriptSegment } from "./recap-types";
import { v4 as uuidv4 } from "uuid";

const MAX_CLIP_SEC = 60;

function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1);
  return `${m}:${s.padStart(4, "0")}`;
}

function buildTimedBlocks(transcriptJson: string, clipDurationSec: number) {
  const words = parseDeepgramWords(transcriptJson);
  if (!words.length) {
    const segmentCount = 4;
    const segLen = clipDurationSec / segmentCount;
    return Array.from({ length: segmentCount }, (_, i) => ({
      start: i * segLen,
      end: Math.min((i + 1) * segLen, clipDurationSec),
      phrase: `Scene segment ${i + 1}`,
    }));
  }

  const blocks = buildCaptionBlocks(words, {
    fps: 30,
    maxWords: 8,
    maxDurationSec: Math.max(3, clipDurationSec / 5),
    maxPauseSec: 0.6,
  });

  if (!blocks.length) {
    return [
      {
        start: 0,
        end: clipDurationSec,
        phrase: words.map((w) => w.punctuated_word || w.word).join(" "),
      },
    ];
  }

  return blocks.map((block) => ({
    start: block.start,
    end: block.end,
    phrase: block.tokens.map((t) => t.text).filter(Boolean).join(" "),
  }));
}

function fallbackScript(
  blocks: Array<{ start: number; end: number; phrase: string }>,
  clipDurationSec: number
): RecapScriptData {
  const segments: RecapScriptSegment[] = blocks.map((block, i) => ({
    id: uuidv4(),
    sourceStartSec: block.start,
    sourceEndSec: block.end,
    narration: `In this moment, the scene shifts as ${block.phrase || `action unfolds in segment ${i + 1}`}.`,
  }));

  if (!segments.length) {
    segments.push({
      id: uuidv4(),
      sourceStartSec: 0,
      sourceEndSec: clipDurationSec,
      narration: "A tense scene unfolds on screen as the story takes a dramatic turn.",
    });
  }

  return {
    language: "en-IN",
    sarvamSpeaker: process.env.SARVAM_SPEAKER || "shubh",
    segments,
  };
}

export async function generateRecapScript(
  sourceTranscriptJson: string,
  clipDurationSec: number,
  title: string
): Promise<RecapScriptData> {
  const cappedDuration = Math.min(clipDurationSec, MAX_CLIP_SEC);
  const blocks = buildTimedBlocks(sourceTranscriptJson, cappedDuration);

  const blockLines = blocks
    .map(
      (b, i) =>
        `${i + 1}. [${formatTimestamp(b.start)} – ${formatTimestamp(b.end)}] Original dialogue/context: "${b.phrase}"`
    )
    .join("\n");

  const prompt = [
    "You are a movie recap writer for vertical YouTube Shorts.",
    "",
    `Scene title: "${title || "Untitled scene"}"`,
    `Clip duration: ${cappedDuration.toFixed(1)} seconds`,
    "",
    "Given timestamped dialogue/context from a movie scene, write NEW narration that EXPLAINS what is happening on screen.",
    "Do NOT quote original dialogue verbatim. Use fresh words in third-person cinematic explainer tone.",
    "Each segment must match the exact time range provided.",
    "",
    "OUTPUT: JSON array only (no markdown), one object per block below, same order:",
    '{ "sourceStartSec": number, "sourceEndSec": number, "narration": "1-2 short sentences" }',
    "",
    "RULES:",
    "- Keep narration speakable within each segment's duration",
    "- Punchy, dramatic, clear for viewers who haven't seen the film",
    "- 3-8 segments total",
    "",
    "TIMED BLOCKS:",
    blockLines,
    "",
    "Return ONLY the JSON array.",
  ].join("\n");

  const result = await completeText(prompt);
  if (!result?.text) {
    return fallbackScript(blocks, cappedDuration);
  }

  const jsonText = result.text.replace(/```json|```/g, "").trim();
  const match = jsonText.match(/\[[\s\S]*\]/);
  if (!match) {
    return fallbackScript(blocks, cappedDuration);
  }

  try {
    const parsed = JSON.parse(match[0]) as Array<{
      sourceStartSec?: number;
      sourceEndSec?: number;
      narration?: string;
    }>;

    const segments: RecapScriptSegment[] = parsed
      .map((entry, i) => {
        const fallback = blocks[i] ?? blocks[blocks.length - 1];
        const narration = entry.narration?.trim();
        if (!narration) return null;
        return {
          id: uuidv4(),
          sourceStartSec:
            typeof entry.sourceStartSec === "number"
              ? entry.sourceStartSec
              : fallback?.start ?? 0,
          sourceEndSec:
            typeof entry.sourceEndSec === "number"
              ? entry.sourceEndSec
              : fallback?.end ?? cappedDuration,
          narration,
        };
      })
      .filter(Boolean) as RecapScriptSegment[];

    if (!segments.length) {
      return fallbackScript(blocks, cappedDuration);
    }

    return {
      language: "en-IN",
      sarvamSpeaker: process.env.SARVAM_SPEAKER || "shubh",
      segments,
    };
  } catch {
    return fallbackScript(blocks, cappedDuration);
  }
}
