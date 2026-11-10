import { WordTiming } from "./components/KineticSubtitle";

export const FPS = 30;

export const CANVAS = {
  width: 1080,
  height: 1920,
  fps: 30,
};

export const PALETTE = {
  bg: "#0A0A0C",
  card: "#121215",
  border: "#26262C",
  text: "#FAFAFA",
  textSecondary: "#8E8E98",
  accent: "#F5A623",
  red: "#DC2626",
};

export const FONT = {
  sans: "'Inter', sans-serif",
  mono: "'JetBrains Mono', monospace",
  typewriter: "'Special Elite', monospace",
};

export interface SceneMeta {
  startFrame: number;
  durationInFrames: number;
  audioDurationSec: number;
  audioFile: string;
}

// Durations derived from actual voicebox_speak synthesis (audio + 0.6s breathing buffer)
// S1: 7.935s + 0.6 = 8.535s  -> 256 frames
// S2: 14.195s + 0.6 = 14.795s -> 444 frames
// S3: 13.975s + 0.6 = 14.575s -> 437 frames
// S4: 13.355s + 0.6 = 13.955s -> 419 frames
// S5: 18.795s + 0.6 = 19.395s -> 582 frames
// S6: 8.835s + 0.6 = 9.435s  -> 283 frames
// S7: 18.175s + 0.6 = 18.775s -> 563 frames
export const SCENE_DURATIONS = [
  256, // S1: 8.535s
  444, // S2: 14.795s
  437, // S3: 14.575s
  419, // S4: 13.955s
  582, // S5: 19.395s
  283, // S6: 9.435s
  563, // S7: 18.775s
] as const;

export const TOTAL_FRAMES = 2984;

export const START_FRAMES = SCENE_DURATIONS.reduce<number[]>((acc, dur, i) => {
  if (i === 0) return [0];
  return [...acc, acc[i - 1] + SCENE_DURATIONS[i - 1]];
}, []);

export const TURING_SCENES: Record<string, SceneMeta> = {
  s1: {
    startFrame: START_FRAMES[0],
    durationInFrames: SCENE_DURATIONS[0],
    audioDurationSec: 7.935,
    audioFile: "turing_s1.wav",
  },
  s2: {
    startFrame: START_FRAMES[1],
    durationInFrames: SCENE_DURATIONS[1],
    audioDurationSec: 14.195,
    audioFile: "turing_s2.wav",
  },
  s3: {
    startFrame: START_FRAMES[2],
    durationInFrames: SCENE_DURATIONS[2],
    audioDurationSec: 13.975,
    audioFile: "turing_s3.wav",
  },
  s4: {
    startFrame: START_FRAMES[3],
    durationInFrames: SCENE_DURATIONS[3],
    audioDurationSec: 13.355,
    audioFile: "turing_s4.wav",
  },
  s5: {
    startFrame: START_FRAMES[4],
    durationInFrames: SCENE_DURATIONS[4],
    audioDurationSec: 18.795,
    audioFile: "turing_s5.wav",
  },
  s6: {
    startFrame: START_FRAMES[5],
    durationInFrames: SCENE_DURATIONS[5],
    audioDurationSec: 8.835,
    audioFile: "turing_s6.wav",
  },
  s7: {
    startFrame: START_FRAMES[6],
    durationInFrames: SCENE_DURATIONS[6],
    audioDurationSec: 18.175,
    audioFile: "turing_s7.wav",
  },
};

// ---------------------------------------------------------------------------
// Per-scene word timings extracted from .words.json (start/end in seconds)
// Used by <KineticSubtitle> for speech-synced sliding-window subtitles
// ---------------------------------------------------------------------------

export const TURING_WORDS: Record<string, WordTiming[]> = {
  s1: [
    { word: "Negaranya",    start: 0.0,  end: 0.5  },
    { word: "membutuhkan",  start: 0.48, end: 1.18 },
    { word: "otaknya",      start: 1.16, end: 1.7  },
    { word: "untuk",        start: 1.68, end: 1.98 },
    { word: "memenangkan",  start: 1.96, end: 2.82 },
    { word: "perang.",      start: 2.8,  end: 3.54 },
    { word: "Tapi",         start: 3.52, end: 3.82 },
    { word: "ketika",       start: 3.8,  end: 4.18 },
    { word: "perang",       start: 4.16, end: 4.52 },
    { word: "selesai,",     start: 4.5,  end: 5.3  },
    { word: "justru",       start: 5.28, end: 5.44 },
    { word: "negaranya",    start: 5.42, end: 5.78 },
    { word: "sendiri",      start: 5.76, end: 6.12 },
    { word: "yang",         start: 6.1,  end: 6.28 },
    { word: "menghancurkan",start: 6.26, end: 7.08 },
    { word: "hidupnya.",    start: 7.06, end: 7.94 },
  ],
  s2: [
    { word: "Namanya",       start: 0.0,  end: 0.42 },
    { word: "Alan",          start: 0.4,  end: 0.64 },
    { word: "Turing.",       start: 0.62, end: 1.24 },
    { word: "Seorang",       start: 1.22, end: 1.88 },
    { word: "matematikawan", start: 1.86, end: 2.54 },
    { word: "Inggris",       start: 2.52, end: 2.92 },
    { word: "yang",          start: 2.9,  end: 3.22 },
    { word: "memiliki",      start: 3.2,  end: 3.84 },
    { word: "cara",          start: 3.82, end: 4.06 },
    { word: "berpikir",      start: 4.04, end: 4.72 },
    { word: "jauh",          start: 4.7,  end: 4.86 },
    { word: "melampaui",     start: 4.84, end: 5.32 },
    { word: "zamannya.",     start: 5.3,  end: 6.14 },
    { word: "Saat",          start: 6.12, end: 6.4  },
    { word: "Perang",        start: 6.38, end: 6.76 },
    { word: "Dunia",         start: 6.74, end: 7.0  },
    { word: "Kedua",         start: 6.98, end: 7.36 },
    { word: "pecah,",        start: 7.34, end: 7.9  },
    { word: "kemampuannya",  start: 7.88, end: 8.6  },
    { word: "dibutuhkan",    start: 8.58, end: 9.14 },
    { word: "untuk",         start: 9.12, end: 9.42 },
    { word: "menghadapi",    start: 9.4,  end: 10.02},
    { word: "salah",         start: 10.0, end: 10.3 },
    { word: "satu",          start: 10.28,end: 10.56},
    { word: "senjata",       start: 10.54,end: 10.96},
    { word: "paling",        start: 10.94,end: 11.28},
    { word: "berbahaya",     start: 11.26,end: 11.82},
    { word: "Nazi:",         start: 11.8, end: 12.46},
    { word: "mesin",         start: 12.44,end: 12.78},
    { word: "Enigma.",       start: 12.76,end: 14.2 },
  ],
  s3: [
    { word: "Enigma",        start: 0.0,  end: 0.52 },
    { word: "bukan",         start: 0.5,  end: 0.72 },
    { word: "sekadar",       start: 0.7,  end: 1.2  },
    { word: "mesin",         start: 1.18, end: 1.4  },
    { word: "biasa.",        start: 1.38, end: 1.84 },
    { word: "Alat",          start: 1.82, end: 2.1  },
    { word: "ini",           start: 2.08, end: 2.42 },
    { word: "mengacak",      start: 2.4,  end: 2.78 },
    { word: "pesan",         start: 2.76, end: 3.0  },
    { word: "militer",       start: 2.98, end: 3.32 },
    { word: "Jerman",        start: 3.3,  end: 3.74 },
    { word: "dengan",        start: 3.72, end: 3.96 },
    { word: "sistem",        start: 3.94, end: 4.26 },
    { word: "yang",          start: 4.24, end: 4.44 },
    { word: "sangat",        start: 4.42, end: 4.74 },
    { word: "rumit.",        start: 4.72, end: 5.44 },
    { word: "Bahkan",        start: 5.42, end: 5.72 },
    { word: "ketika",        start: 5.7,  end: 6.0  },
    { word: "pesan",         start: 5.98, end: 6.22 },
    { word: "berhasil",      start: 6.2,  end: 6.6  },
    { word: "disadap,",      start: 6.58, end: 7.26 },
    { word: "isinya",        start: 7.24, end: 7.6  },
    { word: "tetap",         start: 7.58, end: 7.86 },
    { word: "sulit",         start: 7.84, end: 8.1  },
    { word: "dibaca.",       start: 8.08, end: 8.9  },
    { word: "Jika",          start: 8.88, end: 9.1  },
    { word: "kode",          start: 9.08, end: 9.32 },
    { word: "ini",           start: 9.3,  end: 9.5  },
    { word: "tidak",         start: 9.48, end: 9.72 },
    { word: "bisa",          start: 9.7,  end: 9.96 },
    { word: "dipecahkan,",   start: 9.94, end: 10.84},
    { word: "Sekutu",        start: 10.82,end: 11.18},
    { word: "akan",          start: 11.16,end: 11.38},
    { word: "terus",         start: 11.36,end: 11.68},
    { word: "berada",        start: 11.66,end: 12.1 },
    { word: "dalam",         start: 12.08,end: 12.4 },
    { word: "bahaya.",       start: 12.38,end: 13.98},
  ],
  s4: [
    { word: "Turing",        start: 0.0,  end: 0.28 },
    { word: "kemudian",      start: 0.26, end: 0.62 },
    { word: "mengembangkan", start: 0.6,  end: 1.34 },
    { word: "mesin",         start: 1.32, end: 1.62 },
    { word: "bernama",       start: 1.6,  end: 2.02 },
    { word: "Bombe.",        start: 2.0,  end: 2.6  },
    { word: "Bersama",       start: 2.58, end: 3.26 },
    { word: "para",          start: 3.24, end: 3.5  },
    { word: "pemecah",       start: 3.48, end: 4.0  },
    { word: "kode",          start: 3.98, end: 4.16 },
    { word: "lainnya,",      start: 4.14, end: 4.58 },
    { word: "ia",            start: 4.56, end: 4.8  },
    { word: "membantu",      start: 4.78, end: 5.22 },
    { word: "menemukan",     start: 5.2,  end: 5.74 },
    { word: "pengaturan",    start: 5.72, end: 6.3  },
    { word: "Enigma",        start: 6.28, end: 6.76 },
    { word: "dan",           start: 6.74, end: 6.94 },
    { word: "membaca",       start: 6.92, end: 7.38 },
    { word: "komunikasi",    start: 7.36, end: 8.02 },
    { word: "rahasia",       start: 8.0,  end: 8.42 },
    { word: "Jerman.",       start: 8.4,  end: 9.2  },
    { word: "Pekerjaan",     start: 9.18, end: 9.74 },
    { word: "ini",           start: 9.72, end: 9.96 },
    { word: "membantu",      start: 9.94, end: 10.44},
    { word: "Sekutu",        start: 10.42,end: 10.84},
    { word: "mengambil",     start: 10.82,end: 11.36},
    { word: "keputusan",     start: 11.34,end: 11.9 },
    { word: "penting",       start: 11.88,end: 12.32},
    { word: "dalam",         start: 12.3, end: 12.62},
    { word: "perang.",       start: 12.6, end: 13.36},
  ],
  s5: [
    { word: "Tapi",          start: 0.0,  end: 0.4  },
    { word: "setelah",       start: 0.38, end: 0.94 },
    { word: "perang,",       start: 0.92, end: 1.56 },
    { word: "kisahnya",      start: 1.54, end: 1.86 },
    { word: "berubah",       start: 1.84, end: 2.28 },
    { word: "drastis.",      start: 2.26, end: 3.4  },
    { word: "Pada",          start: 3.38, end: 3.62 },
    { word: "1952,",         start: 3.6,  end: 4.02 },
    { word: "Turing",        start: 4.0,  end: 4.32 },
    { word: "dihukum",       start: 4.3,  end: 4.58 },
    { word: "karena",        start: 4.56, end: 4.88 },
    { word: "hubungan",      start: 4.86, end: 5.3  },
    { word: "homoseksual,",  start: 5.28, end: 6.26 },
    { word: "yang",          start: 6.24, end: 6.46 },
    { word: "saat",          start: 6.44, end: 6.66 },
    { word: "itu",           start: 6.64, end: 6.84 },
    { word: "masih",         start: 6.82, end: 7.1  },
    { word: "dianggap",      start: 7.08, end: 7.48 },
    { word: "tindak",        start: 7.46, end: 7.74 },
    { word: "pidana",        start: 7.72, end: 8.1  },
    { word: "di",            start: 8.08, end: 8.22 },
    { word: "Inggris.",      start: 8.2,  end: 9.0  },
    { word: "Ia",            start: 8.98, end: 9.2  },
    { word: "dipaksa",       start: 9.18, end: 9.68 },
    { word: "menjalani",     start: 9.66, end: 10.26},
    { word: "terapi",        start: 10.24,end: 10.68},
    { word: "hormon",        start: 10.66,end: 11.12},
    { word: "yang",          start: 11.1, end: 11.3 },
    { word: "dikenal",       start: 11.28,end: 11.76},
    { word: "sebagai",       start: 11.74,end: 12.1 },
    { word: "chemical",      start: 12.08,end: 12.6 },
    { word: "castration.",   start: 12.58,end: 13.72},
    { word: "Orang",         start: 13.7, end: 14.0 },
    { word: "yang",          start: 13.98,end: 14.2 },
    { word: "membantu",      start: 14.18,end: 14.68},
    { word: "negaranya",     start: 14.66,end: 15.2 },
    { word: "justru",        start: 15.18,end: 15.56},
    { word: "menjadi",       start: 15.54,end: 15.96},
    { word: "korban",        start: 15.94,end: 16.34},
    { word: "hukum",         start: 16.32,end: 16.7 },
    { word: "negaranya",     start: 16.68,end: 17.3 },
    { word: "sendiri.",      start: 17.28,end: 18.8 },
  ],
  s6: [
    { word: "Pada",          start: 0.0,  end: 0.4  },
    { word: "7",             start: 0.38, end: 0.54 },
    { word: "Juni",          start: 0.52, end: 0.76 },
    { word: "1954,",         start: 0.74, end: 1.14 },
    { word: "Alan",          start: 1.12, end: 1.42 },
    { word: "Turing",        start: 1.4,  end: 1.84 },
    { word: "meninggal",     start: 1.82, end: 2.54 },
    { word: "dunia",         start: 2.52, end: 2.78 },
    { word: "di",            start: 2.76, end: 2.88 },
    { word: "usia",          start: 2.86, end: 3.12 },
    { word: "41",            start: 3.1,  end: 3.22 },
    { word: "tahun.",        start: 3.2,  end: 3.84 },
    { word: "Kematiannya",   start: 3.82, end: 4.84 },
    { word: "dinyatakan",    start: 4.82, end: 5.52 },
    { word: "sebagai",       start: 5.5,  end: 5.9  },
    { word: "bunuh",         start: 5.88, end: 6.14 },
    { word: "diri",          start: 6.12, end: 6.42 },
    { word: "oleh",          start: 6.4,  end: 6.64 },
    { word: "penyelidik",    start: 6.62, end: 7.26 },
    { word: "saat",          start: 7.24, end: 7.56 },
    { word: "itu.",          start: 7.54, end: 8.84 },
  ],
  s7: [
    { word: "Hari",          start: 0.0,  end: 0.34 },
    { word: "ini,",          start: 0.32, end: 0.58 },
    { word: "dunia",         start: 0.56, end: 0.88 },
    { word: "komputasi",     start: 0.86, end: 1.4  },
    { word: "dan",           start: 1.38, end: 1.6  },
    { word: "kecerdasan",    start: 1.58, end: 2.32 },
    { word: "buatan",        start: 2.3,  end: 2.72 },
    { word: "berdiri",       start: 2.7,  end: 3.22 },
    { word: "di",            start: 3.2,  end: 3.28 },
    { word: "atas",          start: 3.26, end: 3.46 },
    { word: "gagasan",       start: 3.44, end: 3.98 },
    { word: "yang",          start: 3.96, end: 4.14 },
    { word: "ikut",          start: 4.12, end: 4.36 },
    { word: "ia",            start: 4.34, end: 4.5  },
    { word: "bangun.",       start: 4.48, end: 5.4  },
    { word: "Pada",          start: 5.38, end: 5.68 },
    { word: "2013,",         start: 5.66, end: 6.24 },
    { word: "Inggris",       start: 6.22, end: 6.68 },
    { word: "akhirnya",      start: 6.66, end: 7.14 },
    { word: "memberikan",    start: 7.12, end: 7.74 },
    { word: "pengampunan",   start: 7.72, end: 8.44 },
    { word: "kerajaan",      start: 8.42, end: 8.96 },
    { word: "kepadanya.",    start: 8.94, end: 9.98 },
    { word: "Tapi",          start: 9.96, end: 10.26},
    { word: "ada",           start: 10.24,end: 10.48},
    { word: "satu",          start: 10.46,end: 10.74},
    { word: "pertanyaan",    start: 10.72,end: 11.36},
    { word: "yang",          start: 11.34,end: 11.56},
    { word: "tersisa...",    start: 11.54,end: 12.68},
    { word: "berapa",        start: 12.66,end: 13.0 },
    { word: "banyak",        start: 12.98,end: 13.3 },
    { word: "orang",         start: 13.28,end: 13.58},
    { word: "jenius",        start: 13.56,end: 14.0 },
    { word: "yang",          start: 13.98,end: 14.2 },
    { word: "harus",         start: 14.18,end: 14.52},
    { word: "kehilangan",    start: 14.5, end: 15.14},
    { word: "hidupnya",      start: 15.12,end: 15.62},
    { word: "sebelum",       start: 15.6, end: 16.04},
    { word: "dunia",         start: 16.02,end: 16.32},
    { word: "belajar",       start: 16.3, end: 16.74},
    { word: "menghargai",    start: 16.72,end: 17.4 },
    { word: "perbedaan?",    start: 17.38,end: 18.18},
  ],
};

export type WordCue = WordTiming;
