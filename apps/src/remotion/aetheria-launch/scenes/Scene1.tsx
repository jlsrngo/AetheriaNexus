// Scene 1: Dark 3D Particle Explosion Hook
// Background: #0C0B0B with floating emerald-sage & warm gold capsules
import React, { useMemo } from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { COLORS, FONT_FAMILY, FloatingCapsuleProps, PillCardProps } from './types';
import { enter, scaleIn, slideUp, fadeIn } from './motion';

const FloatingCapsule: React.FC<FloatingCapsuleProps> = ({ frame, x, y, scale, rotation, delay, color, blur = false, type = 'pill' }) => {
  const progress = enter(frame, delay, { config: 'slow' });
  const drift = Math.sin((frame + delay) * 0.02) * 8;
  
  const style: React.CSSProperties = {
    position: 'absolute',
    left: x,
    top: y + drift,
    transform: `scale(${scale * progress}) rotate(${rotation}deg)`,
    filter: blur ? 'blur(6px)' : 'none',
    opacity: progress * (blur ? 0.4 : 0.8),
  };

  if (type === 'star') {
    return (
      <div style={style}>
        <svg width={40 * scale} height={40 * scale} viewBox="0 0 24 24" fill={color}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </div>
    );
  }

  if (type === 'cross') {
    return (
      <div style={{ ...style, color, fontSize: 32 * scale, fontWeight: 'bold' }}>+</div>
    );
  }

  if (type === 'badge') {
    return (
      <div style={{
        ...style,
        background: `linear-gradient(135deg, ${color}, ${COLORS.warmGold})`,
        borderRadius: 20,
        padding: '8px 16px',
        color: COLORS.darkBg,
        fontWeight: 600,
        fontSize: 14,
      }}>
        ★★★★★
      </div>
    );
  }

  // Default pill
  return (
    <div style={{
      ...style,
      width: 80 * scale,
      height: 28 * scale,
      background: `linear-gradient(90deg, ${color}, ${COLORS.warmGold})`,
      borderRadius: 14 * scale,
    }} />
  );
};

const PainPointCard: React.FC<PillCardProps & { width?: number }> = ({ frame, text, x, y, delay, width = 380 }) => {
  const opacity = staggeredOpacity(frame, delay);
  const offsetY = staggeredSlideY(frame, delay);
  
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y + offsetY,
      opacity,
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 12,
      padding: '16px 20px',
      width,
      backdropFilter: 'blur(4px)',
    }}>
      <p style={{
        margin: 0,
        color: COLORS.white,
        fontFamily: FONT_FAMILY.sans,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.5,
      }}>
        {text}
      </p>
    </div>
  );
};

function staggeredOpacity(frame: number, delay: number) {
  const progress = enter(frame, delay);
  return progress;
}

function staggeredSlideY(frame: number, delay: number) {
  const progress = enter(frame, delay);
  return (1 - progress) * 30;
}

export const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const WIDTH = 1920;

  // Beat 1: Giant headline (0..192 frames / 0..3.2s)
  const headlineScale = scaleIn(frame, 0);
  const headlineOpacity = fadeIn(frame, 0);

  // Beat 2: Pain point cards (192..408 frames / 3.2..6.8s)
  const card1Opacity = staggeredOpacity(frame, 195);
  const card2Opacity = staggeredOpacity(frame, 225);
  const card3Opacity = staggeredOpacity(frame, 255);

  // Beat 3: Solution command pill (408..640 frames / 6.8..10.6s)
  const commandPillScale = scaleIn(frame, 415, 0.7);
  const commandGlow = (Math.sin(frame * 0.1) + 1) * 0.5;

  // Generate 28 floating capsules with parallax
  const capsules = useMemo(() => {
    const items = [];
    const positions = [
      { x: 100, y: 120, scale: 1.4, rotation: 15, delay: 0, color: COLORS.emeraldSage, blur: true },
      { x: 1750, y: 180, scale: 1.6, rotation: -12, delay: 10, color: COLORS.warmGold, blur: true },
      { x: 120, y: 900, scale: 1.8, rotation: 8, delay: 20, color: COLORS.emeraldSage, blur: true },
      { x: 1680, y: 850, scale: 1.3, rotation: -20, delay: 15, color: COLORS.warmGold, blur: false },
      { x: 400, y: 200, scale: 0.9, rotation: 25, delay: 5, color: COLORS.emeraldSage, blur: false },
      { x: 1400, y: 300, scale: 1.1, rotation: -8, delay: 8, color: COLORS.warmGold, blur: false },
      { x: 600, y: 700, scale: 0.7, rotation: 18, delay: 12, color: COLORS.emeraldSage, blur: false },
      { x: 1200, y: 600, scale: 0.8, rotation: -15, delay: 18, color: COLORS.warmGold, blur: false },
      { x: 800, y: 400, scale: 0.6, rotation: 30, delay: 22, color: COLORS.emeraldSage, blur: false },
      { x: 1000, y: 500, scale: 0.5, rotation: -25, delay: 25, color: COLORS.warmGold, blur: false },
    ];

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      items.push(
        <FloatingCapsule
          key={`capsule-${i}`}
          frame={frame}
          x={p.x}
          y={p.y}
          scale={p.scale}
          rotation={p.rotation}
          delay={p.delay}
          color={p.color}
          blur={p.blur}
          type="pill"
        />
      );
    }

    // Add stars
    for (let i = 0; i < 8; i++) {
      items.push(
        <FloatingCapsule
          key={`star-${i}`}
          frame={frame}
          x={200 + i * 220}
          y={150 + (i % 3) * 180}
          scale={0.4 + (i % 4) * 0.2}
          rotation={i * 45}
          delay={i * 8}
          color={i % 2 === 0 ? COLORS.warmGold : COLORS.emeraldSage}
          type="star"
        />
      );
    }

    // Add crosses
    for (let i = 0; i < 6; i++) {
      items.push(
        <FloatingCapsule
          key={`cross-${i}`}
          frame={frame}
          x={350 + i * 280}
          y={400 + (i % 2) * 200}
          scale={0.8 + (i % 3) * 0.3}
          rotation={i * 30}
          delay={i * 10}
          color={COLORS.white}
          type="cross"
        />
      );
    }

    // Add badges
    items.push(
      <FloatingCapsule key="badge1" frame={frame} x={1500} y={100} scale={1} rotation={0} delay={30} color={COLORS.warmGold} type="badge" />,
      <FloatingCapsule key="badge2" frame={frame} x={250} y={950} scale={0.9} rotation={-10} delay={35} color={COLORS.emeraldSage} type="badge" />,
    );

    return items;
  }, [frame]);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.darkBg, overflow: 'hidden' }}>
      {/* Floating capsules layer */}
      {capsules}

      {/* Beat 1: Giant headline */}
      <div style={{
        position: 'absolute',
        top: 320,
        left: 0,
        right: 0,
        textAlign: 'center',
        transform: `scale(${headlineScale})`,
        opacity: headlineOpacity,
      }}>
        <h1 style={{
          margin: 0,
          fontFamily: FONT_FAMILY.sans,
          fontSize: 124,
          fontWeight: 800,
          color: COLORS.white,
          letterSpacing: '-0.04em',
          lineHeight: 1.1,
        }}>
          Semua orang bilang AI video{' '}
          <span style={{ color: COLORS.accentRed }}>itu ribet.</span>
        </h1>
      </div>

      {/* Beat 2: Pain point cards */}
      <PainPointCard
        frame={frame}
        text="Nulis script & storyboard berjam-jam"
        x={WIDTH / 2 - 190}
        y={480}
        delay={195}
      />
      <PainPointCard
        frame={frame}
        text="Cari voiceover & dubbing AI kaku"
        x={WIDTH / 2 - 190}
        y={560}
        delay={225}
      />
      <PainPointCard
        frame={frame}
        text="Sinkronin frame per kata di timeline"
        x={WIDTH / 2 - 190}
        y={640}
        delay={255}
      />

      {/* Beat 3: Solution command pill */}
      <div style={{
        position: 'absolute',
        top: 780,
        left: WIDTH / 2 - 220,
        transform: `scale(${commandPillScale})`,
        opacity: fadeIn(frame, 415),
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${COLORS.emeraldSage}, ${COLORS.warmGold})`,
          borderRadius: 32,
          padding: '18px 36px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: `0 0 ${30 + commandGlow * 20}px rgba(77, 94, 78, ${0.4 + commandGlow * 0.3})`,
        }}>
          <span style={{
            fontFamily: FONT_FAMILY.mono,
            fontSize: 20,
            fontWeight: 600,
            color: COLORS.darkBg,
          }}>
            /add preset · Studio Otomatis
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
