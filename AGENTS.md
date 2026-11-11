# AGENTS.md

## Project Specifications & References (Single Source of Truth)

AI agents working on this project must consult and adhere to the following specification documents:

1. **Primary PRD (Active Architecture & Feature Spec):**
   * [`PRD_DESKTOP_TAURI.md`](PRD_DESKTOP_TAURI.md)
   * **Target:** Windows Desktop Application (`.exe` / `.msi` via Tauri v2 + Rust + React + Modular HTML5/JS Motion Engine).
   * **Key Priorities:** TikTok-First (P0), Local Rendering (Rp 0 / Zero Cloud Costs via pure-Rust Headless Browser CDP + FFmpeg), Video Stock Inventory, Scheduling & Account Analytics (Views, Likes, Followers).
   * **Workspace Isolation Rule:** Engine dan UI IDE wajib sepenuhnya terisolasi dari folder proyek pengguna yang dibuka (`workspace/`). Error di folder proyek tidak boleh mematahkan build/runtime IDE.
2. **Cloud/Serverless Architecture Reference (Secondary/Legacy):**
   * [`PRD_VERCEL_OPTIMIZED.md`](PRD_VERCEL_OPTIMIZED.md)
   * Reference for web/cloud concepts if hybrid features are requested.
3. **Original Background PRD:**
   * `PRD - Platform Otomasi Konten Sosmed dengan Remotion.docx`
   * Initial concept draft for Remotion-based automated social media video generation.

---

## Behavioral Guidelines

Behavioral guidelines to reduce common LLM coding mistakes, derived from Andrej Karpathy's observations on LLM coding pitfalls.

**Tradeoff:** These guidelines prioritize caution and precision over raw speed. For trivial tasks, exercise appropriate judgment.

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- **State assumptions explicitly:** If uncertain, ask rather than guess.
- **Present alternatives:** If multiple valid interpretations exist, lay them out—do not pick one silently.
- **Surface simpler solutions:** If a simpler approach exists, mention it. Push back respectfully when warranted.
- **Stop when confused:** If something is ambiguous or contradicts the existing setup, stop and ask.

---

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- **No unrequested features:** Implement only what was directly asked.
- **No speculative abstractions:** Avoid creating classes, wrappers, or generic patterns for single-use code.
- **No unnecessary configurability:** Do not over-parameterize code unless required.
- **No handling for impossible cases:** Avoid defensive clutter for scenarios that cannot happen in practice.
- **Conciseness rule:** If a solution takes 200 lines but could cleanly fit in 50, rewrite and simplify it.

> *The test:* Would a senior engineer consider this overcomplicated? If yes, simplify.

---

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- **Preserve surrounding code:** Do not modify adjacent formatting, comments, or style unless explicitly asked.
- **No drive-by refactoring:** Do not refactor code that is working and unrelated to the task.
- **Respect codebase style:** Match existing idioms and naming conventions.
- **Dead code awareness:** If you notice unrelated dead code, mention it instead of silently deleting it.

When your changes create orphans:
- Remove imports, variables, or functions that became unused *because of your changes*.
- Do not purge pre-existing unused elements without instruction.

> *The test:* Every changed line in the diff should trace directly back to the user's request.

---

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform vague or imperative tasks into verifiable goals:
- Instead of *"Add validation"*, define: *"Write tests or checks for invalid inputs, then verify they pass."*
- Instead of *"Fix the bug"*, define: *"Reproduce the failure first, then verify the fix resolves it without regressions."*
- Instead of *"Refactor X"*, define: *"Ensure test suite/behavior passes before and after the change."*

For multi-step implementations, maintain a lightweight verification plan:
```text
1. [Step 1] -> verify: [Verification check]
2. [Step 2] -> verify: [Verification check]
3. [Step 3] -> verify: [Verification check]
```

---

## Success Indicators

These guidelines are functioning effectively when:
- Diffs contain zero unrelated modifications.
- Solutions avoid premature abstractions and remain easy to read.
- Clarifying questions are raised **before** committing to flawed implementations.
- PRs/commits remain minimal, clean, and directly tied to requirements.

---

## 5. UI Design System: Normal UI

**Rujukan visual:** aplikasi Aetheria Agent. Rencana migrasi dan selisih per area ada di
[`UI_PARITY_PLAN.md`](UI_PARITY_PLAN.md).

Semua komponen UI aplikasi desktop ini **WAJIB** mengikuti aturan berikut:

### A. Aturan Visual Arsitektur
1. **Rounded Corners:**
   * Panel/kontainer: `--radius-panel` (12px). Kartu, bubble, baris file: `--radius-card` (10px).
   * Tombol, input, ikon: `--radius-control` (8px). Nav, chip, badge: `--radius-pill` (999px).
   * Sudut 0° hanya untuk elemen yang memang menempel penuh ke tepi jendela.
2. **Borders Halus:**
   * Pemisah modul memakai 1px `--border` (`#26262C`), bukan garis putih kontras.
   * Shadow hanya untuk elemen mengambang (nav pill, dropdown, modal).
3. **Tipografi:**
   * **Inter** untuk label, judul, isi, dan tombol.
   * **Monospace** hanya untuk angka: ukuran file, frame, FPS, timestamp, kode.
   * Label kecil boleh all-caps + `tracking-wide`, tetapi tidak wajib.
4. **Palet Netral Gelap:**
   * App `#0A0A0C`, panel `#121215`, kartu `#1A1A1F`, border `#26262C`.
   * Teks utama `#FAFAFA`, teks sekunder `#8E8E98`.
   * Aksen hanya fungsional: emerald = aktif, rose = rekam/render, amber = peringatan.
5. **Layout 4 Panel:**
   * Activity rail (selalu terlihat) | Explorer | Stage + Timeline | Chat.
   * Navigasi bawah berupa pill mengambang, bukan footer full-width.
6. **Ketahanan UI:**
   * Kegagalan preview hanya boleh meremount area player; dilarang reload seluruh window.

---

## 6. Frontend: React Best Practices (`apps/src/`)

Seluruh kode React wajib mengikuti praktik terbaik React modern agar modular, deterministik, dan mudah dirawat (*ukuran file mengikuti kohesi tanggung jawab — bukan patokan angka baris kaku*):

1. **1 Komponen / Hook = 1 Tanggung Jawab Kohesif:**
   * Pecah komponen hanya ketika mencampur lebih dari satu concern UI atau menggabungkan UI berat dengan logika/efek samping; jangan memecah satu komponen kohesif secara artifisial semata karena jumlah baris.
   * Struktur folder modular sesuai domain:
     * `apps/src/components/ui/` : Primitives UI murni (`Button`, `Card`, `Badge`, `Input`).
     * `apps/src/components/layout/` : Struktur shell, menu bar, & sidebar.
     * `apps/src/components/studio/` : Custom `HtmlMotionPlayer`, `HtmlFilmStage`, `SceneAudioSync`, panel preview & timeline terpecah per concern (`preview/`, `timeline/`, `panels/`).
     * `apps/src/components/stock/`, `schedule/`, `analytics/` : Fitur domain masing-masing.
2. **Pemisahan Container vs Presentational UI vs Custom Hooks (`apps/src/hooks/`):**
   * Efek samping (`fetch`, listener keyboard/window, `requestAnimationFrame`, `ResizeObserver`, timer sinkronisasi audio/frame) wajib ditarik ke custom hook terfokus di `apps/src/hooks/` (mis. `useMotionPlayback.ts`, `useStudioCanvasViewport.ts`).
   * Fungsi transformasi data murni, builder URL, atau kalkulasi koordinat/layer wajib dipisah ke modul `.ts` murni agar bisa dites langsung via Vitest tanpa render DOM.
   * Komponen presentational murni hanya menerima `props` + callbacks dan tidak memegang state orkestrasi.
3. **Isolasi Error & Ketahanan UI:**
   * Pasang React `ErrorBoundary` di batas stage/panel (mis. `StageErrorBoundary`), sehingga error di skrip HTML/JS milik proyek pengguna hanya terisolasi di area stage dan tidak pernah mereload jendela aplikasi.
4. **Strict Type Safety:**
   * Semua props, state, event payload, dan response API wajib memiliki interface TypeScript eksplisit di `apps/src/types/`. Dilarang keras memakai `any`.

---

## 7. Backend: Rust Single-Responsibility Architecture (`core/` & `src-tauri/`)

Seluruh kode Rust wajib mematuhi prinsip **1 File = 1 Tanggung Jawab Kohesif** *(berdasarkan kohesi tanggung jawab, bukan batas jumlah baris kaku — satu file tetap boleh panjang bila memang mengimplementasikan satu domain utuh beserta unit test-nya)*:

1. **1 File = 1 Tanggung Jawab Logis:**
   * Satu modul `.rs` hanya boleh memegang **satu tanggung jawab kohesif**:
     * Jangan menggabungkan **HTTP/Tauri command handlers** dengan **domain parser/linter**, **subprocess launcher**, atau **protocol client** di satu file.
     * Contoh pemisahan yang sehat: pisahkan **linter** (`motion_linter.rs`) dari **inspektor metadata/scene** (`film_inspector.rs`); pisahkan **static HTTP server** (`film_static_server.rs`), **FFmpeg CLI pipeline** (`ffmpeg_pipeline.rs`), dan **orkestrator browser CDP** (`html_renderer.rs`).
2. **Orkestrasi Ramping & Sub-fungsi Terfokus:**
   * Jangan memaksa memecah file hanya karena melewati angka baris tertentu bila masih satu konsep kohesif; cukup ekstrak helper privat saat sebuah fungsi menyentuh beberapa langkah I/O atau level abstraksi berbeda.
3. **Layering Tegas (Thin Endpoints, Cohesive Services):**
   * Handler Axum (`studio/*.rs`) dan command Tauri (`src-tauri/src/*_cmds.rs`) wajib tipis: validasi input, delegasi ke modul domain/service, lalu format response HTTP/JSON.
   * Pisahkan grup command Tauri sesuai domain tanggung jawabnya (window, IPC bridge, auth CLI, render).
4. **Isolasi Workspace & Sandbox Safety:**
   * Setiap operasi I/O terhadap proyek pengguna wajib melewati path guard (`contains_path`, `resolve_isolated_path`) dan tidak boleh bergantung pada folder `workspace/` bawaan repositori ataupun memuat asset/kode proyek secara statis saat kompilasi engine.




