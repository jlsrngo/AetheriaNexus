# conspiracy-crime-board

REMOTION AGENT BRIEF — Vintage Conspiracy & Crime Investigation Board (v1)

Crime investigation board, classified archival dossier, and mystery hook.

**Fonts:** Anton, Caveat, Courier Prime. **Scale Law:** `u(refPx) = refPx * (1080 / 390)`.

## Do
- Follow all specifications in SKILL.md verbatim.
- Place red strings (`z-index: 60`) and 3D pushpins (`z-index: 70`) strictly above all polaroid cards.
- Center Hero card must drop last (frame 60+) and sit proud on top of surrounding cards (`z-index: 50`).
- Use frame-based physics (`spring({ damping: 15, stiffness: 80, mass: 0.95 })`).
- Keep background textured with permanent torn paper, grid lines, and warm spotlight vignette.

## Don't
- Do not use CSS transitions or setTimeout.
- Do not let red threads disappear behind photos.
- Do not crowd all cards at the top leaving the bottom empty.
