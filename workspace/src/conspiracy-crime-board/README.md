# Conspiracy Crime Board — Remotion Video Template (9:16)

Template video Remotion bernuansa **Papan Investigasi Kriminal / Konspirasi Arsip Rahasia** dengan format vertikal 9:16 (1080x1920) yang dirancang untuk TikTok, Reels, dan YouTube Shorts.

---

## 📁 Struktur Folder Modular

```text
conspiracy-crime-board/
├── ConspiracyCrimeBoardComposition.tsx  # Komposisi utama Remotion (Series urutan scene)
├── index.ts                             # Public barrel export
├── types.ts                             # Antarmuka TypeScript & konstanta durasi/resolusi
├── README.md                            # Panduan penggunaan & kustomisasi
├── components/
│   ├── ArchivalBackground.tsx           # Background permanen kertas robek + koran + megafon (blur & darkened)
│   ├── ConspiracyPinboard.tsx           # 7 slot foto polaroid jatuh smooth, tali merah (Z-60), pushpin 3D (Z-70)
│   └── BottomArchivalTitle.tsx          # Card arsip bawah dengan klip kertas, tanggal merah, & teks stensil "YOUR TEXT"
└── scenes/
    └── Scene1Hook.tsx                   # Scene 1: Papan Investigasi Pembuka (Hook 6 detik / 180 frame)
```

---

## 🎬 Fitur Utama Scene 1

1. **Background Permanen Otentik:**
   * Tekstur kertas grid robek, megafon retro, dan tepi potongan koran archival.
   * Dilengkapi efek blur lembut (2.2px), pencahayaan warm spotlight dari sudut kiri atas, dan vignette gelap.
2. **Animasi Jatuh Berurutan (*Smooth Spring Physics*):**
   * Kartu foto polaroid jatuh dari atas secara bergantian dengan rotasi acak dan peredaman pegas natural.
   * **Foto Utama (Hero):** Jatuh paling terakhir (frame 60) dan menempati layer teratas di bagian tengah (`z-index: 50`).
3. **Jaring Benang Merah Dinamis (*Z-Index 60*):**
   * 11 garis tali merah ditarik otomatis dari pin ke pin saat kartu mendarat, membentuk formasi sarang laba-laba investigasi di atas foto.
4. **Pushpin Merah 3D (*Z-Index 70*):**
   * Menancap dengan efek popping scale dan drop shadow di lapisan teratas.
5. **Bagian Judul Bawah:**
   * Judul stensil hitam pekat yang dapat diubah (`title="YOUR TEXT"`), tanggal bertinta merah dilingkari spidol (`dateMarker="2024"`), dan subtitle investigasi.

---

## ⚙️ Cara Menggunakan / Menyesuaikan Data

### 1. Mengubah Teks Judul & Tanggal
Buka `Scene1Hook.tsx` atau pass via `scene1Props`:
```tsx
<Scene1Hook
  title="MISTERI 1939"
  dateMarker="1939"
  subnote="Kasus Kode Rahasia Enigma // Bletchley Park"
/>
```

### 2. Memasang Foto Nyata ke Slot Polaroid
Isi field `photoUrl` pada array `cards`:
```tsx
import { staticFile } from "remotion";

const myCards = DEFAULT_CONSPIRACY_CARDS.map((card, idx) => {
  if (card.id === "pinHero") {
    return { ...card, photoUrl: staticFile("hero_photo.jpg") };
  }
  return { ...card, photoUrl: staticFile(`suspect_${idx + 1}.jpg`) };
});

<Scene1Hook cards={myCards} />
```

---

## ➕ Cara Menambahkan Scene 2, 3, dst.

Cukup buat file baru di dalam folder `scenes/` (misalnya `scenes/Scene2EvidenceZoom.tsx`), lalu daftarkan ke dalam `<Series>` di `ConspiracyCrimeBoardComposition.tsx`:

```tsx
<Series>
  {/* Scene 1: Papan Pembuka (180 frame = 6 detik) */}
  <Series.Sequence durationInFrames={180}>
    <Scene1Hook {...scene1Props} />
  </Series.Sequence>

  {/* Scene 2: Zoom Detail Barang Bukti (150 frame = 5 detik) */}
  <Series.Sequence durationInFrames={150}>
    <Scene2EvidenceZoom />
  </Series.Sequence>
</Series>
```
Total durasi video di `types.ts` tinggal disesuaikan dengan akumulasi seluruh frame scene.

