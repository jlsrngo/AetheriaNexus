// Script to launch fresh E2E test with Multi-Agent /mg-cutout-collage
const API_URL = 'http://127.0.0.1:4196';

async function main() {
  console.log('1. Creating fresh E2E session with model kiro/auto...');
  const createRes = await fetch(`${API_URL}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Alan Turing - Multiagent Cutout Collage E2E',
      model: { providerID: 'local-cli', id: 'kiro/auto' },
      agent: 'default',
      location: { directory: 'E:\\JS\\ArunakiNexus' }
    })
  });
  const sessionData = await createRes.json();
  const sessionId = sessionData.data?.id;
  console.log('✅ Created session:', sessionId);

  const e2ePrompt = `Kamu adalah Studio Director untuk produksi video Remotion Nexus.
Kerjakan storyboard dokumenter sejarah gelap Alan Turing ini dengan membagi tugas per spesialis (Multi-Agent workflow) menggunakan style baru: /mg-cutout-collage

# STORYBOARD DOKUMENTER: ALAN TURING
Judul: "Dia Menyelamatkan Dunia, Tapi Dunia Tidak Menyelamatkannya"
Format: 9:16 Vertikal (1080x1920), 30fps
Style: /mg-cutout-collage (Buka & pelajari .aetheria/skills/mg-cutout-collage/SKILL.md)

### ALUR KERJA TIM MULTI-AGENT:
1. 🎙️ [Audio Producer]:
   - Pastikan voiceover audio turing_s1.wav s/d turing_s7.wav dan stempel waktu turing_s*.words.json di workspace/public/ siap dipakai.
   - Laporkan durasi presisi tiap adegan.

2. 🎨 [Motion Engineer]:
   - Gunakan komponen fisika cutout & kinetik dari skill:
     * <CollagePiece /> dari '../components/CollagePiece' (memiliki slap physics, 3.5px scissor rim #F4EFE4, shadow collapse, cork pin, stop-motion boil jitter 12fps).
     * <HormoziSubtitle /> dari '../components/HormoziSubtitle' (speech-synced 3-4 kata, active word pop 1.18x -> 1.0x kuning lemon #FFDE59).
     * cameraSnapZoom() dan boilJitter() dari '../motion/collageMotion'.
   - Perbarui/tulis Scene1.tsx s/d Scene7.tsx di workspace/src/scenes/ (< 250 baris per file).
   - Pastikan workspace/src/Root.tsx mendaftarkan ketujuh adegan secara sinkron.

3. 🎬 [Studio Director]:
   - Berikan ringkasan per adegan dan status kelayakan video di Studio Player.
   - PENTING: DILARANG memanggil render_video! Video disiapkan untuk interaktif preview di Remotion Studio.

Mulai eksekusi sekarang! Gunakan tool write / edit untuk memperbarui scene files.`;

  console.log('2. Sending prompt to session...');
  const promptRes = await fetch(`${API_URL}/api/session/${sessionId}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: e2ePrompt })
  });
  const promptData = await promptRes.json();
  console.log('✅ Prompt dispatched:', JSON.stringify(promptData, null, 2));
  console.log(`\nStudio URL: http://127.0.0.1:5173/?chatId=${sessionId}`);
}

main().catch(console.error);
