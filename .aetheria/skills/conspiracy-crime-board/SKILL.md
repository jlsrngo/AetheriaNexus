---
name: conspiracy-crime-board
description: "Archival retro conspiracy & crime investigation motion system: dynamic virtual camera pans, typewriter text, stencil stamp slams, polaroid drops, red thread SVG connections, and vintage magnifying glass Lissajous scans."
tags:
  - remotion
  - investigation
  - crime-board
  - conspiracy
  - archival
  - documentary
  - kinetic-typography
command: /conspiracy-crime-board
---

# Conspiracy Crime Board — Visual Archetype & Motion Design System

A cinematic archival investigation and classified dossier motion system for Remotion vertical 9:16 (1080×1920) videos, tailored for high-retention storytelling on TikTok, YouTube Shorts, and Instagram Reels.

---

## 🎨 Visual Identity & Color Palette

### 1. Canvas & Permanent Archival Background
* **Base Texture:** Aged parchment / torn grid archive paper overlaid with faded micro-newspaper clippings.
* **Filter Stack:** `blur(2.2px) brightness(0.82) contrast(1.08) sepia(15%)`
* **Lighting Vignette:** Warm gesso spotlight from top-left (`radial-gradient` soft amber glow) blended with heavy corner edge vignette.

### 2. Design Tokens & Color Palette
* **Wall / Workspace Ground:** `#070709` / `#181410` (Dark Umber / Charcoal Noir)
* **Aged Paper & Dossier Cards:** `#F5F0E4` (Vintage Off-White Parchment)
* **Title & Spray Stencil:** `#14110E` / `#F5F0E4` (Heavy Stencil with rough drop-shadow)
* **Investigation Red Marker:** `#DC2626` / `#B91C1C` (Crime Board Red Accent)
* **Hazard / Classified Tape:** `#F59E0B` / `#D97706` (Amber Dossier Badge)
* **Red Connecting Thread:** `#D32F2F` with 3D drop-shadow `0 3px 6px rgba(0,0,0,0.9)`
* **Pushpins:** Radial 3D crimson pin (`radial-gradient(circle at 35% 35%, #ff6b6b, #DC2626, #7f1d1d)`)

### 3. Typography Rules
* **Headline Stencil:** `Anton`, uppercase, heavy tracking (`letter-spacing: 3px - 5px`).
* **Case Notes & Annotations:** `Caveat`, cursive, slight natural rotation (`-2deg` to `2deg`).
* **Metadata & Dossier Codes:** `Courier Prime`, monospace, uppercase (`letter-spacing: 1px - 2px`).

---

## 🎥 Camera Dynamics & Motion Recipes

Never keep the camera static. Every scene must have continuous organic motion to maintain viewer engagement.

### 1. Slow Push-In / Creep (Suspense Builder)
Gradually moves the camera inward throughout the entire sequence.
```tsx
const cameraScale = interpolate(frame, [0, durationInFrames], [1, 1.08], {
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
});
// Apply to root scene container:
transform: `scale(${cameraScale})`
```

### 2. Handheld Parallax Drift (Documentary Realism)
Adds subtle camera breathing to simulate archival handheld camera footage.
```tsx
const driftX = Math.sin(frame * 0.04) * 4;
const driftY = Math.cos(frame * 0.035) * 3;
const driftRotate = Math.sin(frame * 0.03) * 0.4; // +/- 0.4 degree tilt

transform: `translate(${driftX}px, ${driftY}px) rotate(${driftRotate}deg)`
```

### 3. Focus Pan & Re-Center (Card-to-Card Transition)
Smoothly glides the camera focus from one evidence item `[x1, y1]` to another `[x2, y2]`.
```tsx
const panSpr = spring({ frame: Math.max(0, frame - panStartFrame), fps: 30, config: { damping: 14, stiffness: 60 } });
const camX = interpolate(panSpr, [0, 1], [0, targetX - currentX]);
const camY = interpolate(panSpr, [0, 1], [0, targetY - currentY]);
const zoom = interpolate(panSpr, [0, 0.4, 1], [1, 0.95, 1.15]); // slight pull-back before focus snap
```

### 4. Impact Screen Shake (Stamp / Drop Collision)
When a hero card or classified stamp slams onto the board, trigger a micro-shake for 6–8 frames.
```tsx
const shakeFrame = frame - impactFrame;
const shake = shakeFrame >= 0 && shakeFrame < 8
  ? Math.sin(shakeFrame * 2.8) * Math.exp(-shakeFrame * 0.4) * 8
  : 0;

transform: `translateY(${shake}px)`
```

---

## ✍️ Kinetic Typography & Text Variants

### 1. Typewriter Effect (Letter-by-Letter Transcription)
Simulates a vintage military teletype / typewriter with a blinking cursor.
```tsx
const charsPerFrame = 0.8; // typing speed
const charCount = Math.min(fullText.length, Math.floor(frame * charsPerFrame));
const displayedText = fullText.slice(0, charCount);
const showCursor = frame % 16 < 8 && charCount < fullText.length;

<span>
  {displayedText}
  {showCursor && <span style={{ color: "#DC2626", fontWeight: 900 }}>|</span>}
</span>
```

### 2. Classified Stamp Slam (Overshoot Spring)
Stamps "CLASSIFIED", "CONFIDENTIAL", or dates onto paper cards with physics overshoot.
```tsx
const stampSpr = spring({
  frame: Math.max(0, frame - stampStartFrame),
  fps: 30,
  config: { damping: 9, stiffness: 140, mass: 0.6 },
});
const stampScale = interpolate(stampSpr, [0, 0.6, 1], [2.4, 0.9, 1]);
const stampOpacity = interpolate(stampSpr, [0, 0.2, 1], [0, 1, 1]);

<div style={{
  transform: `scale(${stampScale}) rotate(-6deg)`,
  opacity: stampOpacity,
  border: "3px solid #DC2626",
  color: "#DC2626",
  fontFamily: "'Courier Prime', monospace",
  fontWeight: 900,
}}>
  ★ CLASSIFIED DOSSIER ★
</div>
```

### 3. Redaction Bar Reveal (Declassification)
A black marker bar covers secret intelligence words and slides/fades away to reveal the truth.
```tsx
const redactSpr = spring({ frame: Math.max(0, frame - revealStartFrame), fps: 30, config: { damping: 14, stiffness: 90 } });
const redactWidth = interpolate(redactSpr, [0, 1], [100, 0]); // width % shrinks away

<span style={{ position: "relative", display: "inline-block" }}>
  <span>{secretWord}</span>
  <div style={{
    position: "absolute",
    inset: 0,
    width: `${redactWidth}%`,
    backgroundColor: "#181410",
    borderBottom: "2px solid #DC2626",
  }} />
</span>
```

### 4. Word-by-Word Kinetic Subtitles (Speech Synced)
Uses word timestamps from `.words.json` to highlight or pop each word precisely when spoken.
```tsx
const isCurrentWord = currentSec >= word.start && currentSec <= word.end;
const wordSpr = spring({
  frame: Math.max(0, frame - Math.round(word.start * fps)),
  fps,
  config: { damping: 12, stiffness: 120 },
});
const wordScale = isCurrentWord ? interpolate(wordSpr, [0, 1], [1.3, 1.1]) : 1;
const wordColor = isCurrentWord ? "#F59E0B" : "#F5F0E4";
```

---

## 📌 Evidence & Prop Motion Mechanics

### 1. Inward Polaroid Drop (Gravity & Air Drag Settling)
Cards drop onto the corkboard with high damping and slight rotational settling.
```tsx
const cardSpr = spring({
  frame: Math.max(0, frame - card.dropFrame),
  fps: 30,
  config: { damping: 15, stiffness: 85, mass: 0.9 },
});
const translateY = interpolate(cardSpr, [0, 1], [-260, 0]);
const scale = interpolate(cardSpr, [0, 1], [1.35, 1]);
const rotate = interpolate(cardSpr, [0, 0.7, 1], [baseRot - 8, baseRot + 1.5, baseRot]);
```

### 2. Dynamic SVG Red Thread Drawing
Connects two pins with a drawn-out red thread using SVG `strokeDashoffset`.
```tsx
const threadSpr = spring({
  frame: Math.max(0, frame - thread.startFrame),
  fps: 30,
  config: { damping: 16, stiffness: 70 },
});
const threadOffset = interpolate(threadSpr, [0, 1], [pathLength, 0]);

<svg style={{ position: "absolute", inset: 0, zIndex: 60, pointerEvents: "none" }} viewBox="0 0 1080 1920">
  <path
    d={`M ${pin1.x} ${pin1.y} Q ${midX} ${midY + sag} ${pin2.x} ${pin2.y}`}
    stroke="#D32F2F"
    strokeWidth={4.5}
    fill="none"
    strokeDasharray={pathLength}
    strokeDashoffset={threadOffset}
    style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.9))" }}
  />
</svg>
```

### 3. Pushpin Impact
A 3D pushpin strikes the pinboard, pinning the card down right as the card settles.
```tsx
const pinSpr = spring({
  frame: Math.max(0, frame - card.dropFrame - 4),
  fps: 30,
  config: { damping: 10, stiffness: 130, mass: 0.6 },
});
const pinScale = interpolate(pinSpr, [0, 0.6, 1], [1.8, 0.9, 1]);
```

### 4. Vintage Magnifying Glass (Lissajous Detective Scan)
A floating brass/wood magnifying glass (PNG) inspects evidence without visible hands, moving along an organic detective scanning curve.
```tsx
const t = Math.max(0, (frame - startFrame) / fps);
// Smooth organic Lissajous orbital scan across the subject:
const scanX = Math.sin(t * 1.8) * 42 + Math.sin(t * 3.4) * 14;
const scanY = Math.cos(t * 1.4) * 32 + Math.sin(t * 2.8) * 10;
const tilt = Math.sin(t * 1.8) * 9; // Natural tilt

<div style={{
  position: "absolute",
  left: baseX + scanX,
  top: baseY + scanY,
  transform: `rotate(${tilt}deg)`,
  zIndex: 65,
}}>
  <Img src={staticFile("vintage_magnifying_glass.png")} style={{ width: 280, height: 280 }} />
</div>
```

---

## 📐 Layout Archetypes (Mix & Match Per Scene)

Do not repeat the exact same layout in every scene. Choose an archetype suited to the script:

1. **The Investigation Hook (Single Subject Inspection):**
   * Top: Hazard badge (`★ CLASSIFIED ★`) + bold stencil question (`TAHUKAH KAMU?`).
   * Center: Large portrait card with circular face blur (`backdrop-filter: blur(20px)`) + pulsing question mark `?` + floating magnifying glass scan.
   * Bottom: Dossier memo card with date marker and teaser case title.

2. **The Conspiracy Web (Multi-Node Evidence Cluster):**
   * Center: 5 to 7 polaroid cards staggered inward with varying rotations (`-6deg` to `+6deg`).
   * Red threads linking cards dynamically across pushpins.
   * Central Hero Card drops last at frame 60+ on top of all outer cards.
   * Bottom: Case dossier title memo.

3. **The Dossier Archive (Chronology / Document Comparison):**
   * Side-by-side or stacked archival documents (military telegrams, intercepted codes, decrypted messages).
   * Red arrow annotations or redaction reveal bars.
   * Typewriter transcriptions updating below.

4. **The Blueprint / Mechanical Breakdown:**
   * Schematic drawings, gear rotations, or technical exploded view cards.
   * Monospace data gauges and metric counters.

---

## 🔒 Layering & Z-Index Hierarchy Rules

Strictly respect this stacking order to ensure threads and pins never get buried behind cards:
* `z-index: 1`: Permanent archival background paper & spotlight.
* `z-index: 10–29`: Outer secondary polaroids & background documents.
* `z-index: 50`: Main hero center card / featured focal evidence.
* `z-index: 55`: Bottom dossier title card / case summary note.
* `z-index: 60`: **SVG Red Threads** (must always be rendered above cards).
* `z-index: 65`: **Magnifying Glass / Inspection Props**.
* `z-index: 70`: **Pushpins** (must always pierce through the top of cards & threads).
* `z-index: 80`: Top header badges & permanent channel overlays.

---

## 🎙️ Voiceover & Audio Preset Directives

When invoking `voicebox_speak` in the conspiracy-crime-board style:
* **Voice ID:** `"aetheria"` (or `"id-ID-ArdiNeural"` for formal archive documentary).
* **Style:** `"crime_conspiracy"` (mastered with Spotify Pedalboard broadcasting compression and -14 LUFS limiter).
* **CRITICAL TTS RULE:** **DO NOT hyphenate words in `spokenText`** (e.g. NEVER write `"Na-mun di ta-hun"`). Hyphens cause the TTS vocal tract to introduce glottal stops and micro-pauses, causing robotic stuttering. Always pass clean, natural text strings.
