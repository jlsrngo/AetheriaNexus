export interface NexusVideoProps extends Record<string, unknown> {
  hookText: string;
  bodyText: string;
  authorHandle: string;
  themeColor: "emerald" | "violet" | "rose" | "amber" | "cyan";
  category: string;
  subCategory?: string;
}

/**
 * Backward compatibility alias for legacy references
 */
export type TikTokVideoProps = NexusVideoProps;

export const defaultNexusVideoProps: NexusVideoProps = {
  hookText: "3 Kebiasaan Pagi Orang Sukses Yang Jarang Diketahui",
  bodyText: "1. Minum 500ml air mineral sebelum menyentuh HP\n2. Stretching ringan 10 menit untuk aliran darah\n3. Catat 1 prioritas terpenting hari ini",
  authorHandle: "@arunaki.director",
  themeColor: "emerald",
  category: "PRODUKTIVITAS",
  subCategory: "STRATEGI EKSEKUTIF",
};

export const defaultTikTokProps: NexusVideoProps = defaultNexusVideoProps;
