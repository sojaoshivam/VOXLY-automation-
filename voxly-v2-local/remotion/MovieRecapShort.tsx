import { AbsoluteFill, Audio, OffthreadVideo } from "remotion";
import type { MovieRecapShortProps } from "../src/lib/remotion-props";
import { CaptionsMinimal } from "./components/CaptionsMinimal";
import { montserrat } from "./load-fonts";

export const MOVIE_TITLE_ZONE_HEIGHT = 180;

export function MovieRecapShort({
  videoSrc,
  audioSrc,
  words,
  title,
  showTitle,
  style,
}: MovieRecapShortProps) {
  const hasTitle = showTitle && title.trim().length > 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#05050a" }}>
      {videoSrc && (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <OffthreadVideo
            src={videoSrc}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
            }}
            volume={0}
          />
        </AbsoluteFill>
      )}

      {audioSrc && <Audio src={audioSrc} />}

      {hasTitle && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: MOVIE_TITLE_ZONE_HEIGHT,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "0 48px 24px",
            background:
              "linear-gradient(180deg, rgba(5,5,10,0.85) 0%, rgba(5,5,10,0) 100%)",
            zIndex: 10,
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#FFFFFF",
              fontFamily: montserrat,
              fontSize: 42,
              fontWeight: 800,
              textAlign: "center",
              lineHeight: 1.15,
              textShadow: "0 2px 16px rgba(0,0,0,0.8)",
            }}
          >
            {title.trim()}
          </p>
        </div>
      )}

      <CaptionsMinimal
        words={words}
        style={{ ...style, fontFamily: montserrat }}
      />
    </AbsoluteFill>
  );
}
