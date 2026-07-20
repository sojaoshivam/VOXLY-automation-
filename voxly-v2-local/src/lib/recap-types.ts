export type RecapScriptSegment = {
  id: string;
  sourceStartSec: number;
  sourceEndSec: number;
  narration: string;
};

export type RecapScriptData = {
  language: string;
  sarvamSpeaker: string;
  segments: RecapScriptSegment[];
};

export const DEFAULT_RECAP_SCRIPT: RecapScriptData = {
  language: "en-IN",
  sarvamSpeaker: "shubh",
  segments: [],
};

export function parseRecapScript(json: string | null | undefined): RecapScriptData | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as RecapScriptData;
  } catch {
    return null;
  }
}

export function isMovieRecapProject(projectType: string | null | undefined): boolean {
  return projectType === "movie_recap";
}
