# Aetheria Nexus

Local-first Windows desktop AI video studio built with **Tauri v2**, **Rust**, **React 19**, and an **HTML5 / Three.js** motion engine.

## Architecture & Core Modules

- **`core/aetheria-engine/src/studio/`** — Motion & rendering backend:
  - `project_registry.rs`: Isolates each video in `projects/<slug>/` (`index.html`, `script/`, `audio/`, `output/`) and tracks the active project.
  - `motion.rs`, `film_inspector.rs`, `motion_linter.rs`: Parses `window.__filmMeta`, validates determinism, and serves film bundles.
  - `film_static_server.rs`, `preview_capture.rs`, `html_renderer.rs`, `ffmpeg_pipeline.rs`: Serves isolated project assets to headless Chromium CDP and encodes frames + audio via FFmpeg.
- **`core/aetheria-engine/src/session/agent_turn/`** — Multi-agent orchestration:
  - `runner.rs`, `subagent_store.rs`: Coordinates `audio-director`, `motion-designer`, and `qa-verifier`.
  - `command_resolvers.rs`: Resolves `/mg-*` skill & `/audio:*` directives and seeds skill kits into the active project.
- **`apps/src/`** — React + Vite + Tailwind UI:
  - `components/studio/`: Canvas stage (`StudioPreview`, `HtmlMotionPlayer`, `StudioProjectSelector`), timeline, and audio sync.
  - `components/workstation/`, `hooks/`, `lib/`: Chat workstation, TanStack Query / `apiFetch` engine client, and workspace stores.
- **`src-tauri/`** — Tauri v2 desktop shell, window management, and native IPC commands.
- **`.aetheria/skills/`** — Modular motion style skills (e.g. `mg-soft-clay-story`) with tokens and starter kits.

## Quick Start

```bash
npm install
npm run build:engine   # Debug Rust engine build
npm run tauri:dev      # Desktop shell + Vite HMR
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
