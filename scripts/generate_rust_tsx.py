# Script to generate workspace/src/rust-history/RustHistoryComposition.tsx
import sys

content = r'''import React from 'react';
import { useCurrentFrame, useVideoConfig, staticFile, Audio, AbsoluteFill } from 'remotion';

function clamp(val: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, val));
}

function progress(t: number, start: number, end: number): number {
  return clamp((t - start) / (end - start), 0, 1);
}

function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

interface MotionWordProps {
  t: number;
  start: number;
  duration?: number;
  spring?: boolean;
  fromY?: number;
  fromScale?: number;
  blur?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

const MotionWord: React.FC<MotionWordProps> = ({
  t,
  start,
  duration = 0.4,
  spring = false,
  fromY = 26,
  fromScale = 0.72,
  blur = 8,
  className = '',
  style = {},
  children,
}) => {
  const p = progress(t, start, start + duration);
  const eased = spring ? easeOutBack(p) : easeOutExpo(p);

  const y = (1 - eased) * fromY;
  const scale = fromScale + eased * (1 - fromScale);
  const currentBlur = (1 - p) * blur;
  const opacity = clamp(p * 2.2, 0, 1);

  return (
    <span
      className={`m-word ${className}`}
      style={{
        display: 'inline-block',
        willChange: 'transform, opacity, filter',
        transformOrigin: 'center center',
        opacity,
        transform: `translate3d(0, ${y}px, 0) scale(${scale})`,
        filter: currentBlur > 0.3 ? `blur(${currentBlur.toFixed(1)}px)` : 'none',
        ...style,
      }}
    >
      {children}
    </span>
  );
};

export const RustHistoryComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Flash Transition on Hard Cuts
  const cutTimes = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 57.5];
  let flashAlpha = 0;
  for (const ct of cutTimes) {
    const dist = Math.abs(t - ct);
    if (dist < 0.09) {
      flashAlpha = (1 - dist / 0.09) * 0.24;
    }
  }

  // Active Scene ID (1 to 12)
  const isS1 = t >= 0 && t < 5.0;
  const isS2 = t >= 5.0 && t < 10.0;
  const isS3 = t >= 10.0 && t < 15.0;
  const isS4 = t >= 15.0 && t < 20.0;
  const isS5 = t >= 20.0 && t < 25.0;
  const isS6 = t >= 25.0 && t < 30.0;
  const isS7 = t >= 30.0 && t < 35.0;
  const isS8 = t >= 35.0 && t < 40.0;
  const isS9 = t >= 40.0 && t < 45.0;
  const isS10 = t >= 45.0 && t < 50.0;
  const isS11 = t >= 50.0 && t < 55.0;
  const isS12 = t >= 55.0 && t <= 60.0;

  // HUD Theme
  const isDarkScene = isS2 || isS3 || isS6 || isS9 || isS10 || (isS12 && t >= 57.5);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#09090b',
        width: 1080,
        height: 1920,
        overflow: 'hidden',
      }}
    >
      {/* 48kHz Stereo Synthesized Procedural Sound Effects Track */}
      <Audio src={staticFile('rust_history_sfx.wav')} />

      {/* Embedded Styles from Reference HTML */}
      <style>{`
        :root {
          --bg-cream: #F4F1EA;
          --bg-black: #0A0A0A;
          --accent-red: #FF2424;
        }
        * {
          box-sizing: border-box;
          user-select: none;
          -webkit-font-smoothing: antialiased;
        }
        .stage-wrapper {
          width: 410px;
          height: 728.88px;
          position: absolute;
          left: 0;
          top: 0;
          overflow: hidden;
          background: #F4F1EA;
          transform: scale(2.634146);
          transform-origin: top left;
        }
        .noise-overlay {
          position: absolute;
          inset: -50%;
          width: 200%;
          height: 200%;
          pointer-events: none;
          z-index: 60;
          opacity: 0.055;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }
        .vignette-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 55;
          box-shadow: inset 0 0 85px rgba(0, 0, 0, 0.26);
          transition: box-shadow 0.3s ease;
        }
        .vignette-dark {
          box-shadow: inset 0 0 115px rgba(0, 0, 0, 0.88);
        }
        .tech-grid-light {
          background-size: 34px 34px;
          background-image: 
            linear-gradient(to right, rgba(0, 0, 0, 0.065) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 0, 0, 0.065) 1px, transparent 1px);
        }
        .tech-grid-dark {
          background-size: 34px 34px;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.07) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.07) 1px, transparent 1px);
        }
        .kinetic-title {
          letter-spacing: -0.045em;
          line-height: 1.05;
          font-weight: 800;
        }
        .red-glow-text {
          color: #FF2424;
          text-shadow: 0 0 28px rgba(255, 36, 36, 0.88), 0 0 8px rgba(255, 36, 36, 0.45);
        }
        .white-glow-text {
          color: #FFFFFF;
          text-shadow: 0 0 22px rgba(255, 255, 255, 0.65);
        }
        .red-solid-text {
          color: #E61919;
        }
        .scene {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          overflow: hidden;
        }
        .scene.active {
          opacity: 1;
          pointer-events: auto;
        }
        .m-word {
          display: inline-block;
          will-change: transform, opacity, filter;
          transform-origin: center center;
        }
        .perspective-stage {
          perspective: 950px;
          transform-style: preserve-3d;
        }
        .dotted-suit {
          background-color: #141418;
          background-image: radial-gradient(#ffffff 1.25px, transparent 1.25px);
          background-size: 9px 9px;
        }
        .card-3d-shadow {
          box-shadow: 
            -15px 25px 38px rgba(0, 0, 0, 0.25),
            -2px 4px 10px rgba(0, 0, 0, 0.14);
        }
        .led-blink {
          opacity: 1;
        }
      `}</style>

      {/* Scaled 9:16 Canvas matching the exact 410x729 proportional stage */}
      <div className="stage-wrapper">
        {/* Global Film Grain & Vignette */}
        <div className="noise-overlay" />
        <div className={`vignette-overlay ${isDarkScene ? 'vignette-dark' : ''}`} />

        {/* White Flash Hard-Cut Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#ffffff',
            pointerEvents: 'none',
            zIndex: 50,
            opacity: flashAlpha,
          }}
        />

        {/* Persistent Editorial HUD Badges */}
        <div
          style={{
            position: 'absolute',
            insetInline: 0,
            bottom: 20,
            paddingInline: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 40,
            color: isDarkScene ? '#D4D4D8' : '#27272A',
            transition: 'color 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.75 }}>
            <span style={{ border: '1px solid currentColor', padding: '1px 5px', fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold', borderRadius: 2 }}>HD</span>
            <span style={{ border: '1px solid currentColor', padding: '1px 5px', fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold', borderRadius: 2 }}>RUSTC</span>
            <span style={{ fontSize: 8, fontFamily: 'monospace', lineHeight: 1.1, textTransform: 'uppercase', marginLeft: 4 }}>
              SYSTEMS CHRONICLE // 2006-2026<br />ZERO-COST SAFETY VERIFIED
            </span>
          </div>
          <div style={{ border: '1px solid currentColor', padding: '2px 6px', fontSize: 9, fontFamily: 'monospace', fontWeight: 800, borderRadius: 999 }}>
            4K
          </div>
        </div>

        {/* =======================================================================
            SCENE 1 (0.0s - 5.0s): VANCOUVER 2006 - ELEVATOR PANEL CRASH (CREAM)
            ======================================================================= */}
        {isS1 && (
          <div
            className="scene active"
            style={{
              backgroundColor: '#F4F1EA',
              color: '#111111',
              transform: `scale(${1 + t * 0.015 + Math.pow(progress(t, 4.5, 5.0), 2) * 1.4})`,
            }}
          >
            {/* Top-Right Technical Barcode */}
            <div style={{ position: 'absolute', top: 40, right: 28, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <svg width="92" height="34" viewBox="0 0 92 34" fill="none">
                <rect x="0" y="0" width="3" height="34" fill="#111" />
                <rect x="5" y="0" width="1.5" height="34" fill="#111" />
                <rect x="9" y="0" width="4" height="34" fill="#111" />
                <rect x="16" y="0" width="2" height="34" fill="#111" />
                <rect x="20" y="0" width="1" height="34" fill="#111" />
                <rect x="24" y="0" width="5" height="34" fill="#111" />
                <rect x="32" y="0" width="2" height="34" fill="#111" />
                <rect x="36" y="0" width="3" height="34" fill="#111" />
                <rect x="42" y="0" width="1.5" height="34" fill="#111" />
                <rect x="46" y="0" width="4" height="34" fill="#111" />
                <rect x="53" y="0" width="2" height="34" fill="#111" />
                <rect x="57" y="0" width="6" height="34" fill="#111" />
                <rect x="66" y="0" width="1.5" height="34" fill="#111" />
                <rect x="70" y="0" width="3" height="34" fill="#111" />
                <rect x="75" y="0" width="2" height="34" fill="#111" />
                <rect x="80" y="0" width="4.5" height="34" fill="#111" />
                <rect x="87" y="0" width="2" height="34" fill="#111" />
              </svg>
              <span style={{ fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.22em', marginTop: 4, color: '#52525B', fontWeight: 'bold' }}>
                VANCOUVER-2006
              </span>
            </div>

            {/* Right Background Technical Grid + Elevator Schematic */}
            <div
              className="tech-grid-light"
              style={{
                width: 192,
                height: 208,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(0,0,0,0.15)',
                marginLeft: 96,
                marginTop: 40,
                padding: 12,
              }}
            >
              <div style={{ width: 112, height: 128, border: '2px dashed rgba(239,68,68,0.6)', borderRadius: 4, backgroundColor: 'rgba(239,68,68,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold', color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.1em' }}>SHAFT #02</span>
                <div style={{ width: 64, height: 56, border: '2px solid #27272A', backgroundColor: '#FFFFFF', borderRadius: 4, marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 800, color: '#DC2626' }}>FAULT</span>
                  <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#71717A' }}>C++ OS</span>
                </div>
                <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#52525B', marginTop: 6 }}>STATUS: HALTED</span>
              </div>
            </div>

            {/* Left Cutout: 3D Elevator Control Panel */}
            {(() => {
              const panelIn = easeOutExpo(progress(t, 0.0, 0.8));
              return (
                <div
                  style={{
                    position: 'absolute',
                    left: -32,
                    top: '50%',
                    transform: `translate3d(${(1 - panelIn) * -120}px, -50%, 0) rotate(${(1 - panelIn) * -10}deg)`,
                    width: 208,
                    height: 440,
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                >
                  <svg viewBox="0 0 220 450" style={{ width: '100%', height: '100%', filter: 'drop-shadow(16px 24px 32px rgba(0,0,0,0.3))' }}>
                    <defs>
                      <linearGradient id="steelPlate" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#E4E4E7" />
                        <stop offset="45%" stopColor="#A1A1AA" />
                        <stop offset="80%" stopColor="#71717A" />
                        <stop offset="100%" stopColor="#3F3F46" />
                      </linearGradient>
                    </defs>
                    <rect x="12" y="15" width="180" height="420" rx="18" fill="#27272A" />
                    <rect x="6" y="10" width="180" height="420" rx="18" fill="url(#steelPlate)" stroke="#F4F4F5" strokeWidth="2" />
                    <circle cx="24" cy="28" r="4" fill="#52525B" />
                    <circle cx="168" cy="28" r="4" fill="#52525B" />
                    <circle cx="24" cy="410" r="4" fill="#52525B" />
                    <circle cx="168" cy="410" r="4" fill="#52525B" />
                    <rect x="24" y="46" width="144" height="84" rx="8" fill="#09090B" stroke="#3F3F46" strokeWidth="3" />
                    <text x="36" y="78" fill="#FF2424" fontFamily="monospace" fontWeight="800" fontSize="16">ERR: FL 21</text>
                    <text x="36" y="100" fill="#EF4444" fontFamily="monospace" fontWeight="700" fontSize="10">SEGFAULT 0x00</text>
                    <rect x="36" y="110" width="118" height="6" rx="3" fill="#450A0A" />
                    <rect x="36" y="110" width="88" height="6" rx="3" fill="#FF2424" />
                    <g transform="translate(28, 152)">
                      <rect x="0" y="0" width="136" height="54" rx="12" fill="#18181B" stroke="#FF2424" strokeWidth="3" />
                      <circle cx="34" cy="27" r="16" fill="#FF2424" />
                      <text x="24" y="33" fill="#FFFFFF" fontFamily="sans-serif" fontWeight="900" fontSize="16">21</text>
                      <text x="62" y="25" fill="#FF2424" fontFamily="monospace" fontWeight="800" fontSize="11">JAMMED</text>
                      <text x="62" y="39" fill="#A1A1AA" fontFamily="monospace" fontSize="9">APT. HOARE</text>
                    </g>
                    <g transform="translate(28, 220)">
                      <rect x="0" y="0" width="62" height="46" rx="10" fill="#27272A" stroke="#52525B" strokeWidth="1.5" />
                      <text x="20" y="29" fill="#D4D4D8" fontFamily="sans-serif" fontWeight="800" fontSize="16">20</text>
                      <rect x="74" y="0" width="62" height="46" rx="10" fill="#27272A" stroke="#52525B" strokeWidth="1.5" />
                      <text x="94" y="29" fill="#D4D4D8" fontFamily="sans-serif" fontWeight="800" fontSize="16">19</text>
                    </g>
                    <g transform="translate(28, 278)">
                      <rect x="0" y="0" width="62" height="46" rx="10" fill="#27272A" stroke="#52525B" strokeWidth="1.5" />
                      <text x="20" y="29" fill="#D4D4D8" fontFamily="sans-serif" fontWeight="800" fontSize="16">18</text>
                      <rect x="74" y="0" width="62" height="46" rx="10" fill="#27272A" stroke="#52525B" strokeWidth="1.5" />
                      <text x="98" y="29" fill="#FBBF24" fontFamily="sans-serif" fontWeight="800" fontSize="16">L</text>
                    </g>
                    <rect x="28" y="342" width="136" height="42" rx="8" fill="#7F1D1D" stroke="#EF4444" strokeWidth="1.5" />
                    <text x="45" y="367" fill="#FECACA" fontFamily="monospace" fontWeight="800" fontSize="11">OUT OF SERVICE</text>
                  </svg>
                </div>
              );
            })()}

            {/* Kinetic Text Overlay */}
            <div style={{ position: 'absolute', insetInline: 0, top: '34%', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 30, paddingInline: 20 }}>
              <div style={{ backgroundColor: 'rgba(244,241,234,0.9)', backdropFilter: 'blur(4px)', padding: '8px 16px', borderRadius: 16, border: '1px solid rgba(0,0,0,0.05)' }}>
                <div className="kinetic-title" style={{ fontSize: 35, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 8 }}>
                  <MotionWord t={t} start={0.25} style={{ color: '#18181B' }}>Tahun</MotionWord>
                  <MotionWord t={t} start={0.55} style={{ color: '#18181B' }}>2006,</MotionWord>
                  <MotionWord t={t} start={0.90} style={{ color: '#71717A' }}>lift</MotionWord>
                </div>
                <div className="kinetic-title" style={{ fontSize: 37, textAlign: 'center', marginTop: 2, display: 'flex', justifyContent: 'center', gap: 8 }}>
                  <MotionWord t={t} start={1.25} spring style={{ color: '#18181B' }}>lantai 21</MotionWord>
                  <MotionWord t={t} start={1.65} spring fromScale={0.45} className="red-solid-text" style={{ fontWeight: 900 }}>mati total.</MotionWord>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================================
            SCENE 2 (5.0s - 10.0s): GRAYDON HOARE & 21 FLOORS STAIRS (BLACK)
            ======================================================================= */}
        {isS2 && (
          <div className="scene active" style={{ backgroundColor: '#0A0A0A', color: '#ffffff' }}>
            <div className="tech-grid-dark" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} />

            {/* Isometric Staircase Vector */}
            <svg style={{ position: 'absolute', top: 48, insetInline: 0, width: '100%', height: 256, opacity: 0.35, pointerEvents: 'none' }} viewBox="0 0 400 220" fill="none">
              <path d="M30 200 L80 200 L80 170 L130 170 L130 140 L180 140 L180 110 L230 110 L230 80 L280 80 L280 50 L330 50 L330 20 L380 20" stroke="#FF2424" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M30 212 L380 32" stroke="#52525B" strokeWidth="1.5" strokeDasharray="4 4" />
              <text x="305" y="18" fill="#FF2424" fontFamily="monospace" fontSize="11" fontWeight="800">FL 21 ▲</text>
            </svg>

            {/* Glowing White Circle Head + Dotted Suit Character */}
            {(() => {
              const headPop = easeOutBack(progress(t, 5.0, 5.65));
              return (
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 32, width: '100%', zIndex: 20, transform: `scale(${0.82 + headPop * 0.18})` }}>
                  <div style={{ width: 224, height: 224, borderRadius: '50%', backgroundColor: '#ffffff', boxShadow: '0 0 75px rgba(255,255,255,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingInline: 16, zIndex: 20, position: 'relative' }}>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#71717A', fontWeight: 'bold', marginBottom: 4 }}>MOZILLA ENGINEER</span>
                    <div className="kinetic-title" style={{ fontSize: 27, color: '#18181B', textAlign: 'center', lineHeight: 1 }}>
                      <MotionWord t={t} start={5.30}>Graydon</MotionWord>{' '}
                      <MotionWord t={t} start={5.55}>Hoare</MotionWord>
                    </div>
                    <div className="kinetic-title" style={{ fontSize: 31, textAlign: 'center', marginTop: 4 }}>
                      <MotionWord t={t} start={6.05} spring fromScale={0.45} style={{ color: '#FF2424', fontWeight: 900 }}>naik tangga</MotionWord>
                    </div>
                    <MotionWord t={t} start={6.50} spring style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 800, backgroundColor: '#18181B', color: '#ffffff', padding: '2px 10px', borderRadius: 999, marginTop: 6 }}>
                      21 LANTAI
                    </MotionWord>
                  </div>

                  {/* Dotted Suit Torso */}
                  <div style={{ position: 'relative', width: 288, height: 224, marginTop: -24, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
                    <div className="dotted-suit" style={{ width: 256, height: 192, borderTopLeftRadius: 48, borderTopRightRadius: 48, borderTop: '1px solid rgba(255,255,255,0.2)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
                      <div style={{ width: 208, height: 56, backgroundColor: 'rgba(9,9,11,0.9)', borderTop: '1px solid rgba(255,255,255,0.15)', borderTopLeftRadius: 16, borderTopRightRadius: 16, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingInline: 16 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#A1A1AA', letterSpacing: '0.05em' }}>SW_CRASH_DUMP.LOG</span>
                      </div>
                    </div>
                  </div>

                  {/* Subtitle */}
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, zIndex: 30, paddingInline: 16 }}>
                    <MotionWord t={t} start={7.15} blur={14} fromY={35} className="kinetic-title" style={{ fontSize: 30, color: '#A1A1AA' }}>Gara-gara</MotionWord>
                    <MotionWord t={t} start={7.55} spring blur={14} fromY={35} className="kinetic-title red-glow-text" style={{ fontSize: 30, fontWeight: 900 }}>C++ crash.</MotionWord>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* =======================================================================
            SCENE 3 (10.0s - 15.0s): 70% MEMORY BUGS & RAM CORRUPTION (BLACK)
            ======================================================================= */}
        {isS3 && (
          <div className="scene active" style={{ backgroundColor: '#0A0A0A', color: '#ffffff' }}>
            <div className="tech-grid-dark" style={{ position: 'absolute', inset: 0, opacity: 0.4 }} />
            <div style={{ paddingInline: 24, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', zIndex: 20 }}>
              {/* RAM SVG */}
              {(() => {
                const ramPop = easeOutBack(progress(t, 10.0, 10.7));
                return (
                  <div style={{ marginBottom: 24, position: 'relative', width: 256, height: 176, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${0.75 + ramPop * 0.25})` }}>
                    <svg viewBox="0 0 260 170" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 0 25px rgba(255,36,36,0.45))' }}>
                      <g transform="translate(20, 15)">
                        <rect x="10" y="10" width="90" height="36" rx="4" fill="#18181B" stroke="#52525B" strokeWidth="2" />
                        <text x="20" y="32" fill="#A1A1AA" fontFamily="monospace" fontSize="10">0x7FFF01</text>
                        <rect x="115" y="10" width="105" height="36" rx="4" fill="#450A0A" stroke="#FF2424" strokeWidth="2.5" />
                        <text x="125" y="32" fill="#FF2424" fontFamily="monospace" fontWeight="800" fontSize="10">0x00000000</text>
                        <rect x="10" y="60" width="210" height="52" rx="6" fill="#270909" stroke="#FF2424" strokeWidth="2.5" strokeDasharray="6 3" />
                        <path d="M105 58 L92 84 L112 88 L98 114" stroke="#FF2424" strokeWidth="3" fill="none" />
                        <text x="22" y="84" fill="#FCA5A5" fontFamily="monospace" fontWeight="800" fontSize="11">USE-AFTER-FREE</text>
                        <text x="22" y="101" fill="#EF4444" fontFamily="monospace" fontSize="9">BUFFER OVERFLOW // DANGLING PTR</text>
                        <rect x="55" y="124" width="110" height="22" rx="4" fill="#FF2424" />
                        <text x="65" y="139" fill="#FFFFFF" fontFamily="monospace" fontWeight="800" fontSize="10">CVE CRITICAL</text>
                      </g>
                    </svg>
                  </div>
                );
              })()}

              <div className="kinetic-title" style={{ fontSize: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <MotionWord t={t} start={10.40} spring fromScale={0.45} className="red-glow-text" style={{ fontWeight: 900 }}>70%</MotionWord>
                <MotionWord t={t} start={10.75} className="white-glow-text">celah</MotionWord>
              </div>
              <div className="kinetic-title" style={{ fontSize: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2 }}>
                <MotionWord t={t} start={11.15} className="white-glow-text">sistem</MotionWord>
                <MotionWord t={t} start={11.50} className="white-glow-text">adalah</MotionWord>
              </div>
              <div className="kinetic-title" style={{ fontSize: 42, marginTop: 2 }}>
                <MotionWord t={t} start={12.00} spring fromScale={0.45} blur={12} className="red-glow-text" style={{ fontWeight: 900 }}>bug memori.</MotionWord>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================================
            SCENE 4 (15.0s - 20.0s): THE DILEMMA PINNED CARD (CREAM)
            ======================================================================= */}
        {isS4 && (
          <div className="scene active" style={{ backgroundColor: '#F4F1EA', color: '#111111' }}>
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 400 711" fill="none">
              <path d="M 95 -20 C 110 210, 315 350, 325 730" stroke="#BDBBBD" strokeWidth="28" strokeLinecap="round" />
            </svg>

            <div style={{ position: 'relative', zIndex: 20, textAlign: 'center', marginBottom: 16, paddingInline: 16 }}>
              <div className="kinetic-title" style={{ fontSize: 32, display: 'flex', justifyContent: 'center', gap: 8 }}>
                <MotionWord t={t} start={15.10} style={{ color: '#18181B' }}>Dilema</MotionWord>
                <MotionWord t={t} start={15.35} spring style={{ color: '#E61919' }}>programmer</MotionWord>
                <MotionWord t={t} start={15.60} style={{ color: '#18181B' }}>sistem:</MotionWord>
              </div>
            </div>

            {(() => {
              const cardDrop = easeOutBack(progress(t, 15.4, 16.1));
              return (
                <div
                  className="card-3d-shadow"
                  style={{
                    width: 288,
                    backgroundColor: '#8E8E90',
                    color: '#ffffff',
                    borderRadius: 2,
                    padding: 24,
                    paddingTop: 32,
                    position: 'relative',
                    border: '1px solid rgba(255,255,255,0.25)',
                    zIndex: 30,
                    transform: `translate3d(0, ${(1 - cardDrop) * -80}px, 0) rotate(${(1 - cardDrop) * 8 - 2}deg) scale(${0.82 + cardDrop * 0.18})`,
                  }}
                >
                  {/* Push Pin */}
                  <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', width: 40, height: 40, pointerEvents: 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(to bottom right, #f87171, #dc2626, #7f1d1d)', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', border: '1px solid rgba(254,202,202,0.4)', position: 'relative', left: 8 }} />
                  </div>

                  <h3 style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', margin: '0 0 8px 0' }}>Trade-Off</h3>
                  <div style={{ width: '100%', height: 4, backgroundColor: '#27272A', marginBottom: 16 }} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 15, fontWeight: 'bold' }}>
                    <MotionWord t={t} start={16.25} style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: 'rgba(24,24,27,0.35)', padding: 8, borderRadius: 4 }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#DC2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontFamily: 'monospace' }}>C++</span>
                      <div>
                        <div style={{ color: '#fff', lineHeight: 1.1 }}>Cepat Maksimal</div>
                        <div style={{ fontSize: 11, color: '#FECACA', fontFamily: 'monospace' }}>✗ Rawan Memory Crash</div>
                      </div>
                    </MotionWord>
                    <MotionWord t={t} start={16.95} style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: 'rgba(24,24,27,0.35)', padding: 8, borderRadius: 4 }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#D97706', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontFamily: 'monospace' }}>GC</span>
                      <div>
                        <div style={{ color: '#fff', lineHeight: 1.1 }}>Memori Aman</div>
                        <div style={{ fontSize: 11, color: '#FDE68A', fontFamily: 'monospace' }}>✗ Jeda Garbage Collector</div>
                      </div>
                    </MotionWord>
                    <MotionWord t={t} start={17.65} spring style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: 'rgba(24,24,27,0.75)', padding: 8, borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)' }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#10B981', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontFamily: 'monospace', fontWeight: 900 }}>RS</span>
                      <div>
                        <div style={{ color: '#fff', lineHeight: 1.1 }}>Target Graydon:</div>
                        <div style={{ fontSize: 11, color: '#6EE7B7', fontFamily: 'monospace' }}>✓ Cepat + Aman Sekaligus</div>
                      </div>
                    </MotionWord>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* =======================================================================
            SCENE 5 (20.0s - 25.0s): ORIGIN OF NAME RUST (CREAM)
            ======================================================================= */}
        {isS5 && (
          <div className="scene active" style={{ backgroundColor: '#F4F1EA', color: '#111111' }}>
            <div className="tech-grid-light" style={{ position: 'absolute', inset: 0 }} />
            <div style={{ position: 'absolute', top: 48, left: 28, border: '1px solid #27272A', padding: '4px 10px', fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', backgroundColor: 'rgba(255,255,255,0.7)' }}>
              ETYMOLOGY // FUNGUS + METAL
            </div>

            {(() => {
              const gearAngle = (t - 20.0) * 28;
              const gearPop = easeOutBack(progress(t, 20.0, 20.7));
              return (
                <div style={{ position: 'relative', width: 224, height: 224, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <svg viewBox="0 0 220 220" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 18px 28px rgba(0,0,0,0.2))', transform: `scale(${gearPop}) rotate(${gearAngle}deg)` }}>
                    <g transform="translate(110, 110)">
                      <circle r="68" fill="#18181B" stroke="#FF2424" strokeWidth="3" />
                      <g fill="#18181B">
                        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => (
                          <rect key={deg} x="-10" y="-86" width="20" height="22" rx="3" transform={`rotate(${deg})`} />
                        ))}
                      </g>
                      <circle r="48" fill="#F4F1EA" stroke="#27272A" strokeWidth="4" />
                      <line x1="-25" y1="-20" x2="25" y2="20" stroke="#E61919" strokeWidth="3" />
                      <line x1="25" y1="-20" x2="-25" y2="20" stroke="#E61919" strokeWidth="3" />
                      <circle cx="0" cy="0" r="16" fill="#FF2424" />
                      <circle cx="-25" cy="-20" r="7" fill="#18181B" />
                      <circle cx="25" cy="-20" r="7" fill="#18181B" />
                      <circle cx="-25" cy="20" r="7" fill="#18181B" />
                      <circle cx="25" cy="20" r="7" fill="#18181B" />
                      <text x="-13" y="4" fill="#FFFFFF" fontFamily="monospace" fontWeight="800" fontSize="10">RS</text>
                    </g>
                  </svg>
                </div>
              );
            })()}

            <div style={{ paddingInline: 24, textAlign: 'center', zIndex: 20 }}>
              <div className="kinetic-title" style={{ fontSize: 30, color: '#18181B' }}>
                <MotionWord t={t} start={20.30}>Dinamai</MotionWord>{' '}
                <MotionWord t={t} start={20.55}>dari</MotionWord>{' '}
                <MotionWord t={t} start={20.85} spring className="red-solid-text" style={{ fontWeight: 900 }}>jamur Rust:</MotionWord>
              </div>
              <div className="kinetic-title" style={{ fontSize: 34, color: '#18181B', marginTop: 4 }}>
                <MotionWord t={t} start={21.40}>siklus</MotionWord>{' '}
                <MotionWord t={t} start={21.70}>biologis</MotionWord>{' '}
                <MotionWord t={t} start={22.05} spring className="red-solid-text" style={{ fontWeight: 900 }}>tangguh.</MotionWord>
              </div>
              <MotionWord t={t} start={22.60} style={{ fontFamily: 'monospace', fontSize: 12, color: '#52525B', marginTop: 8, fontWeight: 'bold' }}>
                "Over-engineered for survival"
              </MotionWord>
            </div>
          </div>
        )}

        {/* =======================================================================
            SCENE 6 (25.0s - 30.0s): 2009 MOZILLA & SERVO (BLACK)
            ======================================================================= */}
        {isS6 && (
          <div className="scene active perspective-stage" style={{ backgroundColor: '#0A0A0A', color: '#ffffff' }}>
            <div className="tech-grid-dark" style={{ position: 'absolute', inset: 0, opacity: 0.45 }} />
            {(() => {
              const termP = easeOutBack(progress(t, 25.0, 25.8));
              return (
                <div
                  style={{
                    width: '88%',
                    borderRadius: 12,
                    backgroundColor: '#141418',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: 16,
                    boxShadow: '0 25px 60px rgba(255,36,36,0.22)',
                    marginBottom: 24,
                    transform: `rotateX(${18 - termP * 10}deg) rotateY(${-12 + termP * 6}deg) scale(${0.78 + termP * 0.22})`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #27272A', paddingBottom: 10, marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#EF4444' }} />
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#10B981' }} />
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#A1A1AA' }}>mozilla-research // 2009</span>
                    <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 4, backgroundColor: 'rgba(239,68,68,0.2)', color: '#F87171', fontWeight: 'bold' }}>SERVO</span>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, color: '#D4D4D8' }}>
                    <div><span style={{ color: '#F87171' }}>$</span> git init <span style={{ color: '#ffffff', fontWeight: 'bold' }}>rust-compiler</span></div>
                    <div style={{ color: '#71717A' }}>// Sponsor Resmi: Mozilla Foundation</div>
                    <div><span style={{ color: '#34D399' }}>✓</span> Parallel CSS Engine (<span style={{ color: '#FCD34D' }}>Servo</span>)</div>
                    <div><span style={{ color: '#34D399' }}>✓</span> Self-hosting <span style={{ color: '#F87171', fontWeight: 'bold' }}>rustc</span> (2011)</div>
                    <div style={{ paddingTop: 4 }}>
                      <div style={{ width: '100%', backgroundColor: '#27272A', height: 8, borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ backgroundColor: '#FF2424', height: '100%', width: '80%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{ paddingInline: 24, textAlign: 'center', zIndex: 20 }}>
              <div className="kinetic-title" style={{ fontSize: 34 }}>
                <MotionWord t={t} start={25.40} spring className="red-glow-text" style={{ fontWeight: 900 }}>2009:</MotionWord>{' '}
                <MotionWord t={t} start={25.75} className="white-glow-text">Mozilla</MotionWord>
              </div>
              <div className="kinetic-title" style={{ fontSize: 32, marginTop: 2 }}>
                <MotionWord t={t} start={26.15} className="white-glow-text">mensponsori</MotionWord>{' '}
                <MotionWord t={t} start={26.50} className="white-glow-text">riset</MotionWord>
              </div>
              <div className="kinetic-title" style={{ fontSize: 40, marginTop: 2 }}>
                <MotionWord t={t} start={26.85} spring fromScale={0.45} className="red-glow-text" style={{ fontWeight: 900 }}>mesin Servo.</MotionWord>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================================
            SCENE 7 (30.0s - 35.0s): THE BORROW CHECKER LOCK (CREAM)
            ======================================================================= */}
        {isS7 && (
          <div className="scene active" style={{ backgroundColor: '#F4F1EA', color: '#111111' }}>
            <div className="tech-grid-light" style={{ position: 'absolute', inset: 0 }} />
            {(() => {
              const lockClick = easeOutExpo(progress(t, 30.4, 30.9));
              return (
                <div style={{ width: 256, height: 208, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <svg viewBox="0 0 260 210" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 18px 28px rgba(0,0,0,0.18))' }}>
                    <path d="M85 85 L85 48 C85 22, 175 22, 175 48 L175 85" stroke="#27272A" strokeWidth="16" fill="none" strokeLinecap="round" style={{ transform: `translateY(${(1 - lockClick) * -22}px)` }} />
                    <path d="M85 85 L85 48 C85 22, 175 22, 175 48 L175 85" stroke="#E4E4E7" strokeWidth="6" fill="none" strokeLinecap="round" style={{ transform: `translateY(${(1 - lockClick) * -22}px)` }} />
                    <rect x="45" y="78" width="170" height="115" rx="16" fill="#18181B" stroke="#27272A" strokeWidth="3" />
                    <rect x="62" y="95" width="136" height="34" rx="6" fill="#09090B" stroke="#10B981" strokeWidth="2" />
                    <text x="74" y="117" fill="#10B981" fontFamily="monospace" fontWeight="800" fontSize="14">&amp;mut T // OK</text>
                    <rect x="62" y="140" width="64" height="32" rx="6" fill="#27272A" />
                    <text x="73" y="160" fill="#F4F4F5" fontFamily="monospace" fontWeight="700" fontSize="11">fn('a)</text>
                    <rect x="134" y="140" width="64" height="32" rx="6" fill="#FF2424" />
                    <text x="144" y="160" fill="#FFFFFF" fontFamily="monospace" fontWeight="800" fontSize="11">NO GC</text>
                  </svg>
                </div>
              );
            })()}

            <div style={{ paddingInline: 24, textAlign: 'center', zIndex: 20 }}>
              <div className="kinetic-title" style={{ fontSize: 30, color: '#18181B' }}>
                <MotionWord t={t} start={30.25}>Senjata</MotionWord>{' '}
                <MotionWord t={t} start={30.55}>rahasia:</MotionWord>
              </div>
              <div className="kinetic-title" style={{ fontSize: 38, marginTop: 2 }}>
                <MotionWord t={t} start={31.00} spring className="red-solid-text" style={{ fontWeight: 900 }}>Borrow</MotionWord>{' '}
                <MotionWord t={t} start={31.30} spring className="red-solid-text" style={{ fontWeight: 900 }}>Checker.</MotionWord>
              </div>
              <div className="kinetic-title" style={{ fontSize: 24, color: '#3F3F46', marginTop: 8 }}>
                <MotionWord t={t} start={31.95}>Aman saat</MotionWord>{' '}
                <MotionWord t={t} start={32.30} spring style={{ textDecoration: 'underline', textDecorationColor: '#DC2626', textDecorationThickness: 4 }}>compile-time.</MotionWord>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================================
            SCENE 8 (35.0s - 40.0s): ZERO-COST & FERRIS (CREAM)
            ======================================================================= */}
        {isS8 && (
          <div className="scene active" style={{ backgroundColor: '#F4F1EA', color: '#111111' }}>
            {(() => {
              const ringScale = 0.55 + easeOutExpo(progress(t, 35.0, 38.5)) * 0.75;
              const crabBob = Math.sin((t - 35) * 8) * 6;
              return (
                <>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', transform: `scale(${ringScale})` }}>
                    <div style={{ width: 500, height: 500, borderRadius: '50%', backgroundColor: '#FDE2DD', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(252,165,165,0.6)' }}>
                      <div style={{ width: 350, height: 350, borderRadius: '50%', backgroundColor: '#F4F1EA', border: '1px solid rgba(252,165,165,0.5)' }} />
                    </div>
                  </div>

                  <div style={{ position: 'relative', zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingInline: 24, textAlign: 'center' }}>
                    <div style={{ marginBottom: 16, transform: `translateY(${crabBob}px)` }}>
                      <svg width="130" height="95" viewBox="0 0 140 100" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}>
                        <path d="M18 45 C5 25, 25 12, 35 30 L28 38 L38 42 Z" fill="#FF2424" />
                        <path d="M122 45 C135 25, 115 12, 105 30 L112 38 L102 42 Z" fill="#FF2424" />
                        <path d="M25 68 L10 84 M38 74 L26 90 M115 68 L130 84 M102 74 L114 90" stroke="#DC2626" strokeWidth="6" strokeLinecap="round" />
                        <ellipse cx="70" cy="56" rx="44" ry="30" fill="#FF2424" stroke="#991B1B" strokeWidth="2.5" />
                        <circle cx="55" cy="48" r="7" fill="#FFFFFF" />
                        <circle cx="55" cy="48" r="3.5" fill="#111111" />
                        <circle cx="85" cy="48" r="7" fill="#FFFFFF" />
                        <circle cx="85" cy="48" r="3.5" fill="#111111" />
                        <path d="M62 62 Q70 69 78 62" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" />
                      </svg>
                    </div>

                    <span style={{ fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '2px 10px', borderRadius: 999, backgroundColor: '#DC2626', color: '#fff', fontWeight: 'bold', marginBottom: 8 }}>
                      HIGH-LEVEL ➔ LLVM NATIVE
                    </span>

                    <div className="kinetic-title" style={{ fontSize: 32, color: '#18181B' }}>
                      <MotionWord t={t} start={35.30}>Zero-Cost</MotionWord>{' '}
                      <MotionWord t={t} start={35.65} spring className="red-solid-text" style={{ fontWeight: 900 }}>Abstraction.</MotionWord>
                    </div>
                    <div className="kinetic-title" style={{ fontSize: 30, color: '#27272A', marginTop: 4 }}>
                      <MotionWord t={t} start={36.25}>Secepat</MotionWord>{' '}
                      <MotionWord t={t} start={36.60} spring style={{ fontWeight: 900, color: '#09090B' }}>bare-metal.</MotionWord>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* =======================================================================
            SCENE 9 (40.0s - 45.0s): MAY 2015 RUST 1.0 (BLACK)
            ======================================================================= */}
        {isS9 && (
          <div className="scene active perspective-stage" style={{ backgroundColor: '#0A0A0A', color: '#ffffff' }}>
            <div className="tech-grid-dark" style={{ position: 'absolute', inset: 0, opacity: 0.45 }} />
            {(() => {
              const cardP = easeOutBack(progress(t, 40.0, 40.8));
              return (
                <div
                  style={{
                    width: 288,
                    borderRadius: 16,
                    background: 'linear-gradient(to bottom, #18181B, #09090B)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: 20,
                    boxShadow: '0 20px 60px rgba(255,36,36,0.28)',
                    marginBottom: 24,
                    position: 'relative',
                    transform: `rotateY(${(1 - cardP) * -20}deg) scale(${0.75 + cardP * 0.25})`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#A1A1AA' }}>15 MEI 2015</span>
                    <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: 'rgba(16,185,129,0.2)', color: '#34D399', border: '1px solid rgba(16,185,129,0.4)', fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold' }}>STABLE RELEASE</span>
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.05em', color: '#fff', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span>Rust 1.0</span>
                    <span style={{ fontSize: 14, fontFamily: 'monospace', color: '#F87171' }}>+ Cargo</span>
                  </div>
                  <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, textAlign: 'left', fontFamily: 'monospace', fontSize: 10 }}>
                    <div style={{ padding: 8, borderRadius: 6, backgroundColor: 'rgba(39,39,42,0.8)', border: '1px solid #3F3F46' }}>
                      <div style={{ color: '#A1A1AA' }}>PACKAGE MGR</div>
                      <div style={{ color: '#fff', fontWeight: 'bold', marginTop: 2 }}>crates.io 📦</div>
                    </div>
                    <div style={{ padding: 8, borderRadius: 6, backgroundColor: 'rgba(39,39,42,0.8)', border: '1px solid #3F3F46' }}>
                      <div style={{ color: '#A1A1AA' }}>PROMISE</div>
                      <div style={{ color: '#F87171', fontWeight: 'bold', marginTop: 2 }}>Backward Safe</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{ paddingInline: 24, textAlign: 'center', zIndex: 20 }}>
              <div className="kinetic-title" style={{ fontSize: 34 }}>
                <MotionWord t={t} start={40.45} spring className="red-glow-text" style={{ fontWeight: 900 }}>Mei 2015:</MotionWord>{' '}
                <MotionWord t={t} start={40.85} className="white-glow-text">Rust 1.0</MotionWord>
              </div>
              <div className="kinetic-title" style={{ fontSize: 34, marginTop: 4 }}>
                <MotionWord t={t} start={41.30} className="white-glow-text">resmi</MotionWord>{' '}
                <MotionWord t={t} start={41.65} spring fromScale={0.45} className="red-glow-text" style={{ fontWeight: 900 }}>stabil.</MotionWord>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================================
            SCENE 10 (45.0s - 50.0s): #1 MOST LOVED STATS (BLACK)
            ======================================================================= */}
        {isS10 && (
          <div className="scene active perspective-stage" style={{ backgroundColor: '#0A0A0A', color: '#ffffff' }}>
            {(() => {
              const cardP = easeOutBack(progress(t, 45.0, 45.8));
              const floatAngle = (t - 45.0) * 3.2;
              return (
                <div
                  style={{
                    width: '88%',
                    borderRadius: 16,
                    backgroundColor: 'rgba(18,19,24,0.95)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    padding: 20,
                    boxShadow: '0 25px 70px rgba(255,36,36,0.25)',
                    backdropFilter: 'blur(16px)',
                    transform: `rotateY(${-16 + cardP * 12 + floatAngle}deg) rotateX(${12 - cardP * 8}deg) scale(${0.75 + cardP * 0.25})`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 'bold', fontSize: 18, letterSpacing: '-0.02em' }}>rust-lang</span>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#EF4444' }} />
                    </div>
                    <span style={{ padding: '2px 10px', fontSize: 10, fontFamily: 'monospace', backgroundColor: 'rgba(239,68,68,0.2)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 999, fontWeight: 'bold' }}>
                      STACK OVERFLOW SURVEY
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(to top right, #dc2626, #f97316)', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#09090B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 900, fontSize: 20, color: '#EF4444' }}>
                        #1
                      </div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>8+ Thn</div>
                        <div style={{ fontSize: 10, color: '#A1A1AA' }}>Most Admired</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>100K+</div>
                        <div style={{ fontSize: 10, color: '#A1A1AA' }}>GitHub Stars</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: '#F87171' }}>85%+</div>
                        <div style={{ fontSize: 10, color: '#A1A1AA' }}>Love Rating</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'rgba(24,24,27,0.9)', padding: 12, borderRadius: 12, border: '1px solid #27272A', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 64, gap: 8, paddingInline: 8 }}>
                      <div style={{ width: '100%', backgroundColor: '#3F3F46', height: 24, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                      <div style={{ width: '100%', backgroundColor: '#52525B', height: 32, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                      <div style={{ width: '100%', backgroundColor: '#991B1B', height: 40, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                      <div style={{ width: '100%', backgroundColor: '#DC2626', height: 48, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                      <div style={{ width: '100%', backgroundColor: '#FF2424', height: 64, borderTopLeftRadius: 4, borderTopRightRadius: 4, boxShadow: '0 0 12px rgba(255,36,36,0.8)' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'monospace', color: '#A1A1AA', marginTop: 6, paddingInline: 4 }}>
                      <span>2016</span><span>2018</span><span>2020</span><span>2023</span><span style={{ color: '#F87171', fontWeight: 'bold' }}>2026</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#E4E4E7', fontWeight: 500 }}>
                    Bahasa pemrograman paling dicintai developer dunia berturut-turut. 🦀🔥
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* =======================================================================
            SCENE 11 (50.0s - 55.0s): LINUX KERNEL & GIANTS (CREAM)
            ======================================================================= */}
        {isS11 && (
          <div className="scene active" style={{ backgroundColor: '#F4F1EA', color: '#111111' }}>
            <div className="tech-grid-light" style={{ position: 'absolute', inset: 0 }} />
            <div style={{ width: 288, marginBottom: 20, position: 'relative', zIndex: 20 }}>
              <div style={{ backgroundColor: '#18181B', color: '#fff', padding: 16, borderRadius: 16, border: '2px solid #27272A', boxShadow: '0 25px 50px rgba(0,0,0,0.15)', textAlign: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#F87171', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 'bold' }}>SEJARAH BARU // LINUX 6.1+</span>
                <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', marginTop: 2 }}>LINUX KERNEL</div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#A1A1AA', marginTop: 2 }}>Bahasa ke-2 setelah C dalam 30+ tahun</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold' }}>
                <MotionWord t={t} start={50.30} spring style={{ padding: 10, borderRadius: 12, backgroundColor: '#fff', border: '1px solid rgba(0,0,0,0.15)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#DC2626' }} />
                  <span>Windows Core</span>
                </MotionWord>
                <MotionWord t={t} start={50.65} spring style={{ padding: 10, borderRadius: 12, backgroundColor: '#fff', border: '1px solid rgba(0,0,0,0.15)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                  <span>AWS Firecracker</span>
                </MotionWord>
                <MotionWord t={t} start={51.00} spring style={{ padding: 10, borderRadius: 12, backgroundColor: '#fff', border: '1px solid rgba(0,0,0,0.15)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#059669' }} />
                  <span>Android OS</span>
                </MotionWord>
                <MotionWord t={t} start={51.35} spring style={{ padding: 10, borderRadius: 12, backgroundColor: '#fff', border: '1px solid rgba(0,0,0,0.15)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#2563EB' }} />
                  <span>Cloudflare</span>
                </MotionWord>
              </div>
            </div>

            <div style={{ paddingInline: 24, textAlign: 'center', zIndex: 20 }}>
              <div className="kinetic-title" style={{ fontSize: 31, color: '#18181B' }}>
                <MotionWord t={t} start={51.70}>Menembus</MotionWord>{' '}
                <MotionWord t={t} start={52.00} spring className="red-solid-text" style={{ fontWeight: 900 }}>inti OS</MotionWord>
              </div>
              <div className="kinetic-title" style={{ fontSize: 31, color: '#18181B' }}>
                <MotionWord t={t} start={52.40}>&amp; raksasa</MotionWord>{' '}
                <MotionWord t={t} start={52.75} spring style={{ fontWeight: 900 }}>cloud dunia.</MotionWord>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================================
            SCENE 12 (55.0s - 60.0s): KEYBOARD & FINALE
            ======================================================================= */}
        {isS12 && (
          <div className="scene active" style={{ backgroundColor: '#F4F1EA', color: '#111111' }}>
            {t < 57.5 ? (
              <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ zIndex: 20, textAlign: 'center', paddingInline: 24, marginTop: -96 }}>
                  <div className="kinetic-title" style={{ fontSize: 32, color: '#18181B' }}>
                    <MotionWord t={t} start={55.10}>Dari</MotionWord>{' '}
                    <MotionWord t={t} start={55.35}>lift rusak,</MotionWord>
                  </div>
                  <div className="kinetic-title" style={{ fontSize: 38, marginTop: 2 }}>
                    <MotionWord t={t} start={55.70}>jadi</MotionWord>{' '}
                    <MotionWord t={t} start={56.00} spring className="red-solid-text" style={{ fontWeight: 900 }}>standar dunia.</MotionWord>
                  </div>
                </div>

                {(() => {
                  const kbSlide = easeOutExpo(progress(t, 55.0, 55.8));
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -40,
                        width: '115%',
                        backgroundColor: '#18181C',
                        padding: 14,
                        borderRadius: 16,
                        boxShadow: '0 -15px 40px rgba(0,0,0,0.35)',
                        borderTop: '2px solid #3F3F46',
                        transform: `rotate(-12deg) translate3d(0, ${(1 - kbSlide) * 140}px, 0)`,
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6, fontFamily: 'monospace', fontSize: 10, color: '#D4D4D8' }}>
                        <div style={{ backgroundColor: '#27272A', padding: 8, borderRadius: 4, borderBottom: '2px solid #09090B', color: '#F87171', fontWeight: 'bold' }}>ESC</div>
                        {['1','2','3','4','5','6','7','8','9'].map(n => (
                          <div key={n} style={{ backgroundColor: '#27272A', padding: 8, borderRadius: 4, borderBottom: '2px solid #09090B' }}>{n}</div>
                        ))}
                        <div style={{ backgroundColor: '#3F3F46', padding: 8, borderRadius: 4, borderBottom: '2px solid #09090B', gridColumn: 'span 2' }}>TAB</div>
                        {['C','A','R','G','O'].map(letter => (
                          <div key={letter} style={{ backgroundColor: '#FF2424', color: '#fff', fontWeight: 900, padding: 8, borderRadius: 4, borderBottom: '2px solid #7F1D1D', boxShadow: '0 0 10px #FF2424', textAlign: 'center' }}>
                            {letter}
                          </div>
                        ))}
                        <div style={{ backgroundColor: '#27272A', padding: 8, borderRadius: 4, borderBottom: '2px solid #09090B' }}>U</div>
                        <div style={{ backgroundColor: '#27272A', padding: 8, borderRadius: 4, borderBottom: '2px solid #09090B' }}>I</div>
                        <div style={{ backgroundColor: '#27272A', padding: 8, borderRadius: 4, borderBottom: '2px solid #09090B' }}>P</div>
                        <div style={{ backgroundColor: '#3F3F46', padding: 8, borderRadius: 4, borderBottom: '2px solid #09090B', gridColumn: 'span 2' }}>SHIFT</div>
                        {['R','U','S','T'].map(l => (
                          <div key={l} style={{ backgroundColor: '#27272A', padding: 8, borderRadius: 4, borderBottom: '2px solid #09090B', textAlign: 'center' }}>{l}</div>
                        ))}
                        <div style={{ backgroundColor: '#DC2626', color: '#fff', fontWeight: 'bold', padding: 8, borderRadius: 4, borderBottom: '2px solid #7F1D1D', gridColumn: 'span 4', textAlign: 'center' }}>
                          ENTER ↵
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#0A0A0A',
                  color: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 30,
                  paddingInline: 24,
                }}
              >
                <div className="kinetic-title" style={{ fontSize: 34, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 8 }}>
                  <MotionWord t={t} start={57.55} blur={12} className="white-glow-text">Masa</MotionWord>
                  <MotionWord t={t} start={57.80} blur={12} className="white-glow-text">depan</MotionWord>
                  <MotionWord t={t} start={58.10} spring fromScale={0.45} blur={12} className="red-glow-text" style={{ fontWeight: 900 }}>sistem.</MotionWord>
                </div>
                <MotionWord
                  t={t}
                  start={58.55}
                  spring
                  fromScale={0.6}
                  style={{
                    marginTop: 16,
                    padding: '8px 16px',
                    borderRadius: 12,
                    backgroundColor: '#18181B',
                    border: '1px solid rgba(239,68,68,0.5)',
                    fontFamily: 'monospace',
                    fontSize: 18,
                    color: '#F87171',
                    fontWeight: 'bold',
                    boxShadow: '0 0 30px rgba(255,36,36,0.4)',
                  }}
                >
                  $ cargo run --release 🦀
                </MotionWord>
              </div>
            )}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
'''

with open('workspace/src/rust-history/RustHistoryComposition.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Generated workspace/src/rust-history/RustHistoryComposition.tsx successfully')

