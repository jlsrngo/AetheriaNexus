# Conspiracy Crime Board — Visual Styling & Motion Directives

## 1. Core Visual Archetype
The **conspiracy-crime-board** style embodies vintage police investigation rooms, wartime intelligence dossiers, and declassified Cold War archives.

## 2. Canvas & Aspect Ratio
* **Resolution:** Vertical 9:16 (1080 × 1920).
* **Frame Rate:** 30 FPS.
* **Safe Margins:** 80px horizontal, 120px top, 160px bottom (leaving room for TikTok/Reels UI overlay controls).

## 3. Motion Primitives
* **No CSS Transitions:** Only frame-based mathematical springs (`spring({ frame, fps, config })`) and `interpolate()`.
* **Layer Depth:** Every element has a designated Z-index. Threads (`z-index: 60`) and Pins (`z-index: 70`) must never be placed behind evidence photos.
* **Camera Movement:** Continuous subtle push-in (`scale: 1.0` -> `1.08`) and organic micro-drift.
* **Typography:**
  - Headlines: `Anton` stencil with heavy letter tracking.
  - Case notes: `Caveat` cursive with natural handwriting tilt.
  - Dossier codes: `Courier Prime` monospace.

## 4. Voiceover & Audio Engine Rules
* Preset: `voice: "aetheria"`, `style: "crime_conspiracy"`.
* Always supply clean, natural sentences. Never split words with hyphens in `spokenText`.
