import React from "react";
import { ResolvedScene, ThemePalette } from "../types";
import {
  Beat,
  HighlightedHeadline,
  easeOutBack,
  easeOutExpo,
  progress,
} from "../motion";

export const HeadlineLayout: React.FC<{
  scene: ResolvedScene;
  t: number;
  palette: ThemePalette;
}> = ({ scene, t, palette }) => {
  const isDark = Boolean(scene.dark);
  const textColor = isDark ? palette.textDark : palette.textLight;

  const badgeBeat = scene.beats.find((b) => b.type === "badge");
  const mainBeats = scene.beats.filter((b) => b.type !== "badge");

  const pop = easeOutBack(progress(t, 0.0, 0.7));
  const spinDeg = t * 28;
  const lockDrop = easeOutExpo(progress(t, 0.25, 0.8));
  const ringScale = 0.65 + easeOutExpo(progress(t, 0.0, 3.2)) * 0.55;
  const variant = scene.index % 3;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "56px 24px",
        gap: 18,
        position: "relative",
      }}
    >
      {/* Expanding Ambient Rings for Light Scenes */}
      {!isDark && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            transform: `scale(${ringScale.toFixed(3)})`,
            opacity: 0.45,
          }}
        >
          <div
            style={{
              width: 380,
              height: 380,
              borderRadius: "50%",
              border: `1.5px solid ${palette.accent}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 260,
                height: 260,
                borderRadius: "50%",
                border: `1px dashed ${palette.accent}`,
              }}
            />
          </div>
        </div>
      )}

      {/* Animated SVG Hero Illustration (3 Kinetic Variants) */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          transform: `scale(${(0.78 + pop * 0.22).toFixed(3)})`,
        }}
      >
        {variant === 0 ? (
          /* Variant 0: Spinning Mechanical Gear Emblem */
          <svg
            width="188"
            height="188"
            viewBox="0 0 220 220"
            style={{
              filter: "drop-shadow(0 16px 28px rgba(0,0,0,0.25))",
              transform: `rotate(${spinDeg.toFixed(1)}deg)`,
            }}
          >
            <g transform="translate(110, 110)">
              <circle r="68" fill="#18181B" stroke={palette.accent} strokeWidth="3" />
              <g fill="#18181B">
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(
                  (deg) => (
                    <rect
                      key={deg}
                      x="-10"
                      y="-86"
                      width="20"
                      height="22"
                      rx="3"
                      transform={`rotate(${deg})`}
                    />
                  )
                )}
              </g>
              <circle
                r="46"
                fill={isDark ? "#0A0A0A" : "#F4F1EA"}
                stroke="#27272A"
                strokeWidth="4"
              />
              <circle cx="0" cy="0" r="18" fill={palette.accent} />
            </g>
          </svg>
        ) : variant === 1 ? (
          /* Variant 1: Animated Security Lock Shackle + Status Badge */
          <svg
            width="210"
            height="175"
            viewBox="0 0 260 210"
            style={{ filter: "drop-shadow(0 18px 28px rgba(0,0,0,0.22))" }}
          >
            <path
              d="M85 85 L85 48 C85 22, 175 22, 175 48 L175 85"
              stroke={isDark ? "#E4E4E7" : "#27272A"}
              strokeWidth="14"
              fill="none"
              strokeLinecap="round"
              style={{
                transform: `translateY(${((1 - lockDrop) * -22).toFixed(1)}px)`,
              }}
            />
            <rect
              x="45"
              y="78"
              width="170"
              height="112"
              rx="16"
              fill="#18181B"
              stroke={palette.accent}
              strokeWidth="2.5"
            />
            <rect
              x="62"
              y="95"
              width="136"
              height="34"
              rx="6"
              fill="#09090B"
              stroke="#10B981"
              strokeWidth="2"
            />
            <text
              x="130"
              y="117"
              textAnchor="middle"
              fill="#10B981"
              fontFamily="monospace"
              fontWeight="800"
              fontSize="14"
            >
              {scene.statValue || "VERIFIED"}
            </text>
            <rect
              x="62"
              y="140"
              width="136"
              height="30"
              rx="6"
              fill={palette.accent}
            />
            <text
              x="130"
              y="160"
              textAnchor="middle"
              fill="#FFFFFF"
              fontFamily="monospace"
              fontWeight="800"
              fontSize="11"
            >
              {scene.statLabel || scene.tag || "CORE ENGINE"}
            </text>
          </svg>
        ) : (
          /* Variant 2: Glowing Telemetry Counter Orb */
          <div
            style={{
              width: 184,
              height: 184,
              borderRadius: "50%",
              backgroundColor: "#141417",
              border: `2px solid ${palette.accent}`,
              boxShadow: `0 0 55px ${palette.accentGlow}, inset 0 0 28px rgba(0,0,0,0.8)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontFamily: "monospace",
                color: "#A1A1AA",
                letterSpacing: "0.14em",
                marginBottom: 6,
              }}
            >
              {scene.tag || `STAGE 0${scene.index}`}
            </span>
            <div
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                backgroundColor: "#050507",
                border: "1px solid #27272A",
                fontFamily: "monospace",
                fontSize: 28,
                fontWeight: 900,
                color: palette.accent,
                boxShadow: `0 0 18px ${palette.accentGlow}`,
              }}
            >
              {scene.statValue || `#0${scene.index}`}
            </div>
            {scene.statLabel && (
              <span
                style={{
                  marginTop: 8,
                  fontSize: 9,
                  fontFamily: "monospace",
                  fontWeight: 800,
                  color: "#FCA5A5",
                  backgroundColor: "rgba(239,68,68,0.18)",
                  padding: "2px 8px",
                  borderRadius: 4,
                }}
              >
                {scene.statLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {badgeBeat && (
        <Beat
          t={t}
          startSec={badgeBeat.startSec}
          endSec={badgeBeat.endSec}
          style={{
            backgroundColor: palette.accent,
            color: "#FFFFFF",
            fontFamily: "monospace",
            fontSize: 10,
            fontWeight: 800,
            padding: "4px 12px",
            borderRadius: 999,
            letterSpacing: "0.1em",
            zIndex: 10,
          }}
        >
          {badgeBeat.text}
        </Beat>
      )}

      {/* Kinetic Word-by-Word Headlines */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          width: "100%",
          zIndex: 10,
        }}
      >
        {mainBeats.map((b) => (
          <Beat
            key={b.id}
            t={t}
            startSec={b.startSec}
            endSec={b.endSec}
            style={{ width: "100%" }}
          >
            <HighlightedHeadline
              t={t}
              startSec={b.startSec}
              text={b.text}
              accent={b.accent || (b.type === "punch" ? b.text : undefined)}
              accentColor={palette.accent}
              textColor={textColor}
              fontSize={b.type === "punch" ? 34 : 30}
            />
          </Beat>
        ))}
      </div>
    </div>
  );
};
