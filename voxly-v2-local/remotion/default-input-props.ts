import type { PodcastShortProps } from "../src/lib/remotion-props";
import { DEFAULT_CAPTION_STYLE } from "../src/lib/remotion-props";

const mockWords = [
  "This", "is", "a", "high", "quality", "automated", "Hormozi", "style", "video", "caption",
  "rendered", "in", "real", "time", "using", "voxly", "local", "render", "studio", "software.",
].map((word, index, arr) => {
  const start = 0.5 + index * 0.35;
  const end = start + 0.3;
  let punctuated = word;
  if (index === 9) punctuated = word + ",";
  if (index === arr.length - 1) punctuated = word + ".";
  return {
    word: word.toLowerCase(),
    start: parseFloat(start.toFixed(2)),
    end: parseFloat(end.toFixed(2)),
    confidence: 0.98,
    punctuated_word: punctuated,
  };
});

/**
 * Default input props for Remotion Studio preview.
 * Set videoSrc to an http(s) URL of a local MP4 to preview with real footage
 * (file:// paths are not supported by OffthreadVideo).
 */
export const studioDefaultProps: PodcastShortProps = {
  videoSrc: "",
  words: mockWords,
  title: "VOXLY STUDIO PREVIEW",
  showTitle: true,
  backgroundOption: "blur",
  style: DEFAULT_CAPTION_STYLE,
  enableZoom: true,
  focalXOffset: 0,
  focalYOffset: 0,
  lowPerfMode: false,
  broll: [],
};
