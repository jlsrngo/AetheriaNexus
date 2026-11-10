# Aetheria Motion Engine — 15 Studio Motion Design Styles

**Fifteen canonical motion-design archetypes engineered for deterministic single-file HTML (`window.renderAt(t)`) and Rust/FFmpeg hardware rendering.**

Every style includes its design specification, full director prompt, timing cues, and complete self-contained HTML5 Canvas / SVG / WebGL source code.

## Architecture: Why Single-File HTML Beats Multi-File React

1. **Single-File Determinism (`workspace/index.html`)**:
   - No multi-file import fragmentation, no TypeScript compilation failures, and no React Hook ordering crashes.
   - Any LLM (frontier or local) can author an entire multi-scene motion film in a single pass with full context visibility.
2. **Pure Function of Time (`window.renderAt(t)`)**:
   - Every visual frame is a deterministic function of `t` (seconds) powered by `window.AM` (`/aetheria-motion.js`).
3. **Interactive Studio Preview & Native FFmpeg Export**:
   - Previewed live at 30/60 FPS inside Aetheria Studio's `<iframe>` stage with synchronized Voicebox narration and exported directly to MP4 via FFmpeg `image2pipe`.

## The 15 Aetheria Motion Archetypes

| # | Skill Command | Archetype | Source & Prompt |
|---|---|---|---|
| 01 | `/mg-flat-vector` | Flat Vector 2D Explainer | [Prompt](prompts/01-flat-vector.md) · [Demo](demos/01-flat-vector) |
| 02 | `/mg-line-art` | Continuous Monoline Art | [Prompt](prompts/02-line-art.md) · [Demo](demos/02-line-art) |
| 03 | `/mg-isometric` | Isometric 2.5D Architecture | [Prompt](prompts/03-isometric.md) · [Demo](demos/03-isometric) |
| 04 | `/mg-3d-spatial` | Soft 3D Studio Render | [Prompt](prompts/04-3d-render.md) · [Demo](demos/04-3d-render) |
| 05 | `/mg-cel-boil` | Frame-by-Frame Cel & Line Boil | [Prompt](prompts/05-cel-boil.md) · [Demo](demos/05-cel-boil) |
| 06 | `/mg-cutout-collage` | Mixed-Media Cut-Out Collage | [Prompt](prompts/06-collage.md) · [Demo](demos/06-collage) |
| 07 | `/mg-liquid-fluid` | Liquid Morph & Metaballs | [Prompt](prompts/07-liquid.md) · [Demo](demos/07-liquid) |
| 08 | `/mg-shape-morph` | Continuous Vector Shape Morph | [Prompt](prompts/08-morph.md) · [Demo](demos/08-morph) |
| 09 | `/mg-bauhaus-swiss` | Geometric Bauhaus & Swiss Grid | [Prompt](prompts/09-bauhaus.md) · [Demo](demos/09-bauhaus) |
| 10 | `/mg-synthwave-retro` | 80s Synthwave & VHS CRT | [Prompt](prompts/10-synthwave.md) · [Demo](demos/10-synthwave) |
| 12 | `/mg-aurora-glass` | Aurora & Glassmorphism UI | [Prompt](prompts/12-aurora-glass.md) · [Demo](demos/12-aurora-glass) |
| 18 | `/mg-kinetic-calligraphy` | Expressive Kinetic Captions | [Prompt](prompts/18-hanazi.md) · [Demo](demos/18-hanazi) |
| 19 | `/mg-paperclip-sticker` | Tactile Sticker Explainer | [Prompt](prompts/19-paperclip.md) · [Demo](demos/19-paperclip) |
| 20 | `/mg-pixel-arcade` | 16-Bit Pixel Art Arcade | [Prompt](prompts/20-pixel.md) · [Demo](demos/20-pixel) |
| 22 | `/mg-sci-fi-hud` | Cyberpunk Telemetry HUD / FUI | [Prompt](prompts/22-hud.md) · [Demo](demos/22-hud) |

## Rendering CLI

```bash
# Render active workspace/index.html to MP4
node scripts/render.mjs --output output/film.mp4

# Render a specific reference demo
node references/mg-styles-15/harness/render.mjs references/mg-styles-15/demos/01-flat-vector
```
