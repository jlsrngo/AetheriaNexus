---
name: conspiracy-crime-board
description: "Cinematic retro collage & viral investigative documentary motion system: Hormozi-style punchy kinetic captions, mg-styles-15 paper slap physics, 12fps/6fps stop-motion boil jitter, camera snap zooms, scissor cutout white rims, red thread crime board, and atmospheric overlays."
tags:
  - remotion
  - investigation
  - crime-board
  - collage
  - stop-motion
  - hormozi-captions
  - documentary
  - kinetic-typography
command: /conspiracy-crime-board
---

# Conspiracy Crime Board — Visual Archetype & Motion Design System (v3)
*Synthesized from Award-Winning Motion Graphics (mg-styles-15 Collage / Cutout) & Viral Retention Editing (Alex Hormozi Style).*

A high-retention cinematic archival investigation and classified dossier motion system for Remotion vertical 9:16 (1080×1920) videos, tailored for TikTok, YouTube Shorts, and Instagram Reels.

---

## 🛑 Quality Invariants & Anti-Patterns (MUST ENFORCE)

1. **NO Static Element Freezing (Rule of Continuous Motion & Boil):**
   * **FORBIDDEN:** Dropping cards and subtitles at frame 5 and leaving the screen completely frozen while narration talks for 15 seconds.
   * **REQUIRED:**
     - **Stepped Stop-Motion Boil (`boilJitter`):** Every paper card, photo, and badge must possess subtle micro-jitter (12fps when moving, 6fps when holding, `±1.2px` amplitude). Elements feel physically alive like real stop-motion cutouts!
     - **Continuous Handheld Drift (`cameraSnapZoom`):** Subtle organic camera drift (`Math.sin/cos`) keeps the frame breathing throughout the entire scene.

2. **Hormozi-Style Kinetic Captions (Viral Word-by-Word Pops):**
   * **FORBIDDEN:** Rendering an entire sentence/paragraph in a single static block. It overflows on mobile screens and causes high viewer drop-off.
   * **REQUIRED:** Use `<HormoziSubtitle words={TURING_WORDS.sX} />`:
     - Sliding window of at most **3 to 4 words** at a time.
     - Active spoken word springs with a high-energy pop (`scale: 1.18 -> 1.0`) and high-contrast lemon yellow `#FFDE59` or electric green `#22C55E`.
     - Inactive words remain crisp `#FFFFFF` with dark backing pill for 100% readability over dynamic backgrounds.

3. **Slap Impact Physics (`slapPhysics`):**
   * **FORBIDDEN:** Weak linear fade-ins or generic sliding cards.
   * **REQUIRED:** Evidence cards drop from "camera height" onto the board:
     - Pre-drop: Scale `1.35x` with wide diffuse shadow.
     - Impact frame: Squash impact `scale: 0.965`, shadow abruptly collapses to tight `6px`.
     - Frame +1 to +2: Elastic rebound `scale: 1.018` before settling.
     - Physical accents: Scissor cutout white rim (`3.5px solid #F4EFE4`), red push pins, or translucent washi tape strips (`<CollagePiece />`).

4. **Multi-Beat Phased Escalation (Pacing Formula):**
   * **Hook within 0.5s:** Never open with empty space for > 0.3s. Beat 1 slams immediately!
   * **Beat 1 (0–2.5s):** Stencil hook punch / primary evidence card slaps onto board.
   * **Beat 2 (2.5–5.5s):** Supporting archival document drops + red yarn connects (`<RedThread />`).
   * **Beat 3 (5.5–8.5s):** Stamped verdict slams (`CONFIDENTIAL`, `GUILTY`, `DECLASSIFIED`) + camera snap-zoom punch.
   * **Beat 4 (8.5s–end):** Living hold with continuous drift + scene cut transition (`<SceneTransition />`).

5. **Asset Diversity & Atmospheric Overlays:**
   * Every scene MUST feature distinct historical evidence:
     - S1 (Hook): Enigma machine + TOP SECRET GC&CS header.
     - S2 (Who is He): Alan Turing portrait + Bletchley mathematical notes.
     - S3 (Invisible Enemy): Naval battle map + U-boat card + `<CipherStreamOverlay />`.
     - S4 (Secret Weapon): Bombe machine + `<BombeGearsOverlay />` (spinning mechanical gears).
     - S5 (Dark Irony): 1952 Crown Court trial document + GUILTY stamp + redaction bars.
     - S6 (Tragic End): Memorial statue + `<RainWindowOverlay />` + progressive fade-to-black.
     - S7 (Final Message): Supercomputer + `<ModernAiMatrixOverlay />` + ROYAL PARDON stamp + audience debate question.

---

## 🛠️ Motion Primitives & Pre-Built Components

The engine workspace provides these tested primitives:

### 1. `CollagePiece` (Physical Evidence Card with Slap Physics & Scissor Rim)
```tsx
import { CollagePiece } from "../components/CollagePiece";

<CollagePiece
  id={1}
  src="img_enigma.jpg"
  top={340}
  left={100}
  width={880}
  height={580}
  rotation={-2}
  dropFrame={25}
  hasPin={true}
  pinColor="red"
  stampText="★ BUKTI UTAMA ★"
  stampFrame={40}
/>
```

### 2. `HormoziSubtitle` (Viral 3-Word Kinetic Captioning)
```tsx
import { HormoziSubtitle } from "../components/HormoziSubtitle";
import { TURING_WORDS } from "../types";

<HormoziSubtitle words={TURING_WORDS.s1} top={1380} highlightColor="#FFDE59" />
```

### 3. `cameraSnapZoom` (Dynamic Camera Punch on Narrative Hits)
```tsx
import { cameraSnapZoom } from "../motion/collageMotion";

const cam = cameraSnapZoom(frame, [0, 60, 140], 1.0);

<div style={{
  transform: `translate3d(${cam.panX}px, ${cam.panY}px, 0) scale(${cam.scale})`,
  transformOrigin: "center center"
}}>
  {/* Scene content */}
</div>
```

### 4. `SceneTransition` (Cut Flash & Atmospheric Fade)
```tsx
import { SceneTransition } from "../components/SceneTransition";

<SceneTransition type="flash" />
<SceneTransition type="fade-black" durationInFrames={meta.durationInFrames} />
```

---

## 🎨 Color Palette & Typography Tokens

* **Noir Canvas:** `#0A0806` / `#14110E`
* **Scissor Cutout Rim:** `#F4EFE4`
* **Viral Subtitle Highlight:** `#FFDE59` (Lemon Yellow) or `#22C55E` (Electric Green)
* **Investigation Red:** `#DC2626` / `#E11D48`
* **Crime Board Thread:** `#EF4444` (Curved Bezier SVG)
* **Typography:**
  - Headlines & Stamps: `'Special Elite'`, `'Impact'`, monospace.
  - Subtitles: `'Inter'`, `'Anton'`, bold sans-serif with 1.5px stroke.


## Mandatory Remotion Animation Rules
- **Defensive Animation Props**: Always provide safe fallbacks: const duration = propDuration ?? useVideoConfig()?.durationInFrames ?? 300;.
- **Asset Verification**: Do not reference image files that do not exist on disk.
- **No Blinding Flash at Frame 0**: Keep frame 0 visible (if (frame <= 0) return null;).


# Output Formats
- **Standard Landscape**: 1920×1080, 30 fps.
- **Short-Form Mobile (TikTok / Reels / Shorts)**: 1080×1920, 30 fps.

# Vertical 9:16 Spatial Layout Contract (1080×1920 Mobile Standard)
When generating vertical 9:16 content, LLM MUST strictly adhere to this vertical spatial zoning to avoid empty voids, clashing elements, or UI clipping:

| Zone ID | Vertical Span (Y) | Component Type | Constraints & Styling |
| :--- | :--- | :--- | :--- |
| **Zone 0** | `Y: 60 – 240px` | Top Header Bar & Stamp/Badge | Monospace topic bar across top (`Y: 70`). Stamps/tags MUST be anchored to top-left (`left: 64`) or top-right (`right: 64`) with 8–14° tilt. **NEVER slap large text in center X:50% that occludes the hero below!** |
| **Zone 1** | `Y: 260 – 920px` | Backdrop Graphic Bed / Sheet | Angled style-specific backdrop, grid card, or paper scrap (`width: 720–820px`, tilted -8° to +8°). Serves as visual backing so the hero never floats in an empty void. |
| **Zone 2** | `Y: 340 – 1050px` | Hero Subject / Core Visual Anchor | Primary focal point. `width: 520–620px`, `height: 600–720px`, centered. Wajib style-specific rim/border/glow and subtle micro-motion/jitter. |
| **Zone 3** | `Y: 880 – 1100px` | Style Accents & Connectors | Style-specific accent props (pointing hands, stickers, sparks, geometric chips) bridging transition between hero and headline. |
| **Zone 4** | `Y: 1100 – 1380px` | Bold Style Action Headline | High-contrast headline card/plaque with `box-shadow: 8px 8px 0 #1A1A1A`, uppercase bold typography (`fontSize: 64–76px`), and sub-badge (`fontSize: 20–24px`). |
| **Zone 5** | `Y: 1500 – 1720px` | Kinetic Subtitles (Hormozi) | Clean word chips anchored at `bottom: 200–240px`. Maximum font size 58–64px with lemon-yellow `#FFDE59` active pop. |
| **Deadzone**| `Y > 1750px` & `X > 960px` | TikTok UI Exclusion Zone | NEVER place critical text or heroes in the bottom 180px or extreme right rail (avatar, like, comment, share, sound disc). |