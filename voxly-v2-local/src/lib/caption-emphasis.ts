/**
 * Static word-emphasis data for captions: filler de-emphasis and keyword -> emoji
 * mapping. Kept intentionally conservative so we never over-decorate captions.
 */

const FILLERS = new Set([
  "um",
  "uh",
  "uhh",
  "umm",
  "hmm",
  "er",
  "ah",
  "eh",
  "like",
  "so",
  "well",
  "okay",
  "ok",
  "yeah",
  "right",
  "basically",
  "literally",
  "actually",
  "honestly",
]);

/**
 * Keyword -> emoji map. Only high-confidence, broadly-applicable concepts so a
 * business/podcast clip doesn't get random literal imagery.
 */
const KEYWORD_EMOJI: Record<string, string> = {
  money: "\u{1F4B0}",
  cash: "\u{1F4B5}",
  dollars: "\u{1F4B5}",
  profit: "\u{1F4B0}",
  revenue: "\u{1F4C8}",
  growth: "\u{1F4C8}",
  grow: "\u{1F4C8}",
  scale: "\u{1F4C8}",
  business: "\u{1F4BC}",
  work: "\u{1F4BC}",
  time: "\u{23F0}",
  idea: "\u{1F4A1}",
  ideas: "\u{1F4A1}",
  fire: "\u{1F525}",
  win: "\u{1F3C6}",
  winning: "\u{1F3C6}",
  success: "\u{1F3C6}",
  fail: "\u{274C}",
  failure: "\u{274C}",
  love: "\u{2764}\u{FE0F}",
  people: "\u{1F465}",
  team: "\u{1F465}",
  brain: "\u{1F9E0}",
  think: "\u{1F9E0}",
  power: "\u{26A1}",
  fast: "\u{26A1}",
  rocket: "\u{1F680}",
  launch: "\u{1F680}",
  target: "\u{1F3AF}",
  focus: "\u{1F3AF}",
  goal: "\u{1F3AF}",
};

/** Lowercase and strip punctuation/symbols so lookups are stable. */
export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isFiller(word: string): boolean {
  return FILLERS.has(normalizeWord(word));
}

export function getEmojiForWord(word: string): string | undefined {
  return KEYWORD_EMOJI[normalizeWord(word)];
}

export function isKeyword(word: string): boolean {
  return getEmojiForWord(word) !== undefined;
}
