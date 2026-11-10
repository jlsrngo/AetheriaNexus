/**
 * CollageLayout.tsx — Vertical 9:16 (1080×1920) Standard Spatial Grid Guardrail
 * Enforces the strict 6-zone spatial contract so that any LLM generating scenes
 * will ALWAYS produce perfectly positioned, balanced, non-overlapping collage art.
 */
import React from "react";
import { AbsoluteFill, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export interface CollageLayoutProps {
  // Zone 0: Header & Stamp
  headerTitle?: string;
  headerRef?: string;
  stamp?: {
    year: string | number;
    tag?: string;
    location?: string;
  };

  // Zone 1 & 2: Hero & Newspaper Backdrop
  newsScrapSrc?: string;
  heroImageSrc: string;
  heroCaption?: string;

  // Zone 3: Accent Element
  accentSrc?: string;
  pointerSrc?: string;

  // Zone 4: Constructivist Headline
  headline?: {
    title: string;
    badge?: string;
    color?: string;
  };

  // Timing Cues (in frames)
  cues?: {
    news?: number;
    hero?: number;
    stamp?: number;
    accent?: number;
    headline?: number;
    pointer?: number;
  };

  children?: React.ReactNode;
}

function hash(a: number, b: number = 0): number {
  let h = (a * 374761393 + b * 668265263 + 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function boil(id: number, frame: number, amp = 2) {
  const step = Math.floor((frame / 30) * 12);
  const x = (hash(id, step) * 2 - 1) * amp;
  const y = (hash(id + 71, step) * 2 - 1) * amp;
  const rot = (hash(id + 913, step) * 2 - 1) * amp * 0.2;
  return { x, y, rot };
}

export const CollageLayout: React.FC<CollageLayoutProps> = ({
  headerTitle = "DOSSIER: BLETCHLEY PARK / ARCHIVE",
  headerRef = "REF // TOP-SECRET",
  stamp,
  newsScrapSrc = "mg-styles/06-collage/assets/gen/news_a.png",
  heroImageSrc,
  heroCaption,
  accentSrc = "mg-styles/06-collage/assets/gen/rose_centi.png",
  pointerSrc,
  headline,
  cues = { news: 2, hero: 8, stamp: 14, accent: 22, headline: 32, pointer: 60 },
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Physics springs
  const heroSpr = spring({ frame: Math.max(0, frame - cues.hero!), fps, config: { damping: 11, stiffness: 160 } });
  const stampSpr = spring({ frame: Math.max(0, frame - cues.stamp!), fps, config: { damping: 9, stiffness: 180 } });
  const headSpr = spring({ frame: Math.max(0, frame - cues.headline!), fps, config: { damping: 12, stiffness: 150 } });

  const hJit = boil(1, frame, 2);
  const bJit = boil(2, frame, 1.5);

  return (
    <AbsoluteFill style={{ backgroundColor: "#181410", overflow: "hidden" }}>
      {/* Kraft Paper Base Ground */}
      <img
        src={staticFile("mg-styles/06-collage/assets/gen/page_kraft.jpg")}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "contrast(1.08) sepia(20%) brightness(0.92)",
        }}
      />

      {/* Film Grain */}
      <img
        src={staticFile("mg-styles/textures/grain/grain_fine_2048.png")}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.16,
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }}
      />

      {/* ZONE 0: Top Archival Header Bar (Y: 60 - 240px) */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 54,
          right: 54,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #5a4836",
          paddingBottom: 8,
          fontFamily: "monospace",
          fontSize: 18,
          fontWeight: 700,
          color: "#6e5944",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          zIndex: 5,
        }}
      >
        <span>{headerTitle}</span>
        <span>{headerRef}</span>
      </div>

      {/* ZONE 0 Stamp: Anchored strictly at top-right, never obscuring faces */}
      {stamp && frame >= cues.stamp! && (
        <div
          style={{
            position: "absolute",
            top: 130,
            right: 64,
            transform: `scale(${interpolate(stampSpr, [0, 1], [2.2, 1])}) rotate(11deg)`,
            opacity: interpolate(stampSpr, [0, 0.4, 1], [0, 0.9, 0.92]),
            zIndex: 25,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              border: "4px solid #B7281E",
              borderRadius: 8,
              padding: "8px 24px",
              backgroundColor: "rgba(183, 40, 30, 0.08)",
              boxShadow: "inset 0 0 0 2px rgba(183, 40, 30, 0.3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {stamp.tag && (
              <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 900, color: "#B7281E", letterSpacing: "0.2em" }}>
                ★ {stamp.tag} ★
              </div>
            )}
            <div
              style={{
                fontFamily: "Impact, 'Arial Black', sans-serif",
                fontSize: 76,
                fontWeight: 900,
                color: "#B7281E",
                lineHeight: 0.95,
                letterSpacing: "-2px",
                margin: "4px 0",
              }}
            >
              {stamp.year}
            </div>
            {stamp.location && (
              <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#B7281E", letterSpacing: "0.15em" }}>
                {stamp.location}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ZONE 1: Diagonal Newspaper Scrap Backdrop (Y: 260 - 920px) */}
      {newsScrapSrc && frame >= cues.news! && (
        <div
          style={{
            position: "absolute",
            top: 280,
            left: "48%",
            transform: "translateX(-50%) rotate(-6.5deg)",
            zIndex: 8,
            filter: "drop-shadow(6px 12px 14px rgba(24,15,6,0.65))",
          }}
        >
          <img
            src={staticFile(newsScrapSrc)}
            alt=""
            style={{ width: 760, display: "block", filter: "contrast(1.05) sepia(18%)" }}
          />
        </div>
      )}

      {/* ZONE 2: Hero Main Content Cutout (Y: 340 - 1050px) */}
      {frame >= cues.hero! && (
        <div
          style={{
            position: "absolute",
            top: 360,
            left: "50%",
            transform: `translateX(-50%) translate3d(${hJit.x}px, ${hJit.y}px, 0) rotate(${hJit.rot + 2}deg) scale(${interpolate(heroSpr, [0, 1], [1.3, 1])})`,
            zIndex: 15,
            filter: "drop-shadow(0px 8px 18px rgba(20,10,4,0.75))",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 580,
              height: 680,
              outline: "4.5px solid #F4EFE4",
              boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
              backgroundColor: "#F4EFE4",
            }}
          >
            <img
              src={staticFile(heroImageSrc)}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top center",
                filter: "contrast(1.15) sepia(20%) grayscale(25%)",
                display: "block",
              }}
            />

            {/* Cork Pin */}
            <div
              style={{
                position: "absolute",
                top: -12,
                left: "50%",
                transform: "translateX(-50%)",
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "radial-gradient(circle at 35% 35%, #FF3B30 15%, #9E1A1A 85%)",
                boxShadow: "0 3px 6px rgba(0,0,0,0.65)",
                zIndex: 25,
              }}
            />

            {/* Washi Tapes */}
            <img
              src={staticFile("mg-styles/textures/washi/washi_solid_14.png")}
              alt=""
              style={{ position: "absolute", top: -18, left: -28, width: 140, transform: "rotate(-32deg)", opacity: 0.88, zIndex: 22 }}
            />
            <img
              src={staticFile("mg-styles/textures/washi/washi_solid_14.png")}
              alt=""
              style={{ position: "absolute", bottom: -18, right: -24, width: 130, transform: "rotate(38deg)", opacity: 0.88, zIndex: 22 }}
            />

            {heroCaption && (
              <div
                style={{
                  position: "absolute",
                  bottom: 16,
                  left: 20,
                  backgroundColor: "rgba(244, 239, 228, 0.92)",
                  padding: "4px 14px",
                  border: "1.5px solid #2A241C",
                  fontFamily: "monospace",
                  fontSize: 16,
                  fontWeight: 900,
                  color: "#1A1A1A",
                  letterSpacing: "0.15em",
                }}
              >
                {heroCaption}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ZONE 3: Accents (Y: 880 - 1100px) */}
      {accentSrc && frame >= cues.accent! && (
        <div
          style={{
            position: "absolute",
            top: 910,
            left: 48,
            zIndex: 18,
            transform: "rotate(-14deg)",
            filter: "drop-shadow(4px 8px 12px rgba(0,0,0,0.5))",
          }}
        >
          <img src={staticFile(accentSrc)} alt="" style={{ width: 220, outline: "3px solid #F4EFE4", borderRadius: "50%", display: "block" }} />
        </div>
      )}

      {pointerSrc && frame >= cues.pointer! && (
        <div style={{ position: "absolute", top: 1040, right: 30, zIndex: 35, transform: "rotate(16deg)" }}>
          <img src={staticFile(pointerSrc)} alt="" style={{ width: 250, outline: "3.5px solid #F4EFE4", display: "block" }} />
        </div>
      )}

      {/* ZONE 4: Constructivist Headline Plaque (Y: 1100 - 1380px) */}
      {headline && frame >= cues.headline! && (
        <div
          style={{
            position: "absolute",
            top: 1110,
            left: "50%",
            width: 960,
            transform: `translateX(-50%) translate3d(${bJit.x}px, ${bJit.y}px, 0) rotate(-2.8deg) scale(${interpolate(headSpr, [0, 1], [1.4, 1])})`,
            zIndex: 30,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            filter: "drop-shadow(6px 12px 14px rgba(0,0,0,0.75))",
          }}
        >
          <div
            style={{
              background: headline.color ?? "#C0392B",
              border: "4px solid #1A1A1A",
              boxShadow: "8px 8px 0px #1A1A1A",
              padding: "16px 36px",
              width: "100%",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                fontFamily: "Impact, 'Arial Black', sans-serif",
                fontSize: 74,
                fontWeight: 900,
                color: "#F4EFE4",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                textAlign: "center",
                lineHeight: 1.05,
              }}
            >
              {headline.title}
            </div>
          </div>

          {headline.badge && (
            <div
              style={{
                marginTop: -6,
                background: "#1A1A1A",
                color: "#FFDE59",
                fontFamily: "monospace",
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: "0.22em",
                padding: "6px 28px",
                border: "2px solid #F4EFE4",
                boxShadow: "4px 4px 0px rgba(0,0,0,0.5)",
              }}
            >
              ★ {headline.badge} ★
            </div>
          )}
        </div>
      )}

      {/* Extra scene-specific children (Subtitles, etc.) */}
      {children}

      {/* Vignette Rim */}
      <AbsoluteFill style={{ boxShadow: "inset 0 0 140px rgba(16,10,4,0.85)", pointerEvents: "none", zIndex: 40 }} />
    </AbsoluteFill>
  );
};

