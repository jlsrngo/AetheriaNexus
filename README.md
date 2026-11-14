# Aetheria Nexus

Local-first Windows desktop AI video studio built with **Tauri v2**, **Rust**, **React 19**, and a modular **HTML5 / Three.js** motion engine.

## Highlights

- **Local Motion Rendering:** Deterministic HTML5 Canvas / Three.js WebGL films rendered locally via pure-Rust headless Chromium CDP + FFmpeg (no cloud render fees).
- **3-Track AI Pipeline:** Coordinated agent workflow for voiceover & word-level timestamps, SFX cues, modular per-scene scripts (`script/scene1..N.js`), and visual QA.
- **Isolated Video Projects:** Each video is organized into its own workspace subfolder (`projects/<slug>/`) with dedicated `index.html`, `script/`, `audio/`, `output/`, and previews.
- **TikTok-First Studio:** 9:16 canvas stage, timeline, stock vault, post scheduling, and account analytics.

## Repository Layout

```text
apps/                   React + Vite + Tailwind frontend
core/aetheria-engine/   Rust backend engine (Axum HTTP API, agents, CDP/FFmpeg renderer)
src-tauri/              Tauri v2 desktop shell
scripts/                Dev, smoke, and bundle helpers
.aetheria/skills/       Motion & visual style skills (e.g. mg-soft-clay-story)
e2e/                    Playwright end-to-end tests
```

## Prerequisites

- **Node.js** 20+ & **npm**
- **Rust** toolchain (`cargo`, `rustc`)
- **FFmpeg** & **Microsoft Edge / Google Chrome** (for local headless rendering and preview capture)

## Quick Start

```bash
# Install JS dependencies
npm install

# Build the Rust engine (debug incremental)
npm run build:engine

# Run the desktop app (Tauri + Vite HMR)
npm run tauri:dev

# Or run web + engine dev server
npm run dev:app
```

For a production desktop installer/executable:

```bash
npm run tauri:build
```

## Verification

```bash
npm run typecheck
npm run build
cd apps && npx vitest run
cargo test --workspace
npm run test:e2e
```

## License

[GPL-3.0-or-later](LICENSE)
