import { TikTokVideoProps } from "../remotion/types";

export interface GeneratedScript {
  hook: string;
  body: string;
  category: string;
  theme: TikTokVideoProps["themeColor"];
}

const OFFLINE_TEMPLATES: GeneratedScript[] = [
  {
    hook: "3 Kebiasaan Pagi Orang Sukses yang Mengubah Segalanya",
    body: "1. Minum 500ml air mineral sebelum menyentuh HP\n2. Stretching ringan 10 menit untuk aliran darah\n3. Catat 1 prioritas terpenting hari ini",
    category: "Produktivitas",
    theme: "emerald",
  },
  {
    hook: "Trik Psikologi 3 Detik: Cara Buat Orang Langsung Percaya",
    body: "1. Ulangi 3 kata terakhir yang mereka ucapkan\n2. Gunakan nada bicara rendah dan tenang\n3. Jangan potong kalimat sampai ada jeda",
    category: "Psikologi",
    theme: "violet",
  },
  {
    hook: "Rahasia FYP 2026: 3 Format Video Paling Disukai Algoritma",
    body: "1. Hook visual kontras di 1.5 detik pertama\n2. Teks vertikal mudah dibaca tanpa suara\n3. Call to Action yang memancing perdebatan di komentar",
    category: "Tips TikTok",
    theme: "cyan",
  },
  {
    hook: "Aturan 50/30/20 Cara Kelola Gaji Agar Punya Aset Nyata",
    body: "1. 50% untuk kebutuhan pokok tanpa kompromi\n2. 30% untuk tabungan dan investasi leher ke atas\n3. 20% untuk keinginan dan hiburan terkontrol",
    category: "Finansial",
    theme: "amber",
  },
  {
    hook: "Tanda Bahaya Tubuhmu Mengalami Burnout Kronis",
    body: "1. Bangun tidur tetap merasa sangat lelah\n2. Mudah marah pada masalah sepele\n3. Kehilangan minat pada hobi favorit",
    category: "Kesehatan",
    theme: "rose",
  },
];

export async function generateContentScript(
  topic?: string,
  apiKey?: string
): Promise<GeneratedScript> {
  // If API key is provided and valid, call Google Gemini 2.5 Flash
  if (apiKey && apiKey.trim().length > 10) {
    try {
      const prompt = `Anda adalah ahli video viral TikTok. Buat 1 naskah video vertikal 9:16 durasi 5 detik berdasarkan topik: "${
        topic || "Pengembangan Diri dan Sukses"
      }".
Format jawaban WAJIB JSON persis seperti ini tanpa markdown:
{
  "hook": "Hook kontroversial atau bikin penasaran (maksimal 10 kata)",
  "body": "Poin 1\\nPoin 2\\nPoin 3",
  "category": "Kategori Singkat",
  "theme": "emerald"
}
Catatan untuk theme pilih salah satu: emerald, violet, rose, amber, cyan.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.7,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return {
            hook: parsed.hook || "Ide Konten Viral Hari Ini",
            body: parsed.body || "1. Poin Pertama\n2. Poin Kedua\n3. Poin Ketiga",
            category: parsed.category || "Edukasi",
            theme: ["emerald", "violet", "rose", "amber", "cyan"].includes(parsed.theme)
              ? parsed.theme
              : "emerald",
          };
        }
      }
    } catch (e) {
      console.warn("Gemini API call failed, falling back to local engine:", e);
    }
  }

  // Offline intelligent template matching
  if (topic && topic.trim().length > 0) {
    return {
      hook: `3 Rahasia Penting Seputar ${topic.trim()}`,
      body: `1. Pahami pola dasar sebelum mulai\n2. Konsistensi kecil lebih baik dari lonjakan besar\n3. Evaluasi metrik mingguan secara terukur`,
      category: topic.trim().slice(0, 16),
      theme: "cyan",
    };
  }

  const randomIndex = Math.floor(Math.random() * OFFLINE_TEMPLATES.length);
  return OFFLINE_TEMPLATES[randomIndex];
}

