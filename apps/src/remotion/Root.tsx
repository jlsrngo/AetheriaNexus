import React from "react";
import { Composition } from "remotion";
import { NexusVideoComposition } from "./NexusVideoComposition";
import { RustBlueprintStoryComposition } from "./RustBlueprintStoryComposition";
import { defaultNexusVideoProps, nexusVideoSpec } from "./types";

export const NexusVideoRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={nexusVideoSpec.id}
        component={NexusVideoComposition}
        durationInFrames={nexusVideoSpec.durationInFrames}
        fps={nexusVideoSpec.fps}
        width={nexusVideoSpec.width}
        height={nexusVideoSpec.height}
        defaultProps={defaultNexusVideoProps}
      />
      <Composition
        id="RustBlueprintStory"
        component={RustBlueprintStoryComposition}
        durationInFrames={1175}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="RustOriginBlueprint"
        component={NexusVideoComposition}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          ...defaultNexusVideoProps,
          hookText: "HOW AN ELEVATOR CRASH CREATED RUST",
          bodyText:
            "1. 2006: Graydon Hoare walked 21 flights after an elevator C++ memory crash\n2. THE BLUEPRINT: Conceived in Vancouver to enforce memory safety without GC\n3. THE BORROW CHECKER: Compile-time lifetimes eliminate segfaults at zero cost\n4. TODAY: Powers the Linux Kernel, Windows Core & AWS Cloud infrastructure",
          authorHandle: "@rust.systems",
          themeColor: "blueprint",
          category: "SYSTEM ARCHITECTURE",
          subCategory: "SPEC-2006 // RUST ORIGIN",
          editorialTag: "SWISS BRUTALISM // TECHNICAL HUD",
          bgStyle: "blueprint",
          gridSize: 36,
          gridOpacity: 0.35,
          orbSize: 750,
          footerIconChar: "⚙",
        }}
      />
      {/* Compatibility Composition alias */}
      <Composition
        id="TikTokVideo"
        component={NexusVideoComposition}
        durationInFrames={nexusVideoSpec.durationInFrames}
        fps={nexusVideoSpec.fps}
        width={nexusVideoSpec.width}
        height={nexusVideoSpec.height}
        defaultProps={defaultNexusVideoProps}
      />
    </>
  );
};

export const RemotionRoot = NexusVideoRoot;
