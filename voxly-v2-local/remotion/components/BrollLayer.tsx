import {

  AbsoluteFill,

  Img,

  interpolate,

  OffthreadVideo,

  Sequence,

  useCurrentFrame,

} from "remotion";

import type { BrollItem } from "../../src/lib/broll";



type BrollLayerProps = {

  broll: BrollItem[];

  /** Top offset (title band height) so b-roll covers the video zone only. */

  topOffset: number;

};



const FADE_FRAMES = 8;



function BrollClip({ item, topOffset }: { item: BrollItem; topOffset: number }) {

  const frame = useCurrentFrame();

  const duration = Math.max(1, item.endFrame - item.startFrame);



  const opacity = interpolate(

    frame,

    [0, FADE_FRAMES, duration - FADE_FRAMES, duration],

    [0, 1, 1, 0],

    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }

  );



  const mediaStyle = {

    width: "100%",

    height: "100%",

    objectFit: "cover" as const,

  };



  return (

    <AbsoluteFill style={{ top: topOffset, pointerEvents: "none" }}>

      <AbsoluteFill

        style={{

          backgroundColor: "rgba(0,0,0,0.35)",

          opacity,

        }}

      />

      <AbsoluteFill style={{ opacity, overflow: "hidden" }}>

        {item.type === "video" ? (

          <OffthreadVideo src={item.url} muted style={mediaStyle} />

        ) : (

          <Img src={item.url} style={mediaStyle} />

        )}

      </AbsoluteFill>

    </AbsoluteFill>

  );

}



export function BrollLayer({ broll, topOffset }: BrollLayerProps) {

  if (!broll.length) return null;



  return (

    <>

      {broll.map((item, index) => (

        <Sequence

          key={`${item.startFrame}-${index}`}

          from={item.startFrame}

          durationInFrames={Math.max(1, item.endFrame - item.startFrame)}

        >

          <BrollClip item={item} topOffset={topOffset} />

        </Sequence>

      ))}

    </>

  );

}


