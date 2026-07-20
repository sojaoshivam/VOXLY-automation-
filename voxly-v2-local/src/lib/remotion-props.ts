import type { DeepgramWord } from "./deepgram";
import type { BrollItem } from "./broll";

export type BackgroundOption = "blur" | "white" | "black";

export type CaptionTheme = "hormozi" | "boxed" | "minimal";

export type CaptionStyle = {
  fontSize: number;
  activeColor: string;
  inactiveColor: string;
  keywordColor: string;
  /** Background behind the active word (used by the "boxed" theme). */
  activeBg: string;
  /** When true, the active word gets a filled highlight box. */
  boxed: boolean;
  fontFamily: string;
  theme: CaptionTheme;
};

export type PodcastShortProps = {
  videoSrc: string;
  words: DeepgramWord[];
  title: string;
  showTitle: boolean;
  backgroundOption: BackgroundOption;
  style: CaptionStyle;
  /** Subtle alternating zoom on the video zone per caption block. */
  enableZoom: boolean;
  /** Horizontal/vertical focal nudge for the cover-cropped video (-1..1). */
  focalXOffset: number;
  focalYOffset: number;
  /**
   * Cheap-blur fallback for low-tier render hardware (solid backdrop instead of
   * a CSS blur layer). Defaults to false.
   */
  lowPerfMode: boolean;
  /** Optional timed b-roll overlays (empty unless Pexels b-roll is enabled). */
  broll: BrollItem[];
  /** Set by render script via getVideoMetadata; falls back to word timestamps in Studio. */
  durationInSeconds?: number;
};

export type MovieRecapShortProps = {
  videoSrc: string;
  audioSrc: string;
  words: DeepgramWord[];
  title: string;
  showTitle: boolean;
  style: CaptionStyle;
  durationInSeconds?: number;
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSize: 64,
  activeColor: "#FFE600",
  inactiveColor: "#FFFFFF",
  keywordColor: "#3CF5B4",
  activeBg: "#FFE600",
  boxed: false,
  fontFamily: "Montserrat, Arial Black, Arial, sans-serif",
  theme: "hormozi",
};

/** Per-theme overrides merged on top of DEFAULT_CAPTION_STYLE. */
export const CAPTION_THEMES: Record<CaptionTheme, Partial<CaptionStyle>> = {
  hormozi: {
    activeColor: "#FFE600",
    inactiveColor: "#FFFFFF",
    keywordColor: "#3CF5B4",
    boxed: false,
  },
  boxed: {
    activeColor: "#000000",
    inactiveColor: "#FFFFFF",
    keywordColor: "#FFE600",
    activeBg: "#FFE600",
    boxed: true,
  },
  minimal: {
    activeColor: "#FFFFFF",
    inactiveColor: "rgba(255,255,255,0.65)",
    keywordColor: "#FFE600",
    boxed: false,
  },
};

export function resolveCaptionStyle(
  theme: CaptionTheme,
  overrides: Partial<CaptionStyle> = {}
): CaptionStyle {
  return {
    ...DEFAULT_CAPTION_STYLE,
    ...CAPTION_THEMES[theme],
    theme,
    ...overrides,
  };
}
