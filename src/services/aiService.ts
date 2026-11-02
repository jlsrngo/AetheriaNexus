import { TikTokVideoProps } from "../remotion/types";
import { ModelProvider } from "../types";

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
  activeProvider?: ModelProvider
): Promise<GeneratedScript> {
  const prompt = `Anda adalah AI Creative Director spesialis video pendek TikTok vertikal 9:16 durasi 5 detik.
Buatkan 1 naskah konten berdasarkan topik: "${topic || "Produktivitas dan Sukses"}".
WAJIB format respon JSON murni tanpa markdown, tanpa backtick:
{
  "hook": "Hook tajam atau bikin penasaran maks 10 kata",
  "body": "1. Poin Pertama\\n2. Poin Kedua\\n3. Poin Ketiga",
  "category": "Kategori Singkat",
  "theme": "emerald"
}
Pilihan theme HANYA salah satu: emerald, violet, rose, amber, cyan.`;

  // 1. If provider is configured
  if (activeProvider && (activeProvider.apiKey || activeProvider.type === "ollama" || activeProvider.type === "lmstudio")) {
    try {
      // If Gemini official direct endpoint
      if (activeProvider.type === "gemini" && !activeProvider.baseUrl.includes("/openai")) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeProvider.model || "gemini-2.5-flash"}:generateContent?key=${activeProvider.apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return parseScript(text);
        }
      } else {
        // Universal OpenAI-compatible chat completions (Groq, DeepSeek, OpenRouter, OpenAI, Ollama, LMStudio)
        const endpoint = `${activeProvider.baseUrl.replace(/\/+$/, "")}/chat/completions`;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (activeProvider.apiKey) {
          headers["Authorization"] = `Bearer ${activeProvider.apiKey}`;
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: activeProvider.model,
            messages: [
              {
                role: "system",
                content: "Anda adalah JSON generator. Berikan output JSON murni valid tanpa penjelasan atau markdown.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.7,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const text = json.choices?.[0]?.message?.content;
          if (text) return parseScript(text);
        }
      }
    } catch (e) {
      console.warn("AI Provider execution error, falling back to smart local template:", e);
    }
  }

  // 2. Fallback to smart offline template
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

function parseScript(raw: string): GeneratedScript {
  try {
    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      hook: parsed.hook || "Ide Konten Viral Hari Ini",
      body: parsed.body || "1. Poin Pertama\n2. Poin Kedua\n3. Poin Ketiga",
      category: parsed.category || "Edukasi",
      theme: ["emerald", "violet", "rose", "amber", "cyan"].includes(parsed.theme)
        ? parsed.theme
        : "emerald",
    };
  } catch {
    return {
      hook: "Ide Konten Viral Hari Ini",
      body: "1. Poin Pertama\n2. Poin Kedua\n3. Poin Ketiga",
      category: "Edukasi",
      theme: "emerald",
    };
  }
}
