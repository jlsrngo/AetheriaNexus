// Scene 2: Staggered Pill Stack & Workstation UI
// Background: #F2ECE5 warm editorial grid
import React from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { COLORS, FONT_FAMILY } from './types';
import { enter, scaleIn, fadeIn, cursorGlide, cameraZoom } from './motion';

export const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const WIDTH = 1920;

  // Beat 1: Editorial header (0..270 frames / 0..4.5s)
  const headerOpacity = fadeIn(frame, 0);
  const headerY = (1 - enter(frame, 0)) * 40;

  // Beat 2: Cursor interaction (270..630 frames / 4.5..10.5s)
  const cursor = cursorGlide(frame, 270, 400, 850, 300, 420);
  const cursorClick = Math.max(0, Math.min(1, (frame - 330) / 10));
  const cursorScale = 1 - cursorClick * 0.06;

  // Modal appears after cursor click
  const modalOpacity = fadeIn(frame, 340);
  const modalScale = scaleIn(frame, 340, 0.9);

  // Beat 3: Camera zoom on tuning sliders (630..1020 frames / 10.5..17s)
  const zoom = cameraZoom(frame, 630, 1, 1.15, 120);
  const slider1Opacity = fadeIn(frame, 680);
  const slider2Opacity = fadeIn(frame, 720);

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
      <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
        {/* Beat 1: Editorial header */}
        <div style={{
          position: 'absolute',
          top: 80,
          left: 0,
          right: 0,
          textAlign: 'center',
          transform: `translateY(${headerY}px)`,
          opacity: headerOpacity,
        }}>
          <h1 style={{
            margin: 0,
            fontFamily: FONT_FAMILY.serif,
            fontSize: 64,
            fontWeight: 700,
            color: COLORS.primaryText,
            letterSpacing: '-0.02em',
          }}>
            Aetheria Nexus Workstation
          </h1>
          <p style={{
            marginTop: 12,
            fontFamily: FONT_FAMILY.sans,
            fontSize: 24,
            color: COLORS.brandAccent,
            fontWeight: 500,
          }}>
            Ketik <span style={{ fontFamily: FONT_FAMILY.mono, background: COLORS.cardSurface, padding: '4px 12px', borderRadius: 6 }}>/add preset</span>
          </p>
        </div>

        {/* App window frame */}
        <div style={{
          position: 'absolute',
          top: 200,
          left: 200,
          right: 200,
          bottom: 100,
          background: COLORS.white,
          borderRadius: 16,
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}>
          {/* Window title bar */}
          <div style={{
            height: 48,
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            gap: 8,
          }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
            <span style={{ marginLeft: 16, fontFamily: FONT_FAMILY.sans, fontSize: 14, color: COLORS.brandAccent }}>
              Aetheria Nexus — Studio
            </span>
          </div>

          {/* Main content area */}
          <div style={{ padding: 40, display: 'flex', gap: 32, height: 'calc(100% - 48px)' }}>
            {/* Left Card: Audio & Voicebox Preset */}
            <div style={{
              flex: 1,
              background: COLORS.cardSurface,
              borderRadius: 12,
              padding: 24,
              border: `1px solid ${COLORS.border}`,
              opacity: fadeIn(frame, 100),
              transform: `scale(${scaleIn(frame, 100, 0.95)})`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: COLORS.mintSage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="white">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                </div>
                <h3 style={{ margin: 0, fontFamily: FONT_FAMILY.sans, fontSize: 18, fontWeight: 600, color: COLORS.primaryText }}>
                  Audio & Voicebox
                </h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontFamily: FONT_FAMILY.sans, fontSize: 13, color: COLORS.brandAccent, display: 'block', marginBottom: 8 }}>
                    Voice Preset
                  </label>
                  <div style={{ background: COLORS.white, borderRadius: 8, padding: '12px 16px', border: `1px solid ${COLORS.border}` }}>
                    <span style={{ fontFamily: FONT_FAMILY.mono, fontSize: 14, fontWeight: 600 }}>aetheria:energetic</span>
                  </div>
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontFamily: FONT_FAMILY.sans, fontSize: 13, color: COLORS.brandAccent, display: 'block', marginBottom: 8 }}>
                    CFG Voice Temperature
                  </label>
                  <div style={{ background: COLORS.white, borderRadius: 8, padding: '12px 16px', border: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: FONT_FAMILY.mono, fontSize: 16, fontWeight: 700, color: COLORS.emeraldSage }}>1.48</span>
                    <span style={{ fontFamily: FONT_FAMILY.sans, fontSize: 12, color: COLORS.brandAccent }}>Lepas</span>
                  </div>
                </div>
                
                <div>
                  <label style={{ fontFamily: FONT_FAMILY.sans, fontSize: 13, color: COLORS.brandAccent, display: 'block', marginBottom: 8 }}>
                    Pedalboard Limiter
                  </label>
                  <div style={{ background: COLORS.white, borderRadius: 8, padding: '12px 16px', border: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: FONT_FAMILY.mono, fontSize: 16, fontWeight: 700, color: COLORS.warmGold }}>-14.0 LUFS</span>
                    <span style={{ fontFamily: FONT_FAMILY.sans, fontSize: 12, color: COLORS.brandAccent }}>Mastered</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Card: Video Blueprint Extractor */}
            <div style={{
              flex: 1,
              background: COLORS.cardSurface,
              borderRadius: 12,
              padding: 24,
              border: `1px solid ${COLORS.border}`,
              opacity: fadeIn(frame, 150),
              transform: `scale(${scaleIn(frame, 150, 0.95)})`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: COLORS.warmGold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="white">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                  </svg>
                </div>
                <h3 style={{ margin: 0, fontFamily: FONT_FAMILY.sans, fontSize: 18, fontWeight: 600, color: COLORS.primaryText }}>
                  Video Blueprint
                </h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontFamily: FONT_FAMILY.sans, fontSize: 13, color: COLORS.brandAccent, display: 'block', marginBottom: 8 }}>
                    Reference Video
                  </label>
                  <div style={{ background: COLORS.white, borderRadius: 8, padding: '12px 16px', border: `1px solid ${COLORS.border}` }}>
                    <span style={{ fontFamily: FONT_FAMILY.mono, fontSize: 13 }}>macrohou_ren.mp4</span>
                  </div>
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontFamily: FONT_FAMILY.sans, fontSize: 13, color: COLORS.brandAccent, display: 'block', marginBottom: 8 }}>
                    Detected Style
                  </label>
                  <div style={{ background: COLORS.white, borderRadius: 8, padding: '12px 16px', border: `1px solid ${COLORS.border}` }}>
                    <span style={{ fontFamily: FONT_FAMILY.sans, fontSize: 14, fontWeight: 600 }}>Bright Editorial White</span>
                  </div>
                </div>
                
                <div>
                  <label style={{ fontFamily: FONT_FAMILY.sans, fontSize: 13, color: COLORS.brandAccent, display: 'block', marginBottom: 8 }}>
                    Scene Count
                  </label>
                  <div style={{ background: COLORS.white, borderRadius: 8, padding: '12px 16px', border: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: FONT_FAMILY.mono, fontSize: 16, fontWeight: 700, color: COLORS.emeraldSage }}>4 Scenes</span>
                    <span style={{ fontFamily: FONT_FAMILY.sans, fontSize: 12, color: COLORS.brandAccent }}>Extracted</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Command bar at bottom */}
          <div style={{
            position: 'absolute',
            bottom: 40,
            left: 240,
            right: 240,
            background: COLORS.white,
            borderRadius: 12,
            border: `1px solid ${COLORS.border}`,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: fadeIn(frame, 200),
            transform: `translateY(${(1 - enter(frame, 200)) * 20}px)`,
          }}>
            <span style={{ fontFamily: FONT_FAMILY.mono, fontSize: 16, fontWeight: 600, color: COLORS.primaryText }}>
              /add preset
            </span>
            <span style={{ fontFamily: FONT_FAMILY.sans, fontSize: 14, color: COLORS.brandAccent }}>
              — Select a template to auto-generate studio
            </span>
          </div>
        </div>

        {/* Animated cursor */}
        {frame >= 270 && (
          <div style={{
            position: 'absolute',
            left: cursor.x,
            top: cursor.y,
            transform: `scale(${cursorScale})`,
            transition: 'transform 0.05s',
            pointerEvents: 'none',
            zIndex: 100,
          }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill={COLORS.primaryText} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
              <path d="M5.5 3.21l10.48 12.76-5.31.66 3.38 5.36-1.97 1.24-3.38-5.36-3.2 4.16V3.21z" />
            </svg>
            {/* Click ripple effect */}
            {frame >= 330 && frame < 360 && (
              <div style={{
                position: 'absolute',
                left: -16,
                top: -16,
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: `2px solid ${COLORS.emeraldSage}`,
                transform: `scale(${1 + (frame - 330) / 10})`,
                opacity: 1 - (frame - 330) / 30,
              }} />
            )}
          </div>
        )}

        {/* Modal pop after click */}
        {frame >= 340 && (
          <div style={{
            position: 'absolute',
            top: 400,
            left: WIDTH / 2 - 180,
            transform: `scale(${modalScale})`,
            opacity: modalOpacity,
            background: COLORS.white,
            borderRadius: 16,
            padding: '24px 32px',
            border: `2px solid ${COLORS.emeraldSage}`,
            boxShadow: '0 12px 48px rgba(0,0,0,0.12)',
            textAlign: 'center',
          }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: COLORS.emeraldSage, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={24} height={24} viewBox="0 0 24 24" fill="white">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            </div>
            <h3 style={{ margin: 0, fontFamily: FONT_FAMILY.sans, fontSize: 20, fontWeight: 700, color: COLORS.primaryText }}>
              Studio Loaded
            </h3>
            <p style={{ margin: '8px 0 0', fontFamily: FONT_FAMILY.sans, fontSize: 14, color: COLORS.brandAccent }}>
              Voicebox + Remotion ready
            </p>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
