---
name: mg-shape-morph
description: "Seamless Shape Morph motion design archetype from mg-styles-15. Award-shortlist commercial motion graphics standard for Remotion."
tags:
  - motion-graphics
  - mg-styles-15
  - remotion
  - visual-archetype
command: /mg-shape-morph
---

# Geometric Shape Morphing / Organic Transformation (Motion Graphics Standard)
*Ported from award-winning mg-styles-15 motion system.*

# Geometric Shape Morphing Motion Design

**Reference Benchmark**: One Shape, Every Story Morph · 1920×1080 · 30 fps · 10 s · AI Jury Score 7.64 / 10

**Reference Source**: [index.html](../../../references/mg-styles-15/demos/08-morph/index.html) · [cues.json](../../../references/mg-styles-15/demos/08-morph/cues.json)

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
Geometric Shape Morphing / Organic Transformation

# Output (fixed)
- 1920×1080, 30 fps, exactly 10.000 s (300 frames), H.264 MP4 with stereo AAC audio (48 kHz), mastered to −14 LUFS
  integrated, true peak ≤ −1 dBTP. Final file: video.mp4.

# Suggested technical route
HTML: SVG + flubber or GSAP MorphSVGPlugin (tune shapeIndex), color-field wipes
(You may choose a better route if it clearly raises quality; say why.)

# Creative seed
Everything is Connected — Apple-keynote-grade morph chain: Apple-keynote-grade morph chain: one hero shape continuously becomes 6–8 meaningful icons, on the beat.
- Chain example: coffee cup → (circle) → sun → sunset over sea → gull → paper plane → location pin → heart → invented brand logo "morphe" with wordmark.
- Every A→B goes through a simple intermediate (circle/capsule) with rotation and 10–15% squash&stretch; sub-parts morph in sync (steam → sun rays → waves).
- Background color fields change with each morph (clean color-block wipes); ease cubic-bezier(0.7,0,0.3,1), 3-frame cushions at start/end; no knotting/tangling ever (check every morph mid-point stills).
Sound: rhythmic plucky arpeggio; a pitched whoosh per morph landing on the beat.

You are the director: you may change the concept, copy, story beats and brand names if you find a stronger idea, but the result must remain the CANONICAL, instantly-recognisable form of this style and must hit its signature features below.

# Signature features and key techniques (the result is judged against these)
A hypnotic motion design discipline centered on seamless vector transformations. Shapes continuously morph into everyday objects and abstract geometries without ever cutting the camera.

**Visual Features**: Bold geometric primitives, constant visual volume, continuous unbroken motion curves, vibrant solid backgrounds, seamless vertex interpolation.

**Key Techniques**:
- Equal vertex counts: SVG paths configured with matching vertex counts so path interpolation flows without ugly pinching.
- Optimal path interpolation: Flannelfoot / Flubber algorithm or smart SVG path morphing.
- Hold & Release rhythm: Settle on recognized shape for 12–18 frames, then morph in 10–14 frames.
- Transitions: Entire scene transitions ARE the morphing elements — zero cuts, 100% flow.

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
