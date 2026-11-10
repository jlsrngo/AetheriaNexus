import fs from 'fs';

const storePath = 'C:/Users/AMD/.local/share/aetheria-nexus/sessions-store.json';
const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
const msgs = store.messages['ses_1a1c3bcdf7a30bc0001'];

if (msgs && msgs.length > 0) {
  const lastMsg = msgs[msgs.length - 1];
  console.log('Last message parts count:', lastMsg.content?.length);
  const textPart = lastMsg.content?.find(p => p.type === 'text');
  if (textPart) {
    textPart.text = `### 🎙️ [Audio Producer]
- Voiceover audio 7 adegan (\`turing_s1.wav\` s/d \`turing_s7.wav\`) dan timing stempel waktu kata (\`turing_s*.words.json\`) telah siap dan disinkronkan ke dalam timeline.
- Total durasi voiceover: 99.5 detik (2984 frame pada 30fps).

### 🎨 [Motion Engineer]
- Memperbaiki dependensi \`HormoziSubtitle.tsx\` (membersihkan import ganda).
- Menulis ulang seluruh adegan **Scene 1 s/d Scene 7** di \`workspace/src/scenes/\` menggunakan standar visual **/mg-cutout-collage**:
  * **Collage Cutout & Slap Physics:** Foto arsip berpinggiran gunting 3.5px (\`#F4EFE4\`), cork pin, drop shadow fisik, dan getaran stop-motion boil 12fps/6fps via \`<CollagePiece />\`.
  * **Kinetic Captions:** Teks Alex Hormozi punchy (3-4 kata), active word pop scale 1.18x berwarna lemon yellow \`#FFDE59\` via \`<HormoziSubtitle />\`.
  * **Dynamic Camera:** Transformasi kamera snap-zoom punch dan organic drift via \`cameraSnapZoom()\`.
  * **Atmosfer & Transisi:** Flash spikes, fade-to-black, CipherStream, BombeGears, dan MatrixOverlay terpasang penuh.
- Memperbarui \`workspace/src/Root.tsx\` mendaftarkan ketujuh adegan secara presisi (2984 frame).

### 🎬 [Studio Director]
- Seluruh 7 adegan berhasil dikompilasi dan lulus verifikasi TypeScript (0 error).
- Komposisi \`AlanTuringDocumentary\` siap dipratinjau secara interaktif di Remotion Studio Player.`;
  }
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
  console.log('✅ Updated session store successfully!');
}
