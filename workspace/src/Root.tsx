import React from "react";
import { Composition, AbsoluteFill } from "remotion";

export const DefaultComposition: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0A0A0C",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#8E8E98",
        fontFamily: "Inter, sans-serif",
        fontSize: 28,
        letterSpacing: "0.02em",
      }}
    >
      Aetheria Studio • Ready for Next Turn
    </AbsoluteFill>
  );
};

export const AlanTuringDocumentary = DefaultComposition;
export const TuringVideo = DefaultComposition;
export const NexusEditorialVideo = DefaultComposition;

export const RemotionRoot: React.FC = () => (
  <Composition
    id="NexusEditorialVideo"
    component={DefaultComposition}
    durationInFrames={300}
    fps={30}
    width={1080}
    height={1920}
  />
);

export default RemotionRoot;
