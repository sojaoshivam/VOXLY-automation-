import fs from "fs";
import path from "path";
import { generateSegmentVoiceovers } from "./sarvam-tts";
import { concatAudioFiles } from "./ffmpeg-media";
import type { RecapScriptData } from "./recap-types";

export async function buildRecapVoiceover(
  projectId: string,
  script: RecapScriptData
): Promise<{ absolutePath: string; webPath: string }> {
  const outputDir = path.join(
    process.cwd(),
    "public",
    "local-media",
    "recap-audio",
    projectId
  );

  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const segmentFiles = await generateSegmentVoiceovers(
    script.segments.map((s) => ({
      id: s.id,
      narration: s.narration,
      sourceStartSec: s.sourceStartSec,
      sourceEndSec: s.sourceEndSec,
    })),
    outputDir,
    { language: script.language, speaker: script.sarvamSpeaker }
  );

  const concatPath = path.join(outputDir, "voiceover.wav");
  await concatAudioFiles(
    segmentFiles.map((s) => s.filePath),
    concatPath
  );

  const webPath = `/local-media/recap-audio/${projectId}/voiceover.wav`;
  return { absolutePath: concatPath, webPath };
}
