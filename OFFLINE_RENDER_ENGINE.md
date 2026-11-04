# Mesin Render Offline — Tetap Remotion, Tanpa Internet

> **Status:** Rencana (belum dieksekusi)
> **Keputusan:** Mesin pembuat video **tetap Remotion**. Kita tidak menulis renderer sendiri.
> **Yang berubah:** cara mengemas dan menjalankannya — supaya tidak butuh internet, tidak butuh server, dan tidak butuh user meng-install apa pun.
> **Dokumen terkait:** [`PRD_DESKTOP_TAURI.md`](PRD_DESKTOP_TAURI.md)

---

## 1. Apa yang Tetap, Apa yang Berubah

| | Sekarang | Target |
|---|---|---|
| Mesin React → video | Remotion | **Remotion (tetap)** |
| Cara memanggil | `node scripts/render.mjs` | `render-engine.exe` (Node dibungkus) |
| Preview | iframe Studio `:3333` | dihapus atau `<Player>` |
| Studio / `@remotion/cli` | dipakai | **dibuang** |
| Chrome | diunduh ke `node_modules/.remotion` | pakai Edge bawaan Windows |
| Internet | dibutuhkan sekali (npx + unduh Chrome) | **tidak sama sekali** |
| Node terpasang di mesin user | wajib | **tidak wajib** |

Yang kita bangun **bukan** renderer baru. Kita hanya mengemas Remotion supaya bisa jalan di komputer orang lain tanpa mereka menyiapkan apa pun.

---

## 2. Kondisi Sekarang (diukur, bukan perkiraan)

### Waktu render — 1 run penuh

```
Render 150 frame 1080×1920 NexusEditorialVideo   = 94,7 detik
  ├─  0,0 –  6,1s   node boot
  ├─  6,1 – 59,3s   bundling webpack        = 53,2 detik  (56% dari total)
  ├─ 59,3 – 93,3s   gambar + encode 150 fr  = 34,0 detik
  └─ 93,3 – 94,7s   finalisasi mp4
```

### Ukuran yang terlibat

| Komponen | Ukuran | Wajib? |
|---|---|---|
| `node_modules/@remotion/*` | **73,7 MB** | ya |
| `compositor-win32-x64-msvc` (di dalamnya) | 28,4 MB | **ya** — encoder + ffmpeg |
| `chrome-headless-shell` | **303 MB** | bisa diganti Edge |
| `react` + `react-dom` | 7,2 MB | ya |
| `webpack` | 13,5 MB | ya (dipakai bundler) |
| `puppeteer-core` | 5,8 MB | ya (driver Chrome) |
| Node runtime | ~80 MB | ya, kalau user tidak punya |
| `apps/src/remotion/*` | < 1 MB | ya — komposisi kita |
| `scripts/render.mjs` | 4 KB | ya — driver |

---

## 3. Tiga Kebocoran Offline, dan Perbaikannya

### Kebocoran 1 — `@remotion/cli` tidak terpasang

```
package.json devDependencies   "@remotion/cli": "^4.0.540"   ← dideklarasikan
node_modules/@remotion/cli                                  ← TIDAK ADA
package-lock.json                                           ← tidak ada entri
```

Akibatnya `npx remotion studio` **mengunduh** paket itu ke cache:

```
C:\Users\AMD\AppData\Local\npm-cache\_npx\03f562a46baa5292\
```

Panel Studio yang hidup sekarang bergantung pada cache itu. Tanpa internet, panel itu tidak menyala.

**Perbaikan:** buang Studio. `@remotion/cli` hanya dipakai untuk menyalakan Studio, tidak dipakai untuk render. Render memakai `@remotion/bundler` + `@remotion/renderer` yang sudah lokal.

### Kebocoran 2 — Chrome diunduh saat render pertama

`@remotion/renderer` memanggil `ensureBrowser()`, dan kalau `chrome-headless-shell` belum ada, ia **mengunduh 303 MB**. Di mesin user tanpa internet, render pertama gagal.

**Perbaikan A (disarankan):** pakai Edge yang sudah ada di semua Windows 10/11.

```js
await renderMedia({
  browserExecutable: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  // ...
});
```

Di mesin ini: Edge `156.0.4314.58`, Chrome `157.0.8103.38` — keduanya cukup baru untuk Remotion 4.0.540.

Saat `browserExecutable` diisi, `ensureBrowser()` mengembalikan `user-defined-path` dan **tidak mengunduh apa pun**.

Hemat: **303 MB**.

**Perbaikan B (cadangan):** ikutkan `chrome-headless-shell` di installer. Aman, tapi installer jadi +303 MB.

### Kebocoran 3 — berkas render tidak ikut dibundel

`src-tauri/tauri.conf.json` tidak punya entri `resources`, dan `scripts/prepare-bundle.cjs` hanya mengirim `apps/dist`, exe, dan `web/`.

Artinya installer yang kamu distribusikan **tidak bisa render** — `scripts/render.mjs` dan `apps/src/remotion/*` tidak ada di dalamnya.

**Perbaikan:** tambahkan `resources` di `tauri.conf.json`:

```json
"bundle": {
  "resources": {
    "scripts/render.mjs": "render/render.mjs",
    "apps/src/remotion": "render/remotion",
    "dist-render": "render/node_modules"
  }
}
```

---

## 4. Node: Tiga Pilihan

| Pilihan | Ukuran | User perlu install Node? | Catatan |
|---|---|---|---|
| **A. Wajibkan Node terpasang** | 0 MB | ya | Paling murah, tapi tidak bisa dibilang mandiri |
| **B. Bawa `node.exe` sebagai sidecar** | ~80 MB | tidak | Paling sederhana, satu baris di `tauri.conf.json` (`externalBin`) |
| **C. Node SEA** | ~80 MB | tidak | Satu exe berisi Node + driver, tidak bisa dibaca/diutak-atik |

Disarankan **C** kalau mau rapi, **B** kalau mau cepat jadi.

Node SEA membungkus `scripts/render.mjs` + seluruh dependency-nya menjadi `render-engine.exe`:

```bash
node --experimental-sea-config sea-config.json
```

---

## 5. Arsitektur Target

```
┌────────────────────── 1 proses: arunaki-desktop ──────────────────────┐
│                                                                        │
│  WebView2                                                              │
│    └─ <Player> (opsional) — preview tanpa port                         │
│                                                                        │
│  Rust (arunaki-engine)                                                 │
│    ├─ render queue (progress, cancel)                                  │
│    └─ spawn ──▶ resources/render/render-engine.exe                     │
│                     │                                                  │
│                     ├─ @remotion/bundler   (webpack, lokal)            │
│                     ├─ @remotion/renderer  (puppeteer-core, lokal)     │
│                     ├─ msedge.exe          (Edge bawaan Windows)       │
│                     └─ compositor\remotion.exe + ffmpeg.exe (28 MB)    │
│                                    │                                   │
│                                    ▼                                   │
│                              output/*.mp4                              │
└────────────────────────────────────────────────────────────────────────┘
```

Tidak ada: Studio · `@remotion/cli` · npx · server yang harus dinyalakan · Node terpasang di mesin user.

**Catatan jujur soal port:** selama render berjalan, `@remotion/renderer` membuka HTTP server internal di `127.0.0.1` port acak 3000–3100 untuk menyajikan bundle ke Chrome, lalu menutupnya. Itu bukan server yang kita kelola dan tidak bertahan setelah render selesai — tapi kalau `netstat` saat render, akan terlihat.

---

## 6. Alur Render

```
Chat / tombol Render
  │
  ├─ Rust: buat job { id, compositionId, props, output }
  │
  ├─ Rust: spawn render-engine.exe --composition X --output Y --props '{...}'
  │
  ├─ exe: bundle(entry)          → 53 detik (bisa di-cache, lihat Fase 3)
  │       getCompositions()
  │       renderMedia({ browserExecutable: msedge, onProgress })
  │
  ├─ exe: cetak JSON per baris   → {"type":"status"|"progress"|"done"|"error"}
  │
  ├─ Rust: baca stdout, update job, emit event ke UI
  │
  └─ selesai: output/*.mp4
```

Kontrak JSON per baris ini **sudah ada** dan sudah diuji (`tool/render.rs` + `studio.rs`). Yang berubah hanya cara memanggilnya.

---

## 7. Fase Kerja

### Fase 1 — Tutup kebocoran internet (±1 jam)
1. `npm i -D @remotion/cli@4.0.540` (masuk `package-lock.json`) **atau** langsung buang Studio
2. Hapus cache `_npx\03f562a46baa5292`
3. **Verifikasi:** putus internet, restart app, panel Studio tetap menyala (kalau Studio belum dibuang)

### Fase 2 — Render tanpa Chrome unduhan (±2 jam)
1. Tambah `browserExecutable` ke `scripts/render.mjs`, deteksi Edge → Chrome → unduh
2. Pindahkan `node_modules/.remotion` (303 MB) ke samping, render ulang
3. **Verifikasi:** render berhasil tanpa folder `chrome-headless-shell`; hasil mp4 tetap 1.090.920 byte

### Fase 3 — Cache bundling (±3 jam)
Bundling 53 detik adalah 56% waktu render. `bundle()` bisa diarahkan ke folder tetap:

```js
await bundle({ entryPoint, outDir: "dist-render/bundle" });
```

Lalu render berikutnya memakai folder itu selama `apps/src/remotion/*` belum berubah (bandingkan mtime).
1. **Verifikasi:** render kedua turun dari 94,7s ke ~40s; hasil mp4 identik

### Fase 4 — Kemas jadi exe (±4 jam)
1. `sea-config.json` → `render-engine.exe`
2. `tauri.conf.json`: `resources` untuk `render/` + `externalBin` kalau pakai Node sidecar
3. `prepare-bundle.cjs` ikut mengemas folder `render/`
4. **Verifikasi:** install di mesin tanpa Node, tanpa internet → render berhasil

### Fase 5 — Buang Studio (±1 jam)
1. Hapus `NexusStudioSuite.tsx`, `handle_ensure_studio_server`, spawn di `src-tauri/src/lib.rs`
2. Ganti dengan `<Player>` kalau preview masih dibutuhkan
3. **Verifikasi:** `netstat` tidak menunjukkan port 3333 setelah app jalan

---

## 8. Kriteria Selesai

```
[ ] Render berhasil di mesin tanpa Node terpasang
[ ] Render berhasil tanpa koneksi internet
[ ] Render berhasil tanpa folder chrome-headless-shell
[ ] Installer tidak menyertakan @remotion/cli
[ ] Tidak ada port 3333 setelah aplikasi jalan
[ ] ffprobe: 1080x1920, 30 fps, 5.00s, h264
[ ] cargo test -p arunaki-engine hijau
[ ] Installer < 260 MB (Node 80 + @remotion 74 + compositor 28 + webpack 14 + sisa)
```

---

## 9. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Edge tidak ada / versi terlalu tua | Render gagal | Deteksi: Edge → Chrome → baru unduh `chrome-headless-shell` |
| Node SEA tidak bisa memuat dependency native | exe gagal start | Uji SEA sebelum Fase 4; kalau gagal, pakai Node sidecar (pilihan B) |
| `resources` Tauri tidak bisa menulis ke folder sendiri | bundling gagal | Arahkan `outDir` ke `%LOCALAPPDATA%`, bukan folder aplikasi |
| Webpack butuh tulis file saat bundling | gagal di Program Files | Cache bundling di `%LOCALAPPDATA%\ArunakiNexus\bundle` |
| Antivirus menandai `render-engine.exe` | user tidak bisa render | Tanda tangani exe, atau pakai Node sidecar |

---

## 10. Kenapa Bukan Renderer Sendiri (catatan keputusan)

Sempat dipertimbangkan: membuang Remotion, menggambar komposisi ke canvas, encode lewat `ffmpeg.exe`. Hasilnya installer ~80 MB, tanpa Node, tanpa Chrome.

Ditolak karena:
- `NexusVideoComposition.tsx` dan semua komposisi harus ditulis ulang sebagai draw call
- Video stok, audio sync, font, dan easing harus diimplementasikan sendiri
- Perkiraan 1–2 minggu, dengan risiko hasil preview ≠ hasil export

Dengan Remotion tetap dipakai, semua itu sudah ada dan sudah terbukti. Biayanya installer lebih besar (~260 MB vs ~80 MB) — itu pertukaran yang diterima.

---

## 11. Lisensi

| Komponen | Lisensi | Catatan |
|---|---|---|
| Remotion | Remotion License | Free License: individu / organisasi ≤3 karyawan. Kamu 2 orang → gratis, termasuk komersial |
| Edge / Chrome | Free redistributable | Edge sudah terpasang di semua Windows 10/11 |
| ffmpeg (di dalam compositor) | LGPL/GPL | Sudah termasuk paket compositor Remotion |
| Kode kita | GPL-3.0-or-later | — |

Karena Remotion tetap dipakai, **Remotion License tetap berlaku**. Yang berubah hanya cara pengemasan, bukan status lisensi.
