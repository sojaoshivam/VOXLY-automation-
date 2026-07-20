import { getEmojiForWord, isFiller, isKeyword } from "./caption-emphasis";

export type DeepgramWord = {
  word: string;
  start: number;
  end: number;
  punctuated_word?: string;
  confidence?: number;
};

export function parseDeepgramWords(transcriptJson: string): DeepgramWord[] {
  const data = JSON.parse(transcriptJson);
  return data?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
}

export function getTranscriptDuration(words: DeepgramWord[]): number {
  return words.length ? words[words.length - 1].end + 0.5 : 30;
}

export function formatWordDisplay(word: DeepgramWord): string {
  const raw = word.punctuated_word || word.word || "";
  return raw.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toUpperCase();
}

/** A single rendered caption word with precomputed frame timing + emphasis. */
export type CaptionToken = {
  text: string;
  start: number;
  end: number;
  startFrame: number;
  endFrame: number;
  isFiller: boolean;
  isKeyword: boolean;
  emoji?: string;
};

/** A short caption block (one on-screen phrase) with frame-accurate bounds. */
export type CaptionBlock = {
  start: number;
  end: number;
  startFrame: number;
  endFrame: number;
  tokens: CaptionToken[];
};

export type CaptionBlockOptions = {
  fps: number;
  maxWords?: number;
  maxDurationSec?: number;
  maxPauseSec?: number;
  minDurationSec?: number;
};

function endsSentence(word: DeepgramWord): boolean {
  return /[.!?]$/.test(word.punctuated_word ?? word.word ?? "");
}

function cleanDisplay(word: DeepgramWord): string {
  const raw = word.punctuated_word || word.word || "";
  return raw.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()"]/g, "");
}

/**
 * Build short caption blocks from Deepgram words. Deliberately does NOT trust
 * the raw `utterances` array (podcast speech rambles, stutters, and pauses
 * mid-thought). Instead it enforces hard constraints and splits/merges:
 *   - start a new block on sentence-ending punctuation, a long pause, a word
 *     cap, or a duration cap
 *   - merge tiny breath-fragments into the previous block when the gap is small
 * Every token + block gets exact frame numbers (anti-drift): frame = round(s * fps).
 */
export function buildCaptionBlocks(
  words: DeepgramWord[],
  options: CaptionBlockOptions
): CaptionBlock[] {
  const {
    fps,
    maxWords = 5,
    maxDurationSec = 2.5,
    maxPauseSec = 0.4,
    minDurationSec = 0.5,
  } = options;

  if (!words.length) return [];

  // Pass 1: greedy split into raw groups under the constraints.
  const groups: DeepgramWord[][] = [];
  let current: DeepgramWord[] = [];

  for (const word of words) {
    const prev = current[current.length - 1];
    const groupStart = current.length ? current[0].start : word.start;
    const hitWordCap = current.length >= maxWords;
    const hitDurationCap = current.length > 0 && word.end - groupStart > maxDurationSec;
    const bigPause = prev && word.start - prev.end > maxPauseSec;

    if (current.length && (hitWordCap || hitDurationCap || bigPause)) {
      groups.push(current);
      current = [];
    }

    current.push(word);

    if (endsSentence(word)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);

  // Pass 2: merge fragments that are too short into the previous group, unless
  // doing so would cross a large pause or blow well past the word cap.
  const merged: DeepgramWord[][] = [];
  for (const group of groups) {
    const duration = group[group.length - 1].end - group[0].start;
    const prevGroup = merged[merged.length - 1];
    const isTiny = duration < minDurationSec || group.length === 1;

    if (prevGroup && isTiny) {
      const gap = group[0].start - prevGroup[prevGroup.length - 1].end;
      if (gap <= maxPauseSec && prevGroup.length + group.length <= maxWords + 2) {
        prevGroup.push(...group);
        continue;
      }
    }
    merged.push(group);
  }

  // Pass 3: project to frame-accurate tokens/blocks with emphasis metadata.
  return merged.map((group) => {
    const tokens: CaptionToken[] = group.map((word) => {
      const text = cleanDisplay(word);
      return {
        text,
        start: word.start,
        end: word.end,
        startFrame: Math.round(word.start * fps),
        endFrame: Math.round(word.end * fps),
        isFiller: isFiller(text),
        isKeyword: isKeyword(text),
        emoji: getEmojiForWord(text),
      };
    });

    return {
      start: group[0].start,
      end: group[group.length - 1].end,
      startFrame: Math.round(group[0].start * fps),
      endFrame: Math.round(group[group.length - 1].end * fps),
      tokens,
    };
  });
}
