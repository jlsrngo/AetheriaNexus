import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, FONT} from '../lib/tokens';
import {ramp, spr} from '../lib/anim';
import {Center} from './Stage';
import {McBox} from '../lib/debug';
import {useFormat} from '../lib/format-context';

export const EndCard: React.FC<{at: number; handle: string; line?: string; icon?: React.ReactNode}> = ({at, handle, line, icon}) => {
  const {format} = useFormat();
  const f = useCurrentFrame();
  const s = spr(f, at + 8, {damping: 12, stiffness: 150, mass: 0.6});
  const p = ramp(f, at + 18, 12);
  return (
    <Center gap={18}>
      {icon && <div style={{transform: `scale(${0.8 + 0.2 * s})`}}>{icon}</div>}
      <McBox kind="text" style={{padding: '12px 30px', borderRadius: 999, background: C.card, boxShadow: '0 10px 30px rgba(20,40,80,0.10)', fontFamily: FONT, fontWeight: 700, fontSize: format==='9:16'?40:31, color: C.accent, transform: `scale(${0.8 + 0.2 * s})`, opacity: Math.min(1, s * 2)}}>{handle}</McBox>
      {line && <McBox kind="text" style={{fontFamily: FONT, fontWeight: 500, fontSize: 28, color: C.muted, opacity: p}}>{line}</McBox>}
    </Center>
  );
};
