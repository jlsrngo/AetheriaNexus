// Scene 4: SVG Bezier Node Graph & Payoff
// Background: #F2ECE5 -> #0C0B0B end card
import React from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { COLORS, FONT_FAMILY } from './types';
import { enter, scaleIn, fadeIn, svgDashDraw } from './motion';

const Node: React.FC<{ frame: number; x: number; y: number; label: string; delay: number; icon: React.ReactNode }> = ({ frame, x, y, label, delay, icon }) => {
  const opacity = fadeIn(frame, delay);
  const scale = scaleIn(frame, delay, 0.7);

  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: `translate(-50%, -50%) scale(${scale})`,
      opacity,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${COLORS.emeraldSage}, ${COLORS.mintSage})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(77, 94, 78, 0.3)',
      }}>
        {icon}
      </div>
      <span style={{
        fontFamily: FONT_FAMILY.sans,
        fontSize: 13,
        fontWeight: 600,
        color: COLORS.primaryText,
        textAlign: 'center',
        maxWidth: 140,
      }}>
        {label}
      </span>
    </div>
  );
};

export const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const WIDTH = 1920;
  const HEIGHT = 1080;

  // Beat 1: Node graph (0..210 frames / 0..3.5s)
  const headlineOpacity = fadeIn(frame, 0);
  const headlineY = (1 - enter(frame, 0, { config: 'smooth' })) * 30;

  // SVG curve drawing
  const dashOffset1 = svgDashDraw(frame, 25, 600, 45);
  const dashOffset2 = svgDashDraw(frame, 45, 600, 45);
  const dashOffset3 = svgDashDraw(frame, 65, 600, 45);
  const dashOffset4 = svgDashDraw(frame, 85, 600, 45);

  // Beat 2: End card transition (210..460 frames / 3.5..7.6s)
  const endCardOpacity = fadeIn(frame, 210);
  const endCardScale = scaleIn(frame, 210, 0.9);
  const emblemGlow = (Math.sin(frame * 0.15) + 1) * 0.5;
  const ctaGlow = (Math.sin(frame * 0.2) + 1) * 0.5;

  return (
    <AbsoluteFill style={{ 
      backgroundColor: COLORS.editorialBg, 
      overflow: 'hidden',
    }}>
      {/* Beat 1: Node graph */}
      <div style={{
        position: 'absolute',
        top: 120,
        left: 0,
        right: 0,
        textAlign: 'center',
        transform: `translateY(${headlineY}px)`,
        opacity: headlineOpacity,
      }}>
        <h1 style={{
          margin: 0,
          fontFamily: FONT_FAMILY.serif,
          fontSize: 52,
          fontWeight: 700,
          color: COLORS.primaryText,
          letterSpacing: '-0.02em',
        }}>
          Dari Prompt ke Motion Graphics
        </h1>
      </div>

      {/* SVG Bezier curves */}
      <svg width={WIDTH} height={HEIGHT} style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* Curve to Node 1 */}
        <path
          d="M 560 450 C 680 450, 720 320, 840 320"
          fill="none"
          stroke={COLORS.emeraldSage}
          strokeWidth={3}
          strokeDasharray={600}
          strokeDashoffset={dashOffset1}
          strokeLinecap="round"
        />
        {/* Curve to Node 2 */}
        <path
          d="M 560 450 C 680 450, 720 450, 840 450"
          fill="none"
          stroke={COLORS.emeraldSage}
          strokeWidth={3}
          strokeDasharray={600}
          strokeDashoffset={dashOffset2}
          strokeLinecap="round"
        />
        {/* Curve to Node 3 */}
        <path
          d="M 560 450 C 680 450, 720 580, 840 580"
          fill="none"
          stroke={COLORS.emeraldSage}
          strokeWidth={3}
          strokeDasharray={600}
          strokeDashoffset={dashOffset3}
          strokeLinecap="round"
        />
        {/* Curve to Node 4 */}
        <path
          d="M 560 450 C 680 450, 720 710, 840 710"
          fill="none"
          stroke={COLORS.emeraldSage}
          strokeWidth={3}
          strokeDasharray={600}
          strokeDashoffset={dashOffset4}
          strokeLinecap="round"
        />
      </svg>

      {/* Center node: Aetheria Engine */}
      <Node
        frame={frame}
        x={560}
        y={450}
        label="Aetheria Engine"
        delay={0}
        icon={
          <svg width={32} height={32} viewBox="0 0 24 24" fill="white">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        }
      />

      {/* Node 1: Remotion 60fps Code */}
      <Node
        frame={frame}
        x={840}
        y={320}
        label="Remotion 60fps Code"
        delay={25}
        icon={
          <svg width={32} height={32} viewBox="0 0 24 24" fill="white">
            <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
          </svg>
        }
      />

      {/* Node 2: VoxCPM2 Neural Voice */}
      <Node
        frame={frame}
        x={840}
        y={450}
        label="VoxCPM2 Neural Voice"
        delay={45}
        icon={
          <svg width={32} height={32} viewBox="0 0 24 24" fill="white">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        }
      />

      {/* Node 3: Smart SFX Engine */}
      <Node
        frame={frame}
        x={840}
        y={580}
        label="Smart SFX Engine"
        delay={65}
        icon={
          <svg width={32} height={32} viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
          </svg>
        }
      />

      {/* Node 4: Zero Cloud Cost Rp 0 */}
      <Node
        frame={frame}
        x={840}
        y={710}
        label="Zero Cloud Cost Rp 0"
        delay={85}
        icon={
          <svg width={32} height={32} viewBox="0 0 24 24" fill="white">
            <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.15c-1.89.56-3.5 1.61-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.93-.5 3.5-1.6 3.5-3.55 0-2.84-1.85-3.91-4.7-4.4z" />
          </svg>
        }
      />

      {/* Beat 2: End card overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.endCardBg,
        opacity: endCardOpacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Glowing Aetheria emblem */}
        <div style={{
          transform: `scale(${endCardScale})`,
          opacity: endCardOpacity,
          textAlign: 'center',
        }}>
          <div style={{
            width: 120,
            height: 120,
            margin: '0 auto 32px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${COLORS.emeraldSage}, transparent)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 ${60 + emblemGlow * 40}px rgba(77, 94, 78, ${0.5 + emblemGlow * 0.3})`,
          }}>
            <svg width={64} height={64} viewBox="0 0 24 24" fill="white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>

          <h1 style={{
            margin: 0,
            fontFamily: FONT_FAMILY.sans,
            fontSize: 72,
            fontWeight: 900,
            color: COLORS.white,
            letterSpacing: '-0.04em',
          }}>
            Aetheria Nexus
          </h1>

          <p style={{
            marginTop: 16,
            fontFamily: FONT_FAMILY.sans,
            fontSize: 32,
            fontWeight: 600,
            color: COLORS.warmGold,
            letterSpacing: '0.02em',
          }}>
            Lo Tulis, Dia Gerak.
          </p>

          {/* CTA pill */}
          <div style={{
            marginTop: 40,
            transform: `scale(${scaleIn(frame, 330, 0.8)})`,
            opacity: fadeIn(frame, 330),
          }}>
            <div style={{
              background: `linear-gradient(135deg, ${COLORS.emeraldSage}, ${COLORS.warmGold})`,
              borderRadius: 32,
              padding: '18px 48px',
              display: 'inline-block',
              boxShadow: `0 0 ${40 + ctaGlow * 30}px rgba(77, 94, 78, ${0.4 + ctaGlow * 0.3})`,
            }}>
              <span style={{
                fontFamily: FONT_FAMILY.mono,
                fontSize: 18,
                fontWeight: 700,
                color: COLORS.white,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Mulai Render Sekarang — Gratis
              </span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
