import { Composition } from "remotion";
import { PodcastShort } from "./PodcastShort";
import { MovieRecapShort } from "./MovieRecapShort";
import type { MovieRecapShortProps, PodcastShortProps } from "../src/lib/remotion-props";
import { getTranscriptDuration } from "../src/lib/deepgram";
import { studioDefaultProps } from "./default-input-props";

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;

const movieStudioDefaults: MovieRecapShortProps = {
  videoSrc: "",
  audioSrc: "",
  words: studioDefaultProps.words,
  title: "Movie Recap",
  showTitle: true,
  style: studioDefaultProps.style,
};

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="PodcastShort"
        component={PodcastShort}
        durationInFrames={300}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={studioDefaultProps}
        calculateMetadata={async ({ props }) => {
          const typedProps = props as PodcastShortProps;
          const durationInSeconds =
            typedProps.durationInSeconds ?? getTranscriptDuration(typedProps.words);

          return {
            durationInFrames: Math.max(1, Math.ceil(durationInSeconds * FPS)),
          };
        }}
      />
      <Composition
        id="MovieRecapShort"
        component={MovieRecapShort}
        durationInFrames={300}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={movieStudioDefaults}
        calculateMetadata={async ({ props }) => {
          const typedProps = props as MovieRecapShortProps;
          const durationInSeconds =
            typedProps.durationInSeconds ?? getTranscriptDuration(typedProps.words);

          return {
            durationInFrames: Math.max(1, Math.ceil(durationInSeconds * FPS)),
          };
        }}
      />
    </>
  );
}
