---
name: conspiracy-crime-board
description: "Papan investigasi kejahatan/konspirasi retro arsip: foto polaroid jatuh bertahap, benang merah menyambung antar pin, kaca pembesar vintage memindai muka blur, dan cap stensil rahasia."
tags:
  - remotion
  - investigation
  - crime-board
  - conspiracy
  - archival
  - documentary
command: /conspiracy-crime-board
---

# Conspiracy Crime Board — Visual Archetype & Motion Skill

Gaya visual video investigasi dokumenter / kejahatan arsip (*crime board & classified dossier*) dengan format vertikal 9:16 (1080x1920) yang dirancang untuk TikTok, Reels, dan Shorts.

---

## 🎨 Visual Identity & Palet Desain

1. **Background Permanen (Archival Paper):**
   * Tekstur kertas grid robek vintage dengan serpihan potongan koran kuno dan megafon retro.
   * Filter warna: `blur(2.2px) brightness(0.82) contrast(1.08) sepia(15%)`.
   * Pencahayaan: *Warm spotlight* lembut dari sudut kiri atas (`radial-gradient` kuning gading) dipadu *soft edge vignette*.
2. **Palet Warna:**
   * Latar Meja/Dinding: `#070709` / `#181410` (Dark Umber / Charcoal)
   * Kertas Polaroid & Berkas: `#F5F0E4` (Vintage Aged Parchment)
   * Teks Judul Stensil: `#14110E` (Spray Stencil Black dengan bayangan kasar)
   * Aksen Tinta Investigasi: `#DC2626` / `#B91C1C` (Crime Red Marker)
   * Badge / Police Tape: `#F59E0B` / `#D97706` (Amber Hazard Stripes)
   * Benang Merah SVG: `#D32F2F` (Drop Shadow 3D: `0 2px 5px rgba(0,0,0,0.9)`)
3. **Tipografi Wajib:**
   * **Headline Spray Stensil:** `Anton`, uppercase, tracking tebal (`letter-spacing: 3-4px`).
   * **Tulisan Tangan & Catatan Kasus:** `Caveat`, cursive, sedikit berotasi (`-2deg` s/d `2deg`).
   * **Metadata & Arsip Rahasia:** `Courier Prime`, monospace, uppercase.

---

## 🎬 2 Pola Scene Unggulan (Reference Scenes)

### 📌 Scene A: Papan Konspirasi Berjatuhan (The Conspiracy Web Pinboard)
* **Konsep:** 7 foto polaroid tersusun seimbang di tengah. Kartu berjatuhan satu per satu secara halus, diikuti benang merah yang saling menghubungkan pin di atas foto, ditutup foto hero yang mendarat di atas segalanya.
* **Hierarki Layer (Z-Index Wajib):**
  * `z-index: 1`: Background kertas robek & koran permanen.
  * `z-index: 20 - 26`: 6 Kartu polaroid luar (tersangka, bukti, motif).
  * `z-index: 50`: **Foto Hero Utama (Center)** — *Jatuh paling terakhir dan berada di atas kartu-kartu lainnya*.
  * `z-index: 55`: Memo bawah stensil judul `"YOUR TEXT"` / Judul Kasus.
  * `z-index: 60`: **11 Tali Benang Merah SVG** — *Wajib di atas foto agar terlihat jelas membentang*.
  * `z-index: 70`: **7 Pushpin Merah 3D** — *Menancap di lapisan teratas di atas foto*.
* **Resep Animasi (Motion Spring):**
  ```tsx
  // Smooth Inward Drop per foto
  const spr = spring({
    frame: Math.max(0, frame - card.dropFrame),
    fps: 30,
    config: { damping: 15, stiffness: 80, mass: 0.95 },
  });
  const scale = interpolate(spr, [0, 1], [1.32, 1]);
  const translateY = interpolate(spr, [0, 1], [-240, 0]);
  const rotate = interpolate(spr, [0, 0.7, 1], [baseRot - 10, baseRot + 1.5, baseRot]);
  ```

---

### 🔍 Scene B: Misteri "Tahukah Kamu?" (Magnifying Glass on Blurred Face)
* **Konsep:** Hook membuka kasus dengan kartu polaroid subjek berwajah disensor blur tebal, tanda tanya berdenyut, dan kaca pembesar antik kuningan-kayu yang bergerak memindai wajah seolah mencari identitas aslinya.
* **Komponen Visual:**
  * **Header:** Badge hazard `★ INVESTIGATION DOSSIER ★` + Teks stensil raksasa `"TAHUKAH KAMU?"`.
  * **Foto Polaroid:** Menampilkan foto orang nyata berjas monokrom, diberi sensor blur melingkar di area wajah (`backdrop-filter: blur(20px)`), tanda tanya emas `?` berdenyut (`scale: 1.0 s/d 1.08`).
  * **Kaca Pembesar Vintage PNG:** Model kuningan antik dengan gagang kayu *dark walnut*. Bergerak melayang tanpa tangan dengan kurva pemindaian detektif halus di depan wajah.
* **Resep Gerakan Memindai (Lissajous Detective Scan):**
  ```tsx
  const t = Math.max(0, (frame - 24) / fps);
  // Pola elips dinamis memindai mata dan fitur wajah:
  const scanX = Math.sin(t * 1.7) * 38 + Math.sin(t * 3.2) * 12;
  const scanY = Math.cos(t * 1.3) * 30 + Math.sin(t * 2.6) * 10;
  const tilt = Math.sin(t * 1.7) * 8; // Miringkan kaca pembesar secara natural

  // Terapkan ke kontainer kaca pembesar:
  transform: `translate(${baseX + scanX}px, ${baseY + scanY}px) rotate(${tilt}deg)`;
  ```

---

## 📋 Aturan Implementasi (Do's & Don'ts)

### ✅ LAKUKAN (Do)
1. **Gunakan koordinat simetris di tengah** untuk kanvas 1080x1920 agar komposisi tidak kosong di bagian bawah.
2. **Kunci layer benang dan pin di atas foto:** Pastikan benang merah selalu `z-index >= 60` dan pin `z-index >= 70`.
3. **Posisikan kartu utama jatuh terakhir:** Kartu Hero tengah harus jatuh pada frame 60+ dengan `z-index: 50`.
4. **Berikan efek getaran mikro (tremor):** Saat kartu hero atau judul stensil membentur board, goyangkan kanvas `translateY(Math.sin(...) * 4px)` selama 6-8 frame.

### ❌ JANGAN (Don't)
1. **Dilarang memakai CSS transitions:** Selalu gunakan frame-based math (`spring()` / `interpolate()`).
2. **Dilarang membiarkan tali merah tertutup di belakang foto polaroid.**
3. **Dilarang menggunakan background polos:** Selalu sertakan tekstur koran robek dan soft lighting.

