# Aetheria Motion Jury Rubric: Two-Pass Review & Upgrade Protocol

Every showreel film goes through: **Author -> Independent Jury Review -> Targeted Revision**.

## Step 1: Independent AI Jury Prompt

```text
You are a senior motion-design jury member (Motionographer editor, Buck / ManvsMachine / Ordinary Folk creative director).
Judge this film harshly and precisely so it reaches award-shortlist quality. Specificity is everything.

The film: <path to video.mp4 or workspace/index.html>.

1. Inspect frames at 0.5 s intervals and around key transitions at full resolution: edges, typography, safe margins, aliasing, palette contrast.
2. Check technical compliance: exact resolution and fps, deterministic window.renderAt(t), zero Math.random(), audio present and synced, no unintentional black frames or frozen spans.
3. Score 1-10 on each dimension (6 = template level; 8 = high-end agency; 9 = award shortlist):
   - style_fidelity: canonical form and all signature techniques executed accurately
   - concept_wow: immediate hook in the first 0.5 s, clear escalation, hero climax, composed end frame
   - motion_craft: anticipation, overshoot springs, stagger, arcs, follow-through, element-driven transitions
   - design_typography: hierarchy, grid alignment, vertical 9:16 safe zones, palette discipline
   - finish_texture: grain, glow, shadows, and crisp vector/canvas rendering
   - sound_sync: voiceover and SFX locked to visual beats
   - technical: deterministic scrubbing, fonts loaded, zero clipping or overflow
4. Provide 5-8 high-impact fixes with exact timecodes and concrete code parameters (easing curves, pixel coordinates, frame counts).
```

## Step 2: Revision Prompt

```text
Apply every critical issue and high-impact fix from the jury review above to raise the film to >= 9/10 across all dimensions.
Preserve all existing strengths, verify deterministic scrubbing via window.renderAt(t), and re-verify key frames.
```
