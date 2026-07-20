const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const LEGACY_MODEL_MAP = {
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gpt-4o": "openai/gpt-4o",
  "gemini-2.0-flash": "google/gemini-2.0-flash-001",
  "gemini-1.5-pro": "google/gemini-pro-1.5",
};

function resolveModel(model) {
  return LEGACY_MODEL_MAP[model] || model || "openai/gpt-4o-mini";
}

function parseTranscript(transcriptData) {
  if (!transcriptData) return "";
  try {
    const parsed = JSON.parse(transcriptData);
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) {
      return parsed.map((s) => s.text || s.content || "").join(" ");
    }
    if (parsed.segments) {
      return parsed.segments.map((s) => s.text || "").join(" ");
    }
    if (parsed.text) return parsed.text;
    return JSON.stringify(parsed);
  } catch {
    return transcriptData;
  }
}

// Keep the prompt small: the hook + payoff carry the signal. 1800 chars ≈ 450 tokens.
function truncateScript(script, maxChars = 1800) {
  const clean = (script || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  const head = clean.slice(0, Math.floor(maxChars * 0.75));
  const tail = clean.slice(-Math.floor(maxChars * 0.25));
  return `${head} … ${tail}`;
}

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI response did not contain JSON.");
    return JSON.parse(match[0]);
  }
}

function normalizeTags(input) {
  const list = Array.isArray(input)
    ? input
    : String(input || "")
        .split(/[,\n]/)
        .map((t) => t.trim());
  const seen = new Set();
  const tags = [];
  for (const raw of list) {
    const tag = raw.replace(/^#/, "").trim().toLowerCase();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

// 3–6 hashtags is the sweet spot for Shorts. #shorts is always first.
function tagsToHashtags(tags, max = 6) {
  const cleaned = tags
    .map((t) => t.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean)
    .filter((t) => t.toLowerCase() !== "shorts");
  const top = cleaned.slice(0, max - 1).map((t) => `#${t}`);
  return ["#shorts", ...top].join(" ");
}

async function callOpenRouter({ model, system, user, maxTokens = 500 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    const err = new Error("OPENROUTER_API_KEY is not configured.");
    err.status = 503;
    throw err;
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3001",
      "X-Title": "Voxly Publisher",
    },
    body: JSON.stringify({
      model: resolveModel(model),
      temperature: 0.6,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || data.error || "AI request failed.");
  }

  return data.choices?.[0]?.message?.content?.trim() || "";
}

/* ───────────────────────── Cookbook (prompt rules) ─────────────────────────
   Tight, concrete rules beat vague "be engaging". Each rule is here to fix a
   specific failure mode (clickbait, walls of text, generic tags, no CTA). */

const METADATA_SYSTEM = `You write metadata for YouTube Shorts that maximizes click-through and watch time. Return ONLY JSON.

TITLE (key: "title"):
- 40-60 chars. Front-load the most searchable keyword.
- Open a curiosity gap or promise a payoff; no vague hype ("amazing", "must watch").
- Title Case. No emojis. No quotes. No hashtags.

CAPTION (key: "caption"):
- Line 1: a 1-line hook restating the payoff (≤80 chars).
- Lines 2-3: one concrete sentence of value/context from the transcript.
- Last line: a CTA ("Follow for more", "Comment your take", etc.).
- ≤300 chars total. Plain text, no hashtags inside the caption.

TAGS (key: "tags"): 12-15 lowercase YouTube tags, no "#".
- Mix: 3-4 broad (high volume), 6-8 specific to the topic, 2-3 long-tail phrases.
- Real search terms only — no filler like "viral", "fyp", "trending".

Output exactly: {"title": string, "caption": string, "tags": [string]}`;

const IMPROVE_SYSTEM = `You are a short-form video copywriter. Rewrite the caption to be punchier. Return ONLY JSON.
- Line 1: scroll-stopping hook (≤80 chars).
- 1 sentence of value, then a CTA.
- ≤300 chars, plain text, no hashtags inside "caption".
- "hashtags": 4-6 space-separated tags, first is #shorts, rest specific to the caption.
Output exactly: {"caption": string, "hashtags": string}`;

const TAGS_SYSTEM = `YouTube SEO. From seed keywords, produce real search tags. Return ONLY JSON.
- 12-15 lowercase tags, no "#".
- Mix broad + specific + long-tail phrases built around the seeds.
- No filler ("viral", "fyp", "trending"). Output exactly: {"tags": [string]}`;

export async function generateMetadata({ transcriptData, model }) {
  const script = truncateScript(parseTranscript(transcriptData));
  if (!script.trim()) {
    const err = new Error("No transcript available for this video.");
    err.status = 400;
    throw err;
  }

  const content = await callOpenRouter({
    model,
    system: METADATA_SYSTEM,
    user: `Transcript:\n${script}`,
    maxTokens: 500,
  });

  const parsed = extractJson(content);
  const tags = normalizeTags(parsed.tags);
  return {
    title: (parsed.title || "").trim(),
    caption: (parsed.caption || "").trim(),
    hashtags: tagsToHashtags(tags),
    tags,
  };
}

export async function improveCaption({ caption, model }) {
  if (!caption?.trim()) {
    const err = new Error("Caption is required.");
    err.status = 400;
    throw err;
  }

  const content = await callOpenRouter({
    model,
    system: IMPROVE_SYSTEM,
    user: `Caption:\n${caption}`,
    maxTokens: 300,
  });

  const parsed = extractJson(content);
  const hashtags = parsed.hashtags
    ? tagsToHashtags(normalizeTags(parsed.hashtags))
    : "";
  return {
    caption: (parsed.caption || caption).trim(),
    hashtags,
  };
}

export async function generateTagsFromKeywords({ keywords, model }) {
  if (!keywords?.trim()) {
    const err = new Error("Seed keywords are required.");
    err.status = 400;
    throw err;
  }

  const content = await callOpenRouter({
    model,
    system: TAGS_SYSTEM,
    user: `Seed keywords: ${keywords}`,
    maxTokens: 250,
  });

  const parsed = extractJson(content);
  const tags = normalizeTags(parsed.tags);
  return {
    tags,
    hashtags: tagsToHashtags(tags),
  };
}

const OPTIMAL_TIME_SYSTEM = `You are a short-form video growth strategist. Pick the single best future publish datetime to maximize reach and engagement. Return ONLY JSON.

Rules:
- "scheduledAt": ISO 8601 datetime WITH timezone offset (must be in the future, at least 30 minutes from now)
- "reason": one concise sentence explaining why this slot wins for this platform and content
- "label": human-readable local time, e.g. "Thursday 7:00 PM"
- Prefer peak windows: YouTube Shorts Tue–Thu 12–3 PM and 7–9 PM; Instagram Reels weekday late morning and early evening
- Avoid 12 AM–6 AM local unless content is global/niche-specific
- Spread posts across days when scheduling multiple items

Output exactly: {"scheduledAt": string, "reason": string, "label": string}`;

export async function suggestOptimalPublishTime({
  platform,
  timezone = "America/New_York",
  title,
  transcriptData,
  model,
  now = new Date(),
}) {
  const script = truncateScript(parseTranscript(transcriptData), 600);
  const nowIso = now.toISOString();

  const content = await callOpenRouter({
    model,
    system: OPTIMAL_TIME_SYSTEM,
    user: [
      `Platform: ${platform}`,
      `Timezone: ${timezone}`,
      `Current UTC time: ${nowIso}`,
      `Video title: ${title || "Untitled"}`,
      script ? `Transcript excerpt: ${script}` : "",
      "Pick the next optimal publish time within the next 7 days.",
    ]
      .filter(Boolean)
      .join("\n"),
    maxTokens: 200,
  });

  const parsed = extractJson(content);
  const scheduledAt = new Date(parsed.scheduledAt);
  const minFuture = new Date(now.getTime() + 30 * 60 * 1000);

  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt < minFuture) {
    throw new Error("AI returned an invalid or past publish time.");
  }

  return {
    scheduledAt,
    reason: (parsed.reason || "").trim(),
    label: (parsed.label || scheduledAt.toLocaleString()).trim(),
  };
}
