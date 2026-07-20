import fs from "fs";
import path from "path";
import type { CaptionBlock } from "./deepgram";
import { getEmojiForWord, isFiller, normalizeWord } from "./caption-emphasis";
import { completeText } from "./llm";

export type BrollMediaType = "image" | "video";

export type BrollItem = {
  startFrame: number;
  endFrame: number;
  url: string;
  type: BrollMediaType;
};

type BrollQuery = {
  query: string;
  media: BrollMediaType;
};

type PlanOptions = {
  enabled: boolean;
  fps?: number;
  maxItems?: number;
  minGapSec?: number;
  /** Minimum clip length in seconds (avoids invisible flash overlays). */
  minClipSec?: number;
  projectId?: string;
  /** Podcast episode / clip title shown in the edit. */
  title?: string;
};

type CandidateMoment = {
  phrase: string;
  timestampSec: number;
  contextBefore: string;
  contextAfter: string;
};

const MIN_CLIP_FRAMES_DEFAULT = 90; // 3s at 30fps
const PEXELS_GAP_MS = 900;

const MAX_TRANSCRIPT_CHARS = 4500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function selectCandidates(
  blocks: CaptionBlock[],
  maxItems: number,
  minGapSec: number
): CaptionBlock[] {
  const picked: CaptionBlock[] = [];
  let lastStart = -Infinity;
  for (const block of blocks) {
    if (block.start - lastStart < minGapSec) continue;
    picked.push(block);
    lastStart = block.start;
    if (picked.length >= maxItems) break;
  }
  return picked;
}

function phraseOf(block: CaptionBlock): string {
  return block.tokens
    .filter((t) => !t.isFiller)
    .map((t) => t.text)
    .join(" ")
    .trim();
}

/** Full spoken transcript for LLM context (capped for token limits). */
function buildFullTranscript(blocks: CaptionBlock[]): string {
  const full = blocks
    .map(phraseOf)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (full.length <= MAX_TRANSCRIPT_CHARS) return full;
  return `${full.slice(0, MAX_TRANSCRIPT_CHARS)}…`;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function buildCandidateMoments(
  candidates: CaptionBlock[],
  allBlocks: CaptionBlock[]
): CandidateMoment[] {
  return candidates.map((candidate) => {
    const blockIndex = allBlocks.indexOf(candidate);
    const safeIndex = blockIndex >= 0 ? blockIndex : 0;

    const contextBefore = allBlocks
      .slice(Math.max(0, safeIndex - 3), safeIndex)
      .map(phraseOf)
      .filter(Boolean)
      .join(" ");

    const contextAfter = allBlocks
      .slice(safeIndex + 1, safeIndex + 4)
      .map(phraseOf)
      .filter(Boolean)
      .join(" ");

    return {
      phrase: phraseOf(candidate),
      timestampSec: candidate.start,
      contextBefore,
      contextAfter,
    };
  });
}

/**
 * Pexels search works best with 1–2 concrete nouns/verbs.
 * Strip filler and keep the most visual token.
 */
function normalizeSearchQuery(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !isFiller(w));

  if (cleaned.length === 0) return "";
  if (cleaned.length <= 2) return cleaned.join(" ");
  return cleaned.slice(0, 2).join(" ");
}

/** Build a stock search query from caption words when the LLM is unavailable. */
function phraseToQuery(block: CaptionBlock): BrollQuery | null {
  const phrase = phraseOf(block);
  if (!phrase || phrase.length < 3) return null;

  for (const token of block.tokens) {
    const emoji = getEmojiForWord(token.text);
    if (emoji) {
      return { query: normalizeWord(token.text), media: "video" };
    }
  }

  const visual = phrase
    .split(/\s+/)
    .filter((w) => w.length > 3 && !isFiller(w))
    .sort((a, b) => b.length - a.length)[0];

  if (!visual) return null;

  const actionWords = new Set([
    "build",
    "building",
    "run",
    "running",
    "walk",
    "walking",
    "drive",
    "driving",
    "work",
    "working",
    "type",
    "typing",
    "write",
    "writing",
    "grow",
    "growing",
    "learn",
    "learning",
  ]);

  const stem = visual.replace(/ing$|ed$|s$/, "");
  const media: BrollMediaType = actionWords.has(visual) || actionWords.has(stem)
    ? "video"
    : "image";

  return { query: normalizeSearchQuery(visual), media };
}

async function llmBrollQueries(
  moments: CandidateMoment[],
  fullTranscript: string,
  title: string
): Promise<(BrollQuery | null)[]> {
  const prompt = [
    "You are a senior podcast video editor cutting a talking-head clip into a professional short.",
    "",
    "PROJECT:",
    "- Source: podcast episode clip (host speaking to camera or mic)",
    "- Output: polished vertical short with timed b-roll cutaways",
    `- Episode title: "${title || "Untitled podcast clip"}"`,
    "- Edit style: documentary / MKBHD / Vox — every cut must earn its place",
    "",
    "FULL TRANSCRIPT (read entirely before choosing any b-roll):",
    '"""',
    fullTranscript,
    '"""',
    "",
    "TASK:",
    "For each MOMENT below, choose stock footage that a professional editor would cut to",
    "while the host says that line. A viewer should immediately understand why that clip appears.",
    "",
    "OUTPUT FORMAT — JSON array with one entry per moment (same order, same length):",
    '{ "query": "1-2 word Pexels search term", "media": "video" | "image" }',
    "Use null for moments that should have NO b-roll.",
    "",
    "EDITOR RULES:",
    "1. CONTEXT FIRST: use the full transcript to understand the episode topic, who is speaking,",
    "   and what argument or story is being told. Every query must fit THAT podcast — not generic stock.",
    "2. LITERAL OR METAPHORICAL: b-roll may illustrate the exact subject (e.g. speaker mentions Tesla → \"electric car\")",
    "   OR a tight visual metaphor for the specific idea (e.g. \"we were drowning in debt\" → \"calculator bills\").",
    "3. NO RANDOM FILLER: never pick unrelated beauty shots (sunset, city skyline, random office, nature walk,",
    "   handshake, coffee cup) unless the speaker is literally discussing that thing right then.",
    "4. NO IDIOM ECHO: translate idioms into filmable visuals.",
    '   BAD: "passage of time", "bitter pill", "business professional", "starting point"',
    '   GOOD: "hourglass", "medicine", "startup team", "road map"',
    "5. SKIP FILLER: return null for transitions, filler words, greetings, or abstract lines with no visual anchor.",
    "6. SEARCH TERMS: 1–2 concrete nouns/verbs Pexels can find. Prefer one strong keyword.",
    '7. MEDIA: "video" for actions, processes, movement; "image" for products, portraits, static objects.',
    "",
    "MOMENTS TO ILLUSTRATE:",
    ...moments.map((m, i) => {
      const lines = [
        `${i + 1}. [${formatTimestamp(m.timestampSec)}] On-screen phrase: "${m.phrase}"`,
      ];
      if (m.contextBefore) lines.push(`   Before: "${m.contextBefore}"`);
      if (m.contextAfter) lines.push(`   After: "${m.contextAfter}"`);
      return lines.join("\n");
    }),
    "",
    "Return ONLY the JSON array. No markdown, no explanation.",
  ].join("\n");

  const result = await completeText(prompt);
  if (!result?.text) return moments.map(() => null);

  const jsonText = result.text.replace(/```json|```/g, "").trim();
  const match = jsonText.match(/\[[\s\S]*\]/);
  if (!match) return moments.map(() => null);

  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) return moments.map(() => null);

  return moments.map((_, i) => {
    const entry = parsed[i];
    if (entry === null || entry === undefined) return null;
    if (typeof entry === "string" && entry.trim()) {
      const query = normalizeSearchQuery(entry);
      return query ? { query, media: "video" as const } : null;
    }
    if (typeof entry === "object" && entry && typeof entry.query === "string") {
      const media = entry.media === "image" ? "image" : "video";
      const query = normalizeSearchQuery(entry.query);
      return query ? { query, media } : null;
    }
    return null;
  });
}

async function pexelsFetch(
  url: string,
  apiKey: string
): Promise<Response | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { Authorization: apiKey } });
    if (res.ok) return res;

    if (res.status === 429 || res.status === 401) {
      const detail = await res.text().catch(() => "");
      console.warn(
        `[Broll] Pexels ${res.status} (attempt ${attempt + 1})${detail ? `: ${detail.slice(0, 80)}` : ""}`
      );
      await sleep(1200 * (attempt + 1));
      continue;
    }

    console.warn(`[Broll] Pexels ${res.status}: ${url}`);
    return null;
  }
  return null;
}

function pickVideoFile(
  files: Array<{
    file_type?: string;
    quality?: string;
    width?: number;
    height?: number;
    link?: string;
  }>
): string | null {
  const mp4s = files.filter(
    (f) => f.file_type === "video/mp4" && typeof f.link === "string"
  );
  if (!mp4s.length) return null;

  const portrait = mp4s.filter((f) => (f.height ?? 0) > (f.width ?? 0));
  const pool = portrait.length ? portrait : mp4s;
  const hd = pool.filter((f) => f.quality === "hd");
  const ranked = (hd.length ? hd : pool).sort(
    (a, b) => (b.height ?? 0) - (a.height ?? 0)
  );
  return ranked[0]?.link ?? null;
}

async function fetchPexelsVideo(query: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(
    query
  )}&per_page=3`;

  const res = await pexelsFetch(url, apiKey);
  if (!res) return null;

  const data = await res.json();
  for (const video of data?.videos ?? []) {
    const link = pickVideoFile(video?.video_files ?? []);
    if (link) return link;
  }
  return null;
}

async function fetchPexelsImage(query: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
    query
  )}&per_page=3`;

  const res = await pexelsFetch(url, apiKey);
  if (!res) return null;

  const data = await res.json();
  for (const photo of data?.photos ?? []) {
    const src =
      photo?.src?.large2x || photo?.src?.portrait || photo?.src?.large || null;
    if (src) return src;
  }
  return null;
}

/** Simplify the LLM query for Pexels — never fall back to unrelated generic stock. */
function fallbackQueries(query: string): string[] {
  const parts = query.trim().split(/\s+/).filter(Boolean);
  return [query, parts[0]].filter((q, i, arr) => q && arr.indexOf(q) === i);
}

async function fetchPexelsMedia(
  plan: BrollQuery
): Promise<{ url: string; type: BrollMediaType } | null> {
  const attempts = fallbackQueries(plan.query);

  for (const attempt of attempts) {
    if (plan.media === "video") {
      const videoUrl = await fetchPexelsVideo(attempt);
      if (videoUrl) {
        if (attempt !== plan.query) {
          console.log(`[Broll] Video fallback "${plan.query}" → "${attempt}"`);
        }
        await sleep(PEXELS_GAP_MS);
        return { url: videoUrl, type: "video" };
      }
      await sleep(PEXELS_GAP_MS);
    }

    const imageUrl = await fetchPexelsImage(attempt);
    if (imageUrl) {
      if (attempt !== plan.query) {
        console.log(`[Broll] Image fallback "${plan.query}" → "${attempt}"`);
      }
      await sleep(PEXELS_GAP_MS);
      return { url: imageUrl, type: "image" };
    }
    await sleep(PEXELS_GAP_MS);
  }

  return null;
}

async function downloadMedia(
  remoteUrl: string,
  destPath: string
): Promise<boolean> {
  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, buf);
    return true;
  } catch {
    return false;
  }
}

function extendEndFrame(
  startFrame: number,
  endFrame: number,
  minFrames: number
): number {
  return Math.max(endFrame, startFrame + minFrames);
}

/**
 * Build a frame-accurate b-roll plan. Downloads media locally so Remotion's
 * headless renderer can load them reliably (external https URLs often fail).
 */
export async function buildBrollPlan(
  blocks: CaptionBlock[],
  options: PlanOptions
): Promise<BrollItem[]> {
  const {
    enabled,
    fps = 30,
    maxItems = 6,
    minGapSec = 4,
    minClipSec = 3,
    projectId = "render",
  } = options;

  if (!enabled || !process.env.PEXELS_API_KEY || !blocks.length) {
    console.log("[Broll] Skipped (disabled or no PEXELS_API_KEY)");
    return [];
  }

  const minFrames = Math.max(MIN_CLIP_FRAMES_DEFAULT, Math.round(minClipSec * fps));
  const cacheDir = path.join(
    process.cwd(),
    "public",
    "local-media",
    "broll-cache",
    projectId
  );

  try {
    const candidates = selectCandidates(blocks, maxItems, minGapSec);
    const fullTranscript = buildFullTranscript(blocks);
    const moments = buildCandidateMoments(candidates, blocks);
    console.log(`[Broll] Planning ${candidates.length} candidate blocks`);

    let queries: (BrollQuery | null)[];
    try {
      queries = await llmBrollQueries(
        moments,
        fullTranscript,
        options.title ?? ""
      );
      console.log(
        "[Broll] LLM queries:",
        queries.filter(Boolean).map((q) => `${q!.query} (${q!.media})`).join(", ")
      );
    } catch (err) {
      console.warn("[Broll] LLM failed, using phrase fallback:", err);
      queries = candidates.map(() => null);
    }

    const items: BrollItem[] = [];
    for (let i = 0; i < candidates.length; i++) {
      const plan = queries[i] ?? phraseToQuery(candidates[i]);
      if (!plan) continue;

      const remote = await fetchPexelsMedia(plan);
      if (!remote) continue;

      const ext = remote.type === "video" ? "mp4" : "jpg";
      const localPath = path.join(cacheDir, `broll_${i}.${ext}`);
      const ok = await downloadMedia(remote.url, localPath);
      if (!ok) continue;

      const startFrame = candidates[i].startFrame;
      const endFrame = extendEndFrame(
        startFrame,
        candidates[i].endFrame,
        minFrames
      );

      items.push({
        startFrame,
        endFrame,
        url: localPath,
        type: remote.type,
      });
      console.log(
        `[Broll] + "${plan.query}" (${remote.type}) → frames ${startFrame}-${endFrame}`
      );
    }

    console.log(`[Broll] Final plan: ${items.length} items`);
    return items;
  } catch (err) {
    console.warn("[Broll] Plan failed, continuing without b-roll:", err);
    return [];
  }
}

