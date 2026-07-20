import { AbsoluteFill } from "remotion";
import type { PodcastShortProps } from "../src/lib/remotion-props";
import { StageLayout, TITLE_ZONE_HEIGHT } from "./components/StageLayout";
import { WordByWordCaptions } from "./components/WordByWordCaptions";
import { BrollLayer } from "./components/BrollLayer";
import { montserrat } from "./load-fonts";

export function PodcastShort({
  videoSrc,
  words,
  title,
  showTitle,
  backgroundOption,
  style,
  enableZoom,
  focalXOffset,
  focalYOffset,
  lowPerfMode,
  broll,
}: PodcastShortProps) {
  const topOffset = showTitle && title.trim().length > 0 ? TITLE_ZONE_HEIGHT : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#05050a" }}>
      <StageLayout
        videoSrc={videoSrc}
        words={words}
        backgroundOption={backgroundOption}
        title={title}
        showTitle={showTitle}
        titleFontFamily={montserrat}
        focalXOffset={focalXOffset}
        focalYOffset={focalYOffset}
        lowPerfMode={lowPerfMode}
        enableZoom={enableZoom}
      />
      <BrollLayer broll={broll} topOffset={topOffset} />
      <WordByWordCaptions words={words} style={style} />
    </AbsoluteFill>
  );
}
