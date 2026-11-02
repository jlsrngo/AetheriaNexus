export interface TikTokVideoProps {
  hookText: string;
  bodyText: string;
  authorHandle: string;
  themeColor: "emerald" | "violet" | "rose" | "amber" | "cyan";
  category: string;
}

export const defaultTikTokProps: TikTokVideoProps = {
  hookText: "3 Kebiasaan Pagi Orang Sukses Yang Jarang Diketahui",
  bodyText: "1. Minum 500ml air putih sebelum kopi\n2. Olahraga ringan 15 menit\n3. Catat 3 prioritas terpenting hari ini",
  authorHandle: "@arunaki.creator",
  themeColor: "emerald",
  category: "Produktivitas & Sukses",
};

