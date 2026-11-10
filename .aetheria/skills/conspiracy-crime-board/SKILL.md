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
