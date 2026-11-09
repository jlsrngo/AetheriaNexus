import React from "react";
import { Composition } from "remotion";

/**
 * Default placeholder composition when workspace is clean and awaiting AI generation.
 */
export const DefaultWorkspacePlaceholder: React.FC = () => {
  return (
    <div
      style={{
        flex: 1,
        width: "100%",
        height: "100%",
        backgroundColor: "#0A0A0C",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#FAFAFA",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1, marginBottom: 16 }}>
        Aetheria Video Studio
      </div>
      <div style={{ fontSize: 24, color: "#8E8E98" }}>
        Workspace is clean & ready for prompt generation
      </div>
    </div>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Default"
      component={DefaultWorkspacePlaceholder}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
