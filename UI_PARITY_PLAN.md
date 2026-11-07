# PLAN — UI Parity dengan Aetheria Agent

Target: layar Studio AetheriaNexus terasa seperti aplikasi Aetheria Agent (referensi: 3 screenshot
terakhir), dengan satu perbedaan yang disengaja — panel tengah berisi video + timeline, bukan dokumen.

Status: **rencana saja, belum ada kode yang diubah.**

---

## 0. Keputusan yang perlu dikonfirmasi

| # | Hal | Usulan |
|---|---|---|
| K1 | **Arti "4 panel".** | rail ikon + Explorer + Stage(+timeline) + Chat. Timeline di dalam kolom tengah, bukan panel kelima. |
| K2 | **Menu Edit & Apps.** Di Aetheria Agent ada File/Edit/View/Apps/Help; di Nexus hanya Berkas/Tampilan/Bantuan yang benar-benar berfungsi (`EditMenu`/`AppsMenu` memanggil event tanpa listener). | Tetap 3 menu. Menambah menu mati = kontrol palsu. |
| K3 | **Tombol akun** di kanan atas referensi. Nexus belum punya sistem akun. | Tombol Settings yang sudah ada, bukan avatar palsu. |

Rounded sudah diputuskan: `AGENTS.md` §5 sudah diperbarui ke *Normal UI*, jadi tidak ada lagi
aturan sudut 0° yang bertentangan.

---

## 1. Selisih terukur (sekarang → target)

| Area | Sekarang | Target (referensi) |
|---|---|---|
| Rail kiri | tidak ada; panel kiri hilang total saat ditutup (gambar 2) | rail ikon 44px **selalu ada**, ikon aktif ditandai garis putih kiri + badge angka |
| Explorer | 1 blok besar, header tebal, tanpa seksi | header tipis (ikon folder + "Explorer" + refresh + collapse), lalu seksi `REKAPAN` berisi file dengan ikon tipe + ukuran, lalu `Canvas 5` di bawah |
| Topbar | tinggi 40px, font mono, tombol SETTINGS teks | tinggi 44px, Inter, logo + menu, kanan: toggle tema, ikon akun, minimize/maximize/close |
| Sudut | 0px semua | panel 12px, kartu 10px, tombol 8px, pill 999px |
| Font | mono di seluruh UI | Inter untuk label/isi; mono hanya angka (ukuran file, frame, FPS, waktu) |
| Stage | video mentah di atas background hitam | panel rounded dengan border halus, video di tengah, kontrol timeline menempel di bawah panel |
| Timeline | bar selebar kolom, ruler penuh, tombol kotak | panel rounded, kontrol mengambang, playhead tetap merah |
| Chat | bubble kotak, header tebal | kartu rounded, timestamp kecil, header bertab, composer rounded dengan pill model |
| Bawah | footer full-width 5 tab | nav pill mengambang di tengah, chip folder di kiri, chip Online di kanan |

---

## 2. Token desain (dari referensi)

```css
/* index.css */
--radius-panel: 12px;   /* explorer, stage, chat */
--radius-card: 10px;    /* bubble, file row, kartu */
--radius-control: 8px;  /* tombol, input, ikon */
--radius-pill: 999px;   /* nav, chip, badge */

--bg-app: #0A0A0C;
--bg-panel: #121215;
--bg-card: #1A1A1F;
--border: #26262C;
--text-primary: #FAFAFA;
--text-muted: #8E8E98;
```

Font: `Inter` untuk UI (sudah dimuat di `index.css` baris 1), `font-mono` dipertahankan hanya untuk
angka.

**Cara menerapkan radius tanpa 153 suntingan manual:** tambahkan satu override utilitas di
`index.css`, lalu ganti nama token saat komponen disentuh.

```css
@utility rounded-none { border-radius: var(--radius-control); }
```

Ini membalik seluruh `rounded-none` (153 kemunculan di 30 file) sekaligus. Panel/kartu yang perlu
lebih bulat diberi `rounded-xl` / `rounded-[12px]` eksplisit saat komponennya dirapikan.

---

## 3. Fase pengerjaan

### Fase 1 — Fondasi visual
**File:** `apps/src/index.css`, `apps/src/components/ui/*`
- Tambah token radius + warna di atas.
- Override `rounded-none`.
- `Button`/`Card`/`Input`/`Badge`: radius + font sans.
- **Verifikasi:** screenshot 3 halaman (Studio, Stock, Settings) — tidak ada sudut tajam, tidak ada layout pecah.

### Fase 2 — Shell 4 panel
**File:** `UnifiedWorkstationPage.tsx`, `WorkstationLeftExplorer.tsx`, `activity/WorkstationActivityBar.tsx` (sudah ada, belum dipakai), `hooks/useWorkstationLayout.ts`, `lib/panels.ts`
- Pakai `WorkstationActivityBar` sebagai rail tetap; 4 ikon: Assets, Timeline/Stock, Chat, Settings.
- `collapsed` hanya menyembunyikan **panel Explorer**, rail tetap terlihat (menyelesaikan gambar 2).
- Rail: ikon aktif = garis putih 2px di kiri + background kartu; badge angka untuk item yang punya isi.
- Resizer tetap, tapi tanpa garis saat idle.
- **Verifikasi:** klik ikon rail → panel buka/tutup, rail tidak ikut hilang; reload halaman → state kembali.

### Fase 3 — Chrome Explorer
**File:** `WorkstationLeftExplorer.tsx`, `explorer/ExplorerRecentCanvases.tsx`, `workspace/FileTree.tsx`
- Header 36px: ikon folder + "Explorer" + refresh + collapse.
- Seksi `REKAPAN` (folder aktif) dengan baris file: ikon tipe berwarna, nama, ukuran `font-mono` rata kanan.
- Seksi `Canvas N` di bawah, bisa dilipat, isi item + ukuran.
- **Verifikasi:** buka folder nyata → nama + ukuran benar; collapse per seksi bekerja.

### Fase 4 — Topbar
**File:** `AppHeader.tsx`, `TopMenuBar.tsx`, `menu/*`
- Tinggi 44px, font Inter, logo + nama.
- Kanan: toggle tema (memakai `ThemeSubmenu` yang sudah ada), Settings, window controls.
- Menu dropdown: rounded 10px, item 8px.
- **Verifikasi:** tiap menu bisa dibuka, tema berganti tanpa reload.

### Fase 5 — Stage + Timeline
**File:** `WorkstationCenterPanel.tsx`, `studio/StudioPreview.tsx`, `studio/Timeline.tsx`
- Tab bar tipis, tab aktif rounded.
- Stage = panel rounded berisi `<Player>`; kosong = logo + "Nexus Studio" + "Open a folder to start".
- Timeline: kontrol mengambang (play/pause/step) di kiri, readout `FRAME 000/150 · 0.00s · 30 FPS` di kanan, ruler + track di panel rounded.
- **Verifikasi:** probe yang sudah ada (seek 50% → 075, play 1s → 102, step +1 → 104) harus tetap lulus.

### Fase 6 — Chat
**File:** `WorkstationRightChat.tsx`, `chat/WorkstationRightChatHeader.tsx`, `chat/ChatMessageBubble.tsx`, `chat/ChatInputBox.tsx`
- Header bertab seperti referensi (ikon + judul + badge + `+` + toggle panel).
- Bubble rounded, timestamp kecil di luar bubble.
- Composer rounded dengan pill model (sudah ada) + tombol kirim bulat.
- **Verifikasi:** kirim pesan, streaming, lampiran gambar — semua tetap jalan.

### Fase 7 — Bottom bar
**File:** `AppFooter.tsx`, `AppLayout.tsx`
- Ganti footer full-width dengan: chip folder (kiri), nav pill mengambang (tengah: Studio, Stock, Schedule, Analytics, Settings), chip Online (kanan).
- Nav pill hanya di route Studio; halaman lain tetap punya navigasi yang sama.
- **Verifikasi:** kelima tujuan bisa dicapai dari pill; tidak ada route yang hilang.

### Fase 8 — Verifikasi menyeluruh
- Playwright + Edge: screenshot 1280×820 untuk state: normal, explorer ditutup, chat ditutup, folder terbuka.
- Probe timeline + probe buka/tutup panel.
- `npm run typecheck`, `npm run build -w apps`, `cargo test -p aetheria-engine`.
- Rebuild exe release + cek tidak ada `node`/`:3333`.

---

## 4. Yang tidak dikerjakan
- Menu Edit/Apps palsu (K2).
- Avatar akun palsu (K3).
- Multi-track timeline — komposisi masih satu `AbsoluteFill`; track palsu = UI bohong.
- Tema terang/neobrutalism tidak dirombak; hanya ikut mendapat radius dari token.

## 5. Risiko
1. Override `rounded-none` menyentuh 153 tempat sekaligus — kalau ada yang bergantung pada sudut tajam (kanvas, handle resize), perlu pengecualian.
2. `box-shadow: none !important` di `index.css` mematikan shadow; referensi memakai shadow halus pada panel mengambang. Perlu pengecualian terarah.
3. Mengubah `AppFooter` menyentuh navigasi semua halaman — harus diuji route per route.

## 6. Urutan commit
1. `ui: add rounded design tokens` (Fase 1)
2. `ui: persistent activity rail + collapsible explorer` (Fase 2)
3. `ui: explorer chrome and file rows` (Fase 3)
4. `ui: topbar parity` (Fase 4)
5. `ui: stage and timeline chrome` (Fase 5)
6. `ui: chat chrome` (Fase 6)
7. `ui: floating bottom nav` (Fase 7)
