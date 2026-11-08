// Aetheria Launch Composition
// All scenes wrapped with Audio inside Sequences - ZERO overlap
import React from 'react';
import { Sequence, Audio, staticFile } from 'remotion';
import { Scene1 } from './scenes/Scene1';
import { Scene2 } from './scenes/Scene2';
import { Scene3 } from './scenes/Scene3';
import { Scene4 } from './scenes/Scene4';
import { FPS, SCENE_START_FRAMES, SCENE_FRAMES, TOTAL_FRAMES, WIDTH, HEIGHT } from './types';

export const AetheriaLaunchComposition: React.FC = () => {
  return (
    <>
      {/* Scene 1: Dark 3D Particle Explosion Hook (640 frames) */}
      <Sequence from={SCENE_START_FRAMES[0]} durationInFrames={SCENE_FRAMES[0]}>
        <Scene1 />
        <Audio src={staticFile('vo_aetheria_s1.wav')} />
        
        {/* SFX: Scene entrance whoosh */}
        <Sequence from={0} durationInFrames={18}>
          <Audio src={staticFile('sfx/sfx_whoosh.wav')} volume={0.28} />
        </Sequence>
        
        {/* SFX: Impact at frame 15 */}
        <Sequence from={15} durationInFrames={25}>
          <Audio src={staticFile('sfx/sfx_impact.wav')} volume={0.34} />
        </Sequence>
        
        {/* SFX: Pain point card pops */}
        <Sequence from={195} durationInFrames={10}>
          <Audio src={staticFile('sfx/sfx_pop.wav')} volume={0.26} />
        </Sequence>
        <Sequence from={225} durationInFrames={10}>
          <Audio src={staticFile('sfx/sfx_pop.wav')} volume={0.26} />
        </Sequence>
        <Sequence from={255} durationInFrames={10}>
          <Audio src={staticFile('sfx/sfx_pop.wav')} volume={0.26} />
        </Sequence>
        
        {/* SFX: Command pill chime */}
        <Sequence from={415} durationInFrames={20}>
          <Audio src={staticFile('sfx/sfx_chime.wav')} volume={0.28} />
        </Sequence>
      </Sequence>

      {/* Scene 2: Staggered Pill Stack & Workstation UI (1020 frames) */}
      <Sequence from={SCENE_START_FRAMES[1]} durationInFrames={SCENE_FRAMES[1]}>
        <Scene2 />
        <Audio src={staticFile('vo_aetheria_s2.wav')} />
        
        {/* SFX: Scene entrance whoosh */}
        <Sequence from={0} durationInFrames={18}>
          <Audio src={staticFile('sfx/sfx_whoosh.wav')} volume={0.28} />
        </Sequence>
        
        {/* SFX: Cursor click pop */}
        <Sequence from={270} durationInFrames={10}>
          <Audio src={staticFile('sfx/sfx_pop.wav')} volume={0.26} />
        </Sequence>
        
        {/* SFX: Modal open chime */}
        <Sequence from={280} durationInFrames={20}>
          <Audio src={staticFile('sfx/sfx_chime.wav')} volume={0.28} />
        </Sequence>
        
        {/* SFX: Camera zoom riser */}
        <Sequence from={620} durationInFrames={45}>
          <Audio src={staticFile('sfx/sfx_riser.wav')} volume={0.22} />
        </Sequence>
      </Sequence>

      {/* Scene 3: Screen-Studio Macro Zoom UI (730 frames) */}
      <Sequence from={SCENE_START_FRAMES[2]} durationInFrames={SCENE_FRAMES[2]}>
        <Scene3 />
        <Audio src={staticFile('vo_aetheria_s3.wav')} />
        
        {/* SFX: Scene entrance whoosh */}
        <Sequence from={0} durationInFrames={18}>
          <Audio src={staticFile('sfx/sfx_whoosh.wav')} volume={0.28} />
        </Sequence>
        
        {/* SFX: Impact at frame 30 */}
        <Sequence from={30} durationInFrames={25}>
          <Audio src={staticFile('sfx/sfx_impact.wav')} volume={0.34} />
        </Sequence>
        
        {/* SFX: Metric chime */}
        <Sequence from={160} durationInFrames={20}>
          <Audio src={staticFile('sfx/sfx_chime.wav')} volume={0.28} />
        </Sequence>
        
        {/* SFX: Badge pop */}
        <Sequence from={330} durationInFrames={10}>
          <Audio src={staticFile('sfx/sfx_pop.wav')} volume={0.26} />
        </Sequence>
      </Sequence>

      {/* Scene 4: SVG Bezier Node Graph & Payoff (460 frames) */}
      <Sequence from={SCENE_START_FRAMES[3]} durationInFrames={SCENE_FRAMES[3]}>
        <Scene4 />
        <Audio src={staticFile('vo_aetheria_s4.wav')} />
        
        {/* SFX: Scene entrance whoosh */}
        <Sequence from={0} durationInFrames={18}>
          <Audio src={staticFile('sfx/sfx_whoosh.wav')} volume={0.28} />
        </Sequence>
        
        {/* SFX: Node connection pops */}
        <Sequence from={25} durationInFrames={10}>
          <Audio src={staticFile('sfx/sfx_pop.wav')} volume={0.26} />
        </Sequence>
        <Sequence from={45} durationInFrames={10}>
          <Audio src={staticFile('sfx/sfx_pop.wav')} volume={0.26} />
        </Sequence>
        <Sequence from={65} durationInFrames={10}>
          <Audio src={staticFile('sfx/sfx_pop.wav')} volume={0.26} />
        </Sequence>
        
        {/* SFX: End card impact */}
        <Sequence from={210} durationInFrames={25}>
          <Audio src={staticFile('sfx/sfx_impact.wav')} volume={0.34} />
        </Sequence>
        
        {/* SFX: CTA glow chime */}
        <Sequence from={330} durationInFrames={20}>
          <Audio src={staticFile('sfx/sfx_chime.wav')} volume={0.28} />
        </Sequence>
      </Sequence>
    </>
  );
};
