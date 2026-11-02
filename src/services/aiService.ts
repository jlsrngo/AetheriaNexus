import { TikTokVideoProps } from "../remotion/types";
import { ModelProvider } from "../types";
import { getActiveProviderId, getActiveModel } from "../lib/models";

export interface GeneratedScript {
  hook: string;
  body: string;
  category: string;
  theme: TikTokVideoProps["themeColor"];
}

const LOCAL_BRIDGE_URL = "http://127.0.0.1:20188";

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
  const activePid = getActiveProviderId();
  const currentModel = getActiveModel(activePid);

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

  // 1. Try Local CLI Bridge (:20188) first if active provider is CLI (antigravity, claude, codex, opencode, kiro)
  const isCli = ["antigravity", "claude", "codex", "opencode", "kiro", "ollama"].includes(activePid) || !activeProvider?.apiKey;

  if (isCli) {
    try {
      const modelId = currentModel?.id || "gemini-3.8-flash-high";
      const res = await fetch(`${LOCAL_BRIDGE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          messages: [
            {
              role: "system",
              content: "Anda adalah JSON generator. Berikan HANYA output JSON murni valid tanpa penjelasan, tanpa format markdown ```json.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const text = json.choices?.[0]?.message?.content;
        if (text) {
          const parsed = parseScript(text);
          return parsed;
        }
      }
    } catch (err) {
      console.warn("[aiService] Local CLI bridge request failed, checking cloud provider:", err);
    }
  }

  // 2. If provider is configured with cloud API Key (Groq, Gemini, DeepSeek, etc.)
  if (activeProvider && activeProvider.apiKey) {
    try {
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
        const endpoint = `${activeProvider.baseUrl.replace(/\/+$/, "")}/chat/completions`;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeProvider.apiKey}`,
        };

        const res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: activeProvider.model,
            messages: [
              {
                role: "system",
                content: "Anda adalah JSON generator. Berikan HANYA output JSON murni valid tanpa penjelasan atau markdown.",
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
      console.warn("[aiService] Cloud provider execution error:", e);
    }
  }

  // 3. Fallback to smart offline template
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
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
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
    // If not valid JSON, extract first line as hook and rest as body
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    return {
      hook: lines[0] || "Ide Konten Viral Hari Ini",
      body: lines.slice(1).join("\n") || "1. Poin Pertama\n2. Poin Kedua\n3. Poin Ketiga",
      category: "AI Script",
      theme: "emerald",
    };
  }
}
