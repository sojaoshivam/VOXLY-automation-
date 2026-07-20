import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { DeepgramWord } from "../../src/lib/deepgram";
import { buildCaptionBlocks } from "../../src/lib/deepgram";
import type { CaptionStyle } from "../../src/lib/remotion-props";

type WordByWordCaptionsProps = {
  words: DeepgramWord[];
  style: CaptionStyle;
};

const HOLD_FRAMES = 8;
const ENTER_FRAMES = 7;

export function WordByWordCaptions({ words, style }: WordByWordCaptionsProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Frame-accurate blocks (anti-drift): all timing is precomputed to frames.
  const blocks = buildCaptionBlocks(words, { fps });

  const activeBlock = blocks.find(
    (block) =>
      frame >= block.startFrame && frame <= block.endFrame + HOLD_FRAMES
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        fontFamily: style.fontFamily,
      }}
    >
      {activeBlock && (
        <div
          style={{
            position: "absolute",
            bottom: 360,
            left: 0,
            right: 0,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: "16px 32px",
            padding: "0 56px",
          }}
        >
          {activeBlock.tokens.map((token, index) => {
            const isActive =
              frame >= token.startFrame && frame <= token.endFrame + 4;

            // Per-word entrance pop, keyed to the word's own start frame.
            const enter = interpolate(
              frame - token.startFrame,
              [0, ENTER_FRAMES],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            const pop = spring({
              frame: frame - token.startFrame,
              fps,
              config: { damping: 12, stiffness: 200, mass: 0.5 },
            });
            const scale = (isActive ? 1 + pop * 0.16 : 1) * (0.85 + enter * 0.15);
            const translateY = (1 - enter) * 24;

            let color = style.inactiveColor;
            if (isActive) color = style.activeColor;
            else if (token.isKeyword) color = style.keywordColor;

            const opacity = token.isFiller && !isActive ? 0.5 : enter;
            const fontSize = token.isFiller ? style.fontSize * 0.8 : style.fontSize;

            const boxed = style.boxed && isActive;

            return (
              <span
                key={`${token.startFrame}-${token.text}-${index}`}
                style={{
                  fontSize,
                  fontWeight: 800,
                  color,
                  opacity,
                  transform: `translateY(${translateY}px) scale(${scale})`,
                  display: "inline-block",
                  textTransform: "uppercase",
                  backgroundColor: boxed ? style.activeBg : "transparent",
                  borderRadius: boxed ? 12 : 0,
                  padding: boxed ? "2px 16px" : 0,
                  textShadow: boxed
                    ? "none"
                    : isActive
                      ? "5px 5px 0 #000, 0 0 22px rgba(0,0,0,0.5)"
                      : "3px 3px 0 #000, -1px -1px 0 #000",
                }}
              >
                {token.text}
                {token.emoji ? ` ${token.emoji}` : ""}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
