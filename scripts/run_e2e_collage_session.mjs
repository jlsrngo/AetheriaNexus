const sessionId = 'ses_1a1c3adb90f4de008a2';

const promptText = `Tolong buatkan video dokumenter vertikal 9:16 (1080x1920) berdasarkan storyboard ini dengan style baru: /mg-cutout-collage

# STORYBOARD VIDEO — ALAN TURING
Judul: Dia Menyelamatkan Dunia, Tapi Dunia Tidak Menyelamatkannya
Genre: Dark History / Surreal Archival Cutout
Style: /mg-cutout-collage (Buka & pelajari .aetheria/skills/mg-cutout-collage/SKILL.md)

### ATURAN UTAMA DARI SKILL mg-cutout-collage:
1. Pelajari .aetheria/skills/mg-cutout-collage/SKILL.md:
   - Estetika Dada / Surrealist Monty-Python Cutout Collage dengan sentuhan editorial magazine modern.
   - Ground: kraft paper / newsprint texture / dark noir archive ground.
   - Foto arsip memiliki pinggiran putih bekas guntingan (scissor cutout white rim 3.5px #F4EFE4) + drop shadow.
   - Fisika bantingan slap (drop from air, squash impact scale 0.965, pantulan elastis, shadow collapse).
   - Animasi stop-motion ber-boil jitter (12fps saat bergerak, 6fps saat diam) menggunakan helper yang ada di workspace/src/motion/collageMotion.ts.
   - Tipografi tebal konstruktivis / stencil diagonal / stempel merah-hitam.
   - Subtitle kinetik speech-synced kata-per-kata yang bergerak lincah (gunakan <HormoziSubtitle /> atau <KineticSubtitle />).

2. ASSET AUDIO & GAMBAR:
   - File audio voiceover narasi sudah siap di apps/public/ & workspace/public/:
     turing_s1.wav s/d turing_s7.wav beserta file stempel waktu per kata turing_s*.words.json.
   - File gambar arsip sejarah sudah siap di workspace/public/:
     img_enigma.jpg, img_alan_turing.jpg, img_europe_battle_map.jpg, img_uboat.jpg, img_bombe.jpg, img_bletchley.jpg, img_court_trial_1952.jpg, img_turing_obe.jpg, img_turing_statue.jpg, img_modern_supercomputer.jpg.

3. SCENE BREAKDOWN (7 Scenes):
   - SCENE 1 (Hook 00:00-00:10): Mesin Enigma bergerak/slap, suasana perang, stempel ★ TOP SECRET // GC&CS ★, teks hook.
   - SCENE 2 (Who is He 00:10-00:22): Foto Alan Turing muda bertepi gunting + buku matematika Bletchley + stempel DECLASSIFIED.
   - SCENE 3 (The Invisible Enemy 00:22-00:38): Peta perang Eropa + kapal selam Jerman U-Boat + <CipherStreamOverlay />.
   - SCENE 4 (The Secret Weapon 00:38-00:53): Mesin Bombe + <BombeGearsOverlay /> gir mekanik berputar + stempel CODE BROKEN.
   - SCENE 5 (The Dark Irony 00:53-01:12): Dokumen pengadilan 1952 + stempel GUILTY + sensor redaction bars 'chemical castration'.
   - SCENE 6 (The Tragic End 01:12-01:25): Patung Alan Turing + <RainWindowOverlay /> tetesan air hujan di kaca + transisi fade-to-black.
   - SCENE 7 (The Final Message 01:25-01:38): Supercomputer modern + <ModernAiMatrixOverlay /> + stempel ROYAL PARDON + kartu pertanyaan penutup untuk audiens.

4. KETENTUAN TEKNIS:
   - Tulis komponen scene modular di workspace/src/scenes/Scene1.tsx s/d Scene7.tsx (< 250 baris per file).
   - Pastikan workspace/src/Root.tsx mendaftarkan semua 7 scene dengan durasi tepat sesuai metadata types.ts.
   - DILARANG memanggil render_video! Tugas selesai saat semua kode React Remotion siap dan terverifikasi untuk preview di Studio player.`;

async function run() {
  console.log(`Mengirim instruksi E2E ke session ${sessionId}...`);
  const res = await fetch(`http://127.0.0.1:4196/api/session/${sessionId}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: promptText })
  });
  const data = await res.json();
  console.log('Prompt response:', JSON.stringify(data, null, 2));
}

run().catch(console.error);

