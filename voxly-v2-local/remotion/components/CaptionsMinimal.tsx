import { useCurrentFrame, useVideoConfig } from "remotion";
import type { DeepgramWord } from "../../src/lib/deepgram";
import { buildCaptionBlocks } from "../../src/lib/deepgram";
import type { CaptionStyle } from "../../src/lib/remotion-props";

type CaptionsMinimalProps = {
  words: DeepgramWord[];
  style: CaptionStyle;
};

const HOLD_FRAMES = 8;

export function CaptionsMinimal({ words, style }: CaptionsMinimalProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const blocks = buildCaptionBlocks(words, { fps });
  const activeBlock = blocks.find(
    (block) =>
      frame >= block.startFrame && frame <= block.endFrame + HOLD_FRAMES
  );

  if (!activeBlock) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        fontFamily: style.fontFamily,
      }}
    >
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
          gap: "8px 14px",
          padding: "0 80px",
        }}
      >
        {activeBlock.tokens.map((token, index) => {
          const isActive = frame >= token.startFrame && frame <= token.endFrame + 4;

          let color = style.inactiveColor;
          if (isActive) color = style.activeColor;
          else if (token.isKeyword) color = style.keywordColor;

          return (
            <span
              key={`${token.startFrame}-${token.text}-${index}`}
              style={{
                fontSize: style.fontSize,
                fontWeight: 700,
                color,
                display: "inline-block",
                textShadow: "0 2px 8px rgba(0,0,0,0.65)",
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
