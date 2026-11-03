export interface NexusVideoProps extends Record<string, unknown> {
  hookText: string;
  bodyText: string;
  authorHandle: string;
  themeColor: "emerald" | "violet" | "rose" | "amber" | "cyan";
  category: string;
  subCategory?: string;
  showText?: boolean;
  showBackground?: boolean;
  isMuted?: boolean;
}

/**
 * Backward compatibility alias for legacy references
 */
export type TikTokVideoProps = NexusVideoProps;

export const defaultNexusVideoProps: NexusVideoProps = {
  hookText: "3 Morning Habits of High Performers You Never Knew",
  bodyText: "1. Drink 500ml of mineral water before checking your phone\n2. 10 minutes of light stretching to boost mental focus\n3. Write down your single most critical priority for today",
  authorHandle: "@nexus.creative",
  themeColor: "emerald",
  category: "PRODUCTIVITY",
  subCategory: "EXECUTIVE HABITS",
};

export const defaultTikTokProps: NexusVideoProps = defaultNexusVideoProps;
