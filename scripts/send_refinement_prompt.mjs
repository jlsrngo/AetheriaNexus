const promptText = `Evaluasi & Peningkatan Kualitas Style (Integrasi Alex Hormozi Retention + mg-styles-15 Collage Stop-Motion):

Tolong perbarui implementasi adegan di Scene1.tsx s/d Scene7.tsx menggunakan standar motion design baru yang sudah kita sediakan:

1. KINETIC TEXT VIRAL (Hormozi Style dari Pinterest):
   - Ganti subtitle lama dengan <HormoziSubtitle words={TURING_WORDS.sN} top={1380} highlightColor="#FFDE59" /> dari '../components/HormoziSubtitle'.
   - Menghasilkan teks 3-4 kata punchy, active word pop scale (1.18x -> 1.0x) dengan warna kuning lemon terang (#FFDE59), font tebal ber-outline hitam, dan pill container gelap di bawah. Teks dijamin sangat terbaca dan berenergi tinggi!

2. GERAKAN ELEMEN & FISIKA KERTAS (mg-styles-15 Collage Cutout):
   - Gunakan <CollagePiece /> dari '../components/CollagePiece' untuk foto & dokumen arsip:
     <CollagePiece
       id={1}
       src="img_enigma.jpg"
       top={320}
       left={100}
       width={880}
       height={580}
       rotation={-2}
       dropFrame={20}
       hasPin={true}
       pinColor="red"
       stampText="★ TOP SECRET ★"
       stampFrame={40}
     />
   - Ini sudah memiliki fisika slap squash saat mendarat (scale 0.965 lalu memantul), shadow collapse fisik, pinggiran putih bekas gunting (3.5px scissor rim #F4EFE4), dan boil jitter (stop-motion 12fps/6fps) sehingga elemen TIDAK PERNAH beku/diam!

3. KAMERA SNAP-ZOOM & HANDHELD DRIFT:
   - Bungkus konten visual dengan transform cameraSnapZoom dari '../motion/collageMotion':
     const cam = cameraSnapZoom(frame, [0, 55, 120]);
     <div style={{ transform: \`translate3d(\${cam.panX}px, \${cam.panY}px, 0) scale(\${cam.scale})\`, transformOrigin: 'center center' }}>
       ...
     </div>

4. TRANSISI & ATMOSFER:
   - Pertahankan <SceneTransition type="flash" /> di awal scene dan overlay atmosferik (CipherStreamOverlay di S3, BombeGearsOverlay di S4, RainWindowOverlay di S6, ModernAiMatrixOverlay di S7).
   - Jangan lupa <SceneTransition type="fade-black" durationInFrames={meta.durationInFrames} /> di akhir Scene 6.

5. PENTING: JANGAN panggil render_video! Cukup edit file Scene1.tsx s/d Scene7.tsx secara rapi dan pastikan Root.tsx tetap sinkron untuk preview langsung di Studio.`;

async function main() {
  console.log("Mengirimkan prompt pembaruan style ke session ses_1a1c32557424ba4007b...");
  const res = await fetch('http://127.0.0.1:4196/api/session/ses_1a1c32557424ba4007b/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: promptText })
  });
  const data = await res.json();
  console.log('Session prompt response:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
