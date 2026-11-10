const sessionId = 'ses_1a1c3adb90f4de008a2';

const followUpPrompt = `Lanjutkan sekarang! Eksekusi tool call untuk menulis dan memperbarui kode:
1. Tulis workspace/src/scenes/Scene1.tsx sampai Scene7.tsx menggunakan komponen <CollagePiece />, <HormoziSubtitle />, boilJitter, slapPhysics, dan cameraSnapZoom sesuai spesifikasi /mg-cutout-collage.
2. Perbarui workspace/src/Root.tsx agar merender semua 7 scene dengan durasi tepat.
3. Jalankan pembaruan file sekarang menggunakan tool edit atau write!`;

async function run() {
  console.log(`Mengirim perintah eksekusi ke session ${sessionId}...`);
  const res = await fetch(`http://127.0.0.1:4196/api/session/${sessionId}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: followUpPrompt })
  });
  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

run().catch(console.error);

