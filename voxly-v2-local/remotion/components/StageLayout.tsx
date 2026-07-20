import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { DeepgramWord } from "../../src/lib/deepgram";
import { buildCaptionBlocks } from "../../src/lib/deepgram";
import type { BackgroundOption } from "../../src/lib/remotion-props";

type StageLayoutProps = {
  videoSrc: string;
  words: DeepgramWord[];
  backgroundOption: BackgroundOption;
  title: string;
  showTitle: boolean;
  titleFontFamily: string;
  /** -1..1 nudge of the cover-crop focal point. */
  focalXOffset: number;
  focalYOffset: number;
  /** Solid backdrop instead of CSS blur for low-tier render hardware. */
  lowPerfMode: boolean;
  /** Subtle alternating punch-in on caption-block boundaries. */
  enableZoom: boolean;
};

export const TITLE_ZONE_HEIGHT = 230;
const ZOOM_IN = 1.06;
const ZOOM_SNAP_FRAMES = 6;
/** Punch in on every Nth caption block — keeps motion occasional, not constant. */
const ZOOM_EVERY_N_BLOCKS = 5;

/**
 * Occasional zoom *state machine* (NOT free-stacking springs): only every Nth
 * caption block punches in slightly. The transition is a short snap so it reads
 * as an intentional cut and never compounds when blocks fire back-to-back.
 */
function useAlternatingZoom(words: DeepgramWord[], enabled: boolean): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!enabled) return 1;

  const blocks = buildCaptionBlocks(words, { fps });
  if (!blocks.length) return 1;

  let currentIndex = -1;
  for (let i = 0; i < blocks.length; i++) {
    if (frame >= blocks[i].startFrame) currentIndex = i;
    else break;
  }
  if (currentIndex < 0) return 1;

  const targetFor = (index: number) =>
    index >= 0 && index % ZOOM_EVERY_N_BLOCKS === 2 ? ZOOM_IN : 1;

  const currentTarget = targetFor(currentIndex);
  const previousTarget = targetFor(currentIndex - 1);
  const blockStart = blocks[currentIndex].startFrame;

  const t = interpolate(frame - blockStart, [0, ZOOM_SNAP_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return previousTarget + (currentTarget - previousTarget) * t;
}

export function StageLayout({
  videoSrc,
  words,
  backgroundOption,
  title,
  showTitle,
  titleFontFamily,
  focalXOffset,
  focalYOffset,
  lowPerfMode,
  enableZoom,
}: StageLayoutProps) {
  const zoomScale = useAlternatingZoom(words, enableZoom);

  const hasTitle = showTitle && title.trim().length > 0;
  const titleHeight = hasTitle ? TITLE_ZONE_HEIGHT : 0;

  // Focal point for the cover crop (50% = centered).
  const objectPosition = `${50 + focalXOffset * 50}% ${50 + focalYOffset * 50}%`;

  const useBlur = backgroundOption === "blur" && !lowPerfMode;
  const solidColor = backgroundOption === "white" ? "#FFFFFF" : "#05050a";

  return (
    <AbsoluteFill style={{ backgroundColor: solidColor }}>
      {/* Full-frame backdrop so the frame is never empty (no black bars).
          Perf budget: the blur is applied on a quarter-size layer then scaled
          up 4x, so the expensive blur runs on ~1/16th the pixels (a small
          blur radius reads like a large one once upscaled). */}
      {videoSrc && useBlur ? (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "25%",
              height: "25%",
              transform: "scale(4)",
              transformOrigin: "top left",
            }}
          >
            <OffthreadVideo
              src={videoSrc}
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "blur(9px)",
                transform: "scale(1.15)",
              }}
            />
          </div>
          <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.28)" }} />
        </AbsoluteFill>
      ) : null}

      {/* Foreground video fills the frame below the title band (cover crop). */}
      {videoSrc ? (
        <div
          style={{
            position: "absolute",
            top: titleHeight,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: "hidden",
          }}
        >
          <OffthreadVideo
            src={videoSrc}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition,
              transform: `scale(${zoomScale})`,
            }}
          />
        </div>
      ) : null}

      {/* Title band, always above the video. */}
      {hasTitle ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: titleHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 56px",
          }}
        >
          <span
            style={{
              fontFamily: titleFontFamily,
              fontSize: 60,
              fontWeight: 800,
              lineHeight: 1.08,
              color: "#FFFFFF",
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: 1,
              textShadow: "0 4px 20px rgba(0,0,0,0.65)",
            }}
          >
            {title.trim()}
          </span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
