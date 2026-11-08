// Scene 3: Screen-Studio Macro Zoom UI
// Background: #F2ECE5 with tilted hardware frame
import React from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { COLORS, FONT_FAMILY } from './types';
import { enter, scaleIn, fadeIn, cameraZoom } from './motion';

export const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const WIDTH = 1920;

  // Beat 1: Headline + Zero cloud cost (0..210 frames / 0..3.5s)
  const headlineOpacity = fadeIn(frame, 0);
  const headlineY = (1 - enter(frame, 0, { config: 'smooth' })) * 30;
  const zeroCostScale = scaleIn(frame, 60, 0.8);

  // Beat 2: Tilted hardware frame (210..450 frames / 3.5..7.5s)
  const frameOpacity = fadeIn(frame, 210);
  const frameScale = scaleIn(frame, 210, 0.92);
  const statusPillScale = scaleIn(frame, 270, 0.7);

  // Beat 3: 100% Frame Sync metric (450..730 frames / 7.5..12s)
  const metricOpacity = fadeIn(frame, 450);
  const metricScale = scaleIn(frame, 450, 0.7);
  const waveformProgress = enter(frame, 540);

  // Sub-beat: Audio badge (540..730 frames / 9..12s)
  const badgeOpacity = fadeIn(frame, 540);

  return (
    <AbsoluteFill style={{ 
      backgroundColor: COLORS.editorialBg, 
      overflow: 'hidden',
      backgroundImage: `
        linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
      `,
      backgroundSize: '60px 60px, 60px 60px',
    }}>
      {/* Beat 1: Headline */}
      <div style={{
        position: 'absolute',
        top: 100,
        left: 0,
        right: 0,
        textAlign: 'center',
        transform: `translateY(${headlineY}px)`,
        opacity: headlineOpacity,
      }}>
        <h1 style={{
          margin: 0,
          fontFamily: FONT_FAMILY.sans,
          fontSize: 56,
          fontWeight: 800,
          color: COLORS.primaryText,
          letterSpacing: '-0.03em',
        }}>
          Lokal & Bebas Cloud
        </h1>
      </div>

      {/* Giant zero cost readout */}
      <div style={{
        position: 'absolute',
        top: 200,
        left: 0,
        right: 0,
        textAlign: 'center',
        transform: `scale(${zeroCostScale})`,
        opacity: fadeIn(frame, 60),
      }}>
        <div style={{
          display: 'inline-block',
          background: `linear-gradient(135deg, ${COLORS.emeraldSage}, ${COLORS.warmGold})`,
          borderRadius: 16,
          padding: '16px 40px',
        }}>
          <span style={{
            fontFamily: FONT_FAMILY.mono,
            fontSize: 48,
            fontWeight: 800,
            color: COLORS.white,
            letterSpacing: '-0.03em',
          }}>
            Rp 0 Cloud Bill
          </span>
        </div>
      </div>

      {/* Beat 2: Tilted hardware frame */}
      <div style={{
        position: 'absolute',
        top: 380,
        left: 280,
        right: 280,
        bottom: 120,
        transform: `perspective(1200px) rotateX(4deg) rotateY(-2deg) scale(${frameScale})`,
        transformStyle: 'preserve-3d',
        opacity: frameOpacity,
      }}>
        {/* Hardware window */}
        <div style={{
          background: COLORS.white,
          borderRadius: 16,
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Window header */}
          <div style={{
            height: 52,
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#FF5F57' }} />
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#FEBC2E' }} />
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#28C840' }} />
            </div>
            <span style={{ fontFamily: FONT_FAMILY.sans, fontSize: 14, color: COLORS.brandAccent }}>
              Aetheria Nexus — Render Engine
            </span>
            <div style={{ width: 80 }} />
          </div>

          {/* Main render area */}
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
            {/* Status pill */}
            <div style={{
              transform: `scale(${statusPillScale})`,
              opacity: fadeIn(frame, 270),
            }}>
              <div style={{
                background: `linear-gradient(135deg, ${COLORS.mintSage}, ${COLORS.emeraldSage})`,
                borderRadius: 24,
                padding: '12px 28px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: `0 0 30px rgba(107, 142, 122, 0.4)`,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.white }} />
                <span style={{
                  fontFamily: FONT_FAMILY.mono,
                  fontSize: 14,
                  fontWeight: 700,
                  color: COLORS.white,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  RENDERED LOCAL
                </span>
              </div>
            </div>

            {/* Colossal metric */}
            <div style={{
              transform: `scale(${metricScale})`,
              opacity: metricOpacity,
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: FONT_FAMILY.sans,
                fontSize: 132,
                fontWeight: 900,
                color: COLORS.primaryText,
                letterSpacing: '-0.06em',
                lineHeight: 1,
              }}>
                100%
              </div>
              <div style={{
                fontFamily: FONT_FAMILY.sans,
                fontSize: 32,
                fontWeight: 700,
                color: COLORS.brandAccent,
                letterSpacing: '0.05em',
                marginTop: 8,
              }}>
                FRAME SYNC
              </div>
            </div>

            {/* Word timing markers */}
            <div style={{
              display: 'flex',
              gap: 8,
              marginTop: 24,
              opacity: fadeIn(frame, 500),
            }}>
              {['Semua', 'orang', 'bilang', 'AI', 'video', 'itu', 'ribet'].map((word, i) => (
                <div
                  key={word}
                  style={{
                    background: i <= Math.floor(waveformProgress * 7) ? COLORS.emeraldSage : COLORS.cardSurface,
                    borderRadius: 6,
                    padding: '6px 12px',
                  }}
                >
                  <span style={{
                    fontFamily: FONT_FAMILY.mono,
                    fontSize: 12,
                    fontWeight: 600,
                    color: i <= Math.floor(waveformProgress * 7) ? COLORS.white : COLORS.brandAccent,
                  }}>
                    {word}
                  </span>
                </div>
              ))}
            </div>

            {/* Animated waveform */}
            <div style={{
              width: '100%',
              height: 80,
              background: COLORS.cardSurface,
              borderRadius: 12,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              opacity: fadeIn(frame, 540),
            }}>
              {Array.from({ length: 48 }).map((_, i) => {
                const waveHeight = Math.sin((frame * 0.1 + i * 0.5)) * 20 + 24;
                const isActive = i < waveformProgress * 48;
                return (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: waveHeight,
                      background: isActive ? COLORS.emeraldSage : COLORS.border,
                      borderRadius: 3,
                    }}
                  />
                );
              })}
            </div>

            {/* Audio-Visual Lock badge */}
            <div style={{
              transform: `scale(${scaleIn(frame, 600, 0.8)})`,
              opacity: badgeOpacity,
            }}>
              <div style={{
                background: COLORS.white,
                border: `2px solid ${COLORS.emeraldSage}`,
                borderRadius: 12,
                padding: '14px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <svg width={24} height={24} viewBox="0 0 24 24" fill={COLORS.emeraldSage}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                <div>
                  <div style={{
                    fontFamily: FONT_FAMILY.mono,
                    fontSize: 14,
                    fontWeight: 700,
                    color: COLORS.primaryText,
                  }}>
                    0ms Delay
                  </div>
                  <div style={{
                    fontFamily: FONT_FAMILY.sans,
                    fontSize: 11,
                    color: COLORS.brandAccent,
                  }}>
                    Audio-Visual Lock Verified
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
