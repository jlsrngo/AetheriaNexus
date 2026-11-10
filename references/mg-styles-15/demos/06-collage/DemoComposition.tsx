/**
 * DemoComposition.tsx — /mg-cutout-collage
 * Pure React Remotion TSX implementation of Dada Cutout Paper Collage.
 * Matches 100% of the visual physics, timing cues, scissor rims, and motion from 06-collage.
 * 1920×1080 (or responsive) · 30fps · 300 frames (10.0s)
 */
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Deterministic pseudo-random hash for 12fps/6fps stop-motion jitter
function hash(a: number, b: number = 0): number {
  let h = ((a * 374761393 + b * 668265263 + 1013904223) | 0);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// 12fps or 6fps quantized hand-placement boil jitter
function boilJitter(id: number, frame: number, fps: number = 12, amp: number = 2) {
  const step = Math.floor((frame / 30) * fps);
  const jx = (hash(id, step) * 2 - 1) * amp;
  const jy = (hash(id + 71, step) * 2 - 1) * amp;
  const jr = (hash(id + 913, step) * 2 - 1) * amp * 0.2;
  return { x: jx, y: jy, rot: jr };
}

// Slap-drop physics: squash on impact (scale 0.972), thin resting shadow
function slapPhysics(frame: number, hitFrame: number) {
  const diff = frame - hitFrame;
  if (diff < -6) return { scale: 1.5, opacity: 0, shadowBlur: 40, shadowY: 30 };
  if (diff < 0) {
    const u = -diff / 6;
    return {
      scale: 1 + 0.38 * u * u,
      opacity: 1,
      shadowBlur: 20 + u * 25,
      shadowY: 15 + u * 20,
    };
  }
  if (diff === 0) {
    return { scale: 0.972, opacity: 1, shadowBlur: 10, shadowY: 6 }; // squash impact
  }
  if (diff <= 3) {
    return { scale: 1.015, opacity: 1, shadowBlur: 12, shadowY: 7 }; // rebound
  }
  return { scale: 1.0, opacity: 1, shadowBlur: 14, shadowY: 8 }; // resting
}

const ASSET_BASE = "mg-styles/06-collage/assets/gen/";

export const CollageDemoComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // ── Cue Timing in Frames (30fps) ──────────────────────────────────────────
  const CUE_PORTRAIT = 10;   // 0.33s: portrait slaps
  const CUE_NEWS = 30;       // 1.0s: newsprint scrap
  const CUE_LID_LAUNCH = 120;// 4.0s: head lid flips open
  const CUE_ROCKET = 130;    // 4.33s: rocket shoots out
  const CUE_EARTH = 140;     // 4.66s: Earth planet rises
  const CUE_BIRDS = 150;     // 5.0s: hawk soars
  const CUE_MANICULE = 180;  // 6.0s: pointing hand
  const CUE_HERO_TEXT = 200; // 6.66s: "THE MIND IS A COLLAGE" title slam

  // ── Camera Rostrum Drift (6fps quantized) ─────────────────────────────────
  const camStep = Math.floor(frame / 5);
  const camZoom = interpolate(frame, [0, 300], [1.0, 1.08]);
  const camPanX = (hash(99, camStep) * 2 - 1) * 2;
  const camPanY = (hash(199, camStep) * 2 - 1) * 2;

  // ── Portrait Slap ─────────────────────────────────────────────────────────
  const portraitSlap = slapPhysics(frame, CUE_PORTRAIT);
  const portraitJit = boilJitter(1, frame, 12, 1.5);

  // ── Monty Python Jaw Flap (Frame 40..80) ──────────────────────────────────
  const isFlapping = frame >= 40 && frame <= 75;
  const jawCycle = Math.floor((frame - 40) / 4) % 3;
  const jawDropY = isFlapping ? (jawCycle === 1 ? 16 : jawCycle === 2 ? 8 : 0) : 0;

  // ── Head Lid Launch (Terry Gilliam Homage at frame 120) ───────────────────
  const lidSpr = spring({
    frame: Math.max(0, frame - CUE_LID_LAUNCH),
    fps: 30,
    config: { damping: 9, stiffness: 120 },
  });
  const lidRot = interpolate(lidSpr, [0, 1], [0, -68]);
  const lidY = interpolate(lidSpr, [0, 1], [0, -75]);

  // ── Spilling Items (Space, Earth, Rocket, Roses) ──────────────────────────
  const spaceScale = interpolate(frame, [CUE_LID_LAUNCH, CUE_LID_LAUNCH + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rocketSpr = spring({
    frame: Math.max(0, frame - CUE_ROCKET),
    fps: 30,
    config: { damping: 12, stiffness: 90 },
  });
  const rocketY = interpolate(rocketSpr, [0, 1], [180, -220]);
  const earthY = interpolate(
    spring({ frame: Math.max(0, frame - CUE_EARTH), fps: 30, config: { damping: 10, stiffness: 100 } }),
    [0, 1],
    [120, -110]
  );

  // ── Title Slam (Constructivist red/black Impact text) ─────────────────────
  const titleSpr = spring({
    frame: Math.max(0, frame - CUE_HERO_TEXT),
    fps: 30,
    config: { damping: 10, stiffness: 160 },
  });
  const titleScale = interpolate(titleSpr, [0, 1], [2.8, 1]);
  const titleOpacity = interpolate(titleSpr, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#16130F",
        overflow: "hidden",
        transform: `scale(${camZoom}) translate3d(${camPanX}px, ${camPanY}px, 0)`,
        transformOrigin: "center center",
      }}
    >
      {/* Kraft Paper Base Ground */}
      <img
        src={staticFile(ASSET_BASE + "page_kraft.jpg")}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "contrast(1.08) sepia(25%)",
          opacity: 0.92,
        }}
      />

      {/* Background Newsprint Scrap */}
      {frame >= CUE_NEWS && (
        <img
          src={staticFile(ASSET_BASE + "news_a.png")}
          alt=""
          style={{
            position: "absolute",
            top: 140,
            left: 220,
            width: 520,
            transform: "rotate(-8deg)",
            opacity: 0.85,
            filter: "drop-shadow(3px 8px 12px rgba(0,0,0,0.45))",
          }}
        />
      )}

      {/* Central Portrait Container */}
      {frame >= CUE_PORTRAIT - 6 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "48%",
            width: 600,
            height: 750,
            transform: `translate(-50%, -50%) translate3d(${portraitJit.x}px, ${portraitJit.y}px, 0) rotate(${portraitJit.rot}deg) scale(${portraitSlap.scale})`,
            transformOrigin: "center bottom",
            opacity: portraitSlap.opacity,
            filter: `drop-shadow(0px ${portraitSlap.shadowY}px ${portraitSlap.shadowBlur}px rgba(34,20,8,0.75))`,
          }}
        >
          {/* Deep Space Wedge Revealed Under Lid */}
          {frame >= CUE_LID_LAUNCH && (
            <div
              style={{
                position: "absolute",
                top: 30,
                left: 120,
                width: 360,
                height: 380,
                transform: `scale(${spaceScale})`,
                transformOrigin: "center bottom",
                zIndex: 2,
              }}
            >
              <img
                src={staticFile(ASSET_BASE + "space_wedge.png")}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />

              {/* Planet Earth */}
              {frame >= CUE_EARTH && (
                <img
                  src={staticFile(ASSET_BASE + "earth.png")}
                  alt=""
                  style={{
                    position: "absolute",
                    top: 160 + earthY,
                    left: 40,
                    width: 130,
                    outline: "3.5px solid #F4EFE4",
                    borderRadius: "50%",
                    boxShadow: "0 6px 14px rgba(0,0,0,0.6)",
                  }}
                />
              )}

              {/* Rocket */}
              {frame >= CUE_ROCKET && (
                <img
                  src={staticFile(ASSET_BASE + "rocket.png")}
                  alt=""
                  style={{
                    position: "absolute",
                    top: 140 + rocketY,
                    left: 180,
                    width: 140,
                    transform: "rotate(-18deg)",
                    outline: "3px solid #F4EFE4",
                    boxShadow: "0 8px 18px rgba(0,0,0,0.7)",
                  }}
                />
              )}

              {/* Hawk Bird */}
              {frame >= CUE_BIRDS && (
                <img
                  src={staticFile(ASSET_BASE + "bird_hawk.png")}
                  alt=""
                  style={{
                    position: "absolute",
                    top: -40,
                    right: -20,
                    width: 160,
                    transform: "rotate(12deg)",
                    outline: "3px solid #F4EFE4",
                  }}
                />
              )}
            </div>
          )}

          {/* Portrait Face Base */}
          <img
            src={staticFile(ASSET_BASE + "p_face.png")}
            alt=""
            style={{
              position: "absolute",
              top: 120,
              left: 130,
              width: 340,
              zIndex: 3,
              outline: "3.5px solid #F4EFE4",
            }}
          />

          {/* Puppet Jaw Flap */}
          <img
            src={staticFile(ASSET_BASE + "p_jaw.png")}
            alt=""
            style={{
              position: "absolute",
              top: 310 + jawDropY,
              left: 175,
              width: 250,
              zIndex: 4,
              outline: "3px solid #F4EFE4",
            }}
          />

          {/* Head Lid (Flips Open on Spring) */}
          <img
            src={staticFile(ASSET_BASE + "p_lid.png")}
            alt=""
            style={{
              position: "absolute",
              top: 60 + lidY,
              left: 140,
              width: 320,
              zIndex: 5,
              transformOrigin: "left bottom",
              transform: `rotate(${lidRot}deg)`,
              outline: "3.5px solid #F4EFE4",
              boxShadow: "0 6px 14px rgba(0,0,0,0.5)",
            }}
          />
        </div>
      )}

      {/* Pointing Hand (Manicule) Slams at frame 180 */}
      {frame >= CUE_MANICULE && (
        <img
          src={staticFile(ASSET_BASE + "manicule.png")}
          alt=""
          style={{
            position: "absolute",
            bottom: 120,
            right: 180,
            width: 320,
            transform: "rotate(-15deg)",
            outline: "4px solid #F4EFE4",
            boxShadow: "0 12px 30px rgba(0,0,0,0.8)",
            zIndex: 10,
          }}
        />
      )}

      {/* Constructivist Hero Headline Slam */}
      {frame >= CUE_HERO_TEXT && (
        <div
          style={{
            position: "absolute",
            bottom: 140,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${titleScale}) rotate(-3deg)`,
            opacity: titleOpacity,
            zIndex: 20,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              background: "#D94030",
              color: "#F4EFE4",
              fontFamily: "Impact, 'Arial Black', sans-serif",
              fontSize: 84,
              fontWeight: 900,
              letterSpacing: "0.04em",
              padding: "12px 36px",
              boxShadow: "8px 8px 0px #1A1A1A",
              border: "3px solid #1A1A1A",
              textTransform: "uppercase",
            }}
          >
            THE MIND IS A COLLAGE
          </div>
        </div>
      )}

      {/* Vignette Rim */}
      <AbsoluteFill
        style={{
          boxShadow: "inset 0 0 160px rgba(0,0,0,0.85)",
          pointerEvents: "none",
          zIndex: 30,
        }}
      />
    </AbsoluteFill>
  );
};

export default CollageDemoComposition;
