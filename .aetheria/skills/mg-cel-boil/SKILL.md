---
name: mg-cel-boil
description: "Hand-Drawn Cel Animation Boil motion design archetype from mg-styles-15. Award-shortlist commercial motion graphics standard for Remotion."
tags:
  - motion-graphics
  - mg-styles-15
  - remotion
  - visual-archetype
command: /mg-cel-boil
---

# Cel Animation / Frame-by-Frame & Line Boil (Motion Graphics Standard)
*Ported from award-winning mg-styles-15 motion system.*

# Cel Animation / Frame-by-Frame & Line Boil Motion Design

**Reference Benchmark**: Artisan: Hand Made Line Boil · 1920×1080 · 24 fps · 10 s · AI Jury Score 8.07 / 10

**Reference Source**: [`references/mg-styles-15/demos/05-cel-boil/`](../../references/mg-styles-15/demos/05-cel-boil/)

## How to Use

1. Open Aetheria Video Studio and invoke this skill using the command or natural language.
2. The skill injects the creative seed, timing choreography, palette tokens, and motion curves into the LLM context.
3. **Customization**: Adapt the narrative, brand names, copy, and palette in `Creative seed` while preserving `Signature features` to retain the iconic visual identity of this archetype.
4. **Verification**: Review the resulting Remotion composition in the interactive Studio player against the motion design craft checklist below to guarantee award-winning quality.

## System Prompt Template

```text
You are the director, motion designer, engineer and sound designer of ONE 10-second motion-design film.
The goal is the most classic, yet most stunning form of this style — award-shortlist / high-end commercial quality. A clean,
template-looking result is a fail. Benchmarks: Buck, ManvsMachine, Ordinary Folk, Giant Ant, Territory Studio, Apple keynote
motion, Pentagram motion identities, top Behance/Motionographer features, top designer accounts (Motionographer, Behance, Vimeo Staff Picks).

# Style
Cel Animation / Frame-by-Frame & Line Boil

# Output (fixed)
- 1920×1080, 24 fps, exactly 10.000 s (240 frames), H.264 MP4 with stereo AAC audio (48 kHz), mastered to −14 LUFS
  integrated, true peak ≤ −1 dBTP. Final file: video.mp4.

# Suggested technical route
HTML Canvas2D: custom variable-width brush renderer (centreline + pressure → outline polygon), boil = 3–4 jitter variants cycled every 2 frames; paper texture multiply
(You may choose a better route if it clearly raises quality; say why.)

# Creative seed
Hand-Made Frame-by-Frame Magic — Hand-made frame-by-frame magic, Buck/Giant-Ant hybrid (clean shapes + hand-drawn cel FX), animated on 2s at 24 fps.
- Warm paper ground; ink linework that BOILS (lines redrawn with slight variation every 2 frames); fills slightly off-register like hand colouring.
- Story: a matchstick strikes (SMEAR frame, on 1s for the fast action) → a flame spirit character jumps out, anticipation + squash, dances (on 2s) → it bursts into cel FX: smoke puffs curling, sparks, star bursts, speed lines → the FX re-form into hand-lettered title (e.g. "HAND MADE" or Artisan Hand-Made) that keeps boiling on a 1s hold (on 3s for the hold).
- Palette 3–4 colours: ink black, tomato red, sunny yellow, cream paper; paper grain multiply 10–15%.
Sound: playful jazzy pizzicato/xylophone bed + cartoon SFX: strike, fwoosh, pop, poof, sparkle — synced to the frame.

You are the director: you may change the concept, copy, story beats and brand names if you find a stronger idea, but the result must remain the CANONICAL, instantly-recognisable form of this style and must hit its signature features below.

# Signature features and key techniques (the result is judged against these)
The warmth and vibrancy of traditional hand-drawn animation. Uses looping stepped line boil (2–3 alternating hand-drawn path frames) so static objects feel alive and energetic.

**Visual Features**: Hand-drawn jitter, paper/canvas tooth texture, rough brush strokes, 12fps or 8fps stepped motion, organic character morphs, ink bleed outlines.

**Key Techniques**:
- Line boil quantization: Modulate coordinates or SVG paths every 2 to 3 frames (`Math.floor(frame / 2) % 3`).
- Stepped frame rate: Render the project at 30fps but quantize element movement to 12fps for authentic stop-motion feel.
- Fluid hand-drawn arcs: Morphing shapes follow exaggerated curved paths with dramatic anticipation.
- Transitions: Ink splash wipes, sketchy speedline cuts, and paper flips.

# How to work
1. Treatment. Write down one clear idea: a hook in the first 0.5 s (never open on more than 0.3 s of empty or black), an
   escalation, one unmistakable hero moment at ~60–75 % of the runtime, and a composed end frame held ~0.8–1.2 s with living
   micro-motion. Map every signature feature above to a moment. Keep one cue sheet (beats and hit times) that both the
   picture and the sound read from.
2. Key frames before motion. Build the look, render stills at 6–10 key times and actually look at them. Each still should be
   poster-worthy: composition, hierarchy, negative space, type set properly (kerning, line-height, weight contrast, CJK
   punctuation, ~5 % safe margins). Iterate until nothing looks default, generic, cramped or "AI-template".
3. Motion. Build the choreography and preview at low resolution. Step through the fastest moves frame by frame: spacing,
   easing, arcs, overlap, anticipation and follow-through, motion blur. No unintended dead spans; the energy follows the music.
4. Sound. Write genre-correct music and sound design locked to the cue sheet. Check that visual hits land on audio onsets.
   Master to the output spec.
5. Final. Render at full resolution (motion blur where apt), then check: exactly 10.00 s, resolution, fps, audio present and at
   the right loudness, no black frames, no fallback fonts or tofu, no clipped elements at the frame edges, no shimmer on thin
   lines, no gradient banding. Fix and repeat until you would submit it to a festival.
6. Write an honest self-critique: what is strongest, what is weakest, what you would do with more time.

# Rules
- Rendering must be deterministic: every frame is a pure function of time t. Seeded randomness only; physics and particles
  precomputed or closed-form; no real-time clocks; no state-triggered CSS transitions. A reliable route: a web page that can
  draw any time t on request, captured frame by frame with a headless browser and encoded with ffmpeg (or a Blender script
  that renders a PNG sequence).
- Assets: only CC0 / public domain / OFL / Apache / free-for-commercial-use. Record each source and licence in CREDITS.md.
  No real brand trademarks; invent brand names.
- On-screen text must be correct, punchy, and natural: proper typography, zero overflow, no typos.

# Craft checklist (what a jury looks for)
- Style authenticity: an expert names the style in one second; every signature technique is present and executed correctly.
- Motion craft: purposeful easing (no linear unless mechanical by design), overlap and stagger, anticipation and
  follow-through, arcs, squash and stretch where the style allows, consistent physics, motion blur where apt; transitions
  carried by elements, not crossfades.
- Rhythm: hits locked to the music; contrast between busy and calm; no monotony.
- Design: strong composition, grid, typographic hierarchy, controlled palette; texture and finishing (grain, glow, vignette)
  only where the style wants it; nothing looks accidental.
- Technical polish: no jitter (unless intended), no popping, no aliasing, no banding, no fallback fonts, no half-loaded images.
- Sound: genre-correct, musical, synced, mastered.

# Before you deliver, score yourself honestly
1–10 on style fidelity, concept wow, motion craft, design & typography, finish & texture, sound & sync, technical
(6 = template-level, 8 = high-end agency, 9 = award shortlist). Aim for 9; fix whatever scores lowest first.

# Deliver
video.mp4, plus a short report: the concept in two sentences; a beat sheet with timecodes; how each signature feature is
realised; the tech route; check numbers (duration, resolution, fps, loudness, true peak); your honest top-3 weaknesses.
```
