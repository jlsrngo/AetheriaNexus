---
name: mg-cutout-collage
description: "Dada Cutout Paper Collage motion design archetype from mg-styles-15. Award-shortlist commercial motion graphics standard for Remotion."
tags:
  - motion-graphics
  - mg-styles-15
  - remotion
  - visual-archetype
command: /mg-cutout-collage
---

# Dada Cutout / Paper Collage & Stop-Motion (Motion Graphics Standard)
*Ported from award-winning mg-styles-15 motion system.*

# Dada Cutout & Paper Collage Motion Design

**Reference Benchmark**: NOGGIN: The Mind Is a Collage · 1920×1080 · 30 fps · 10 s · AI Jury Score 8.14 / 10

**Reference Source**: [index.html](../../../references/mg-styles-15/demos/06-collage/index.html) · [cues.json](../../../references/mg-styles-15/demos/06-collage/cues.json)

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
Dada Cutout / Paper Collage & Stop-Motion

# Output (fixed)
- 1920×1080, 30 fps, exactly 10.000 s (300 frames), H.264 MP4 with stereo AAC audio (48 kHz), mastered to −14 LUFS
  integrated, true peak ≤ −1 dBTP. Final file: video.mp4.

# Suggested technical route
HTML: DOM/Canvas with PNG cutouts from /assets/images (rembg), SVG/CSS white-edge + halftone filters; stepped 12 fps (render 30 fps, hold motion on 12 fps grid)
(You may choose a better route if it clearly raises quality; say why.)

# Creative seed
Surreal Dada/Monty-Python cutout collage in a modern editorial magazine finish.
- Newsprint/kraft paper ground; a public-domain Victorian portrait cutout with rough white scissor edge + halftone; the top of the head FLIPS OPEN like a lid (Terry Gilliam homage) revealing deep space (NASA PD imagery) from which flowers, birds, planets, pointing hands and a vintage rocket spill out.
- Jaw/mouth on a separate cut flaps with the sound; hands slap elements onto the page; torn-paper strips; bold constructivist red/black diagonal typography (e.g. "THE MIND IS A COLLAGE").
- Motion on 12 fps (even 6 fps for some holds) with ±2px hand-placement jitter; paper-flip / torn-paper transition to the end card.
Sound: vinyl crackle, jazzy boom-bap bed, paper rustles, scissors snips, slaps and a comic 'pop' when the lid opens.

You are the director: you may change the concept, copy, story beats and brand names if you find a stronger idea, but the result must remain the CANONICAL, instantly-recognisable form of this style and must hit its signature features below.

# Signature features and key techniques (the result is judged against these)
Retro surrealist collage inspired by Dadaism, Monty Python, and Soviet constructivism. Vintage public-domain portrait cutouts, torn paper edges, cork pins, stamp slams, and snappy stop-motion paper physics.

**Visual Features**: White scissor-cut borders (3–4px #F4EFE4), halftone dot shading, aged kraft paper textures, mismatched anatomical proportions, mechanical puppet limbs, red wax/ink stamps.

**Key Techniques**:
- Slap-drop physics: Fast downward drop with landing squash (`scaleY: 0.965`) and spring rebound.
- Scissor rim & shadow: High-contrast outline with shadow collapse from elevated blur to resting contact shadow.
- Stop-motion jitter: Subtle ±1.5px position boil at 12fps to ensure pieces never freeze.
- Transitions: Elements slapped on camera, torn-paper sweeps, and whole-page turns.

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
- **Remotion Zero-Blackscreen & Defensive Coding Policy**:
  - Defensive Animation Props: Every motion component MUST fallback safely: const duration = propDuration ?? useVideoConfig()?.durationInFrames ?? 300;. All inputRange values in interpolate() must be finite numbers, NEVER undefined or NaN.
  - Asset Verification Guard: Never reference image files that do not exist in pps/public/ or workspace/public/. Use standard <img> tags with fallback styling. Never nest staticFile().
  - No Blinding Flash at Frame 0: Camera cut / flash transitions must NOT occlude frame 0 (if (frame <= 0) return null;) so paused/poster frames are immediately crisp.
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
