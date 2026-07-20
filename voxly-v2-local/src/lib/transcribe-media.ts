import fs from "fs";
import path from "path";
import { DeepgramClient } from "@deepgram/sdk";
import { extractAudioWav } from "./ffmpeg-media";
import type { DeepgramWord } from "./deepgram";

function buildMockTranscript(label: string): {
  transcriptObj: Record<string, unknown>;
  words: DeepgramWord[];
} {
  const mockWordsText = [
    "This",
    "is",
    "a",
    "sample",
    "movie",
    "scene",
    "with",
    "dramatic",
    "dialogue",
    "unfolding",
    "on",
    "screen",
    "right",
    "now.",
  ];

  const words: DeepgramWord[] = [];
  let currentTime = 0.5;

  mockWordsText.forEach((word, index) => {
    const start = parseFloat(currentTime.toFixed(2));
    const duration = 0.25 + Math.random() * 0.15;
    const end = parseFloat((currentTime + duration).toFixed(2));
    currentTime = end + 0.05;

    let punctuated = word;
    if (index === mockWordsText.length - 1) punctuated = word;

    words.push({
      word: word.toLowerCase(),
      start,
      end,
      confidence: 0.98,
      punctuated_word: punctuated,
    });
  });

  const transcriptObj = {
    metadata: {
      transaction_key: "mock-tx-key",
      request_id: "mock-req-id",
      created: new Date().toISOString(),
      duration: currentTime,
      channels: 1,
      models: ["nova-2"],
      label,
    },
    results: {
      channels: [
        {
          alternatives: [
            {
              transcript: mockWordsText.join(" "),
              confidence: 0.98,
              words,
            },
          ],
        },
      ],
    },
  };

  return { transcriptObj, words };
}

export async function transcribeMediaFile(
  mediaPath: string,
  options: { tempId: string; mockLabel?: string }
): Promise<{ transcriptJson: string; transcriptObj: Record<string, unknown> }> {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey || apiKey === "placeholder") {
    const { transcriptObj } = buildMockTranscript(options.mockLabel ?? "mock");
    return {
      transcriptJson: JSON.stringify(transcriptObj),
      transcriptObj,
    };
  }

  const tempAudioPath = path.join(
    process.cwd(),
    "public",
    "local-media",
    `extract_${options.tempId}.wav`
  );

  try {
    await extractAudioWav(mediaPath, tempAudioPath);
    const fileBuffer = fs.readFileSync(tempAudioPath);
    const deepgram = new DeepgramClient({ apiKey });

    const result = await deepgram.listen.v1.media.transcribeFile(fileBuffer, {
      model: "nova-2",
      smart_format: true,
      utterances: true,
      punctuate: true,
    });

    const transcriptObj = result as unknown as Record<string, unknown>;
    return {
      transcriptJson: JSON.stringify(transcriptObj),
      transcriptObj,
    };
  } finally {
    if (fs.existsSync(tempAudioPath)) {
      try {
        fs.unlinkSync(tempAudioPath);
      } catch {
        /* ignore */
      }
    }
  }
}

export function publicPathToAbsolute(webPath: string): string {
  const normalized = webPath.startsWith("/") ? webPath.slice(1) : webPath;
  return path.join(process.cwd(), "public", normalized);
}
