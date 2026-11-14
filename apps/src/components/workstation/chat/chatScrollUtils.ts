export interface ChatScrollMetrics {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

export interface AutoScrollDecisionInput {
  distanceFromBottom: number;
  isPinnedToBottom: boolean;
  forceScroll?: boolean;
}

export interface ChatScrollState {
  isPinned: boolean;
  scrollTop: number;
  scrollHeight: number;
}

export const DEFAULT_CHAT_BOTTOM_THRESHOLD_PX = 120;

export function getDistanceFromBottom(metrics: ChatScrollMetrics): number {
  return Math.max(0, metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight);
}

export function isNearChatBottom(
  metrics: ChatScrollMetrics,
  thresholdPx = DEFAULT_CHAT_BOTTOM_THRESHOLD_PX
): boolean {
  return getDistanceFromBottom(metrics) <= thresholdPx;
}

export function resolveChatScrollState(
  prev: ChatScrollState,
  metrics: ChatScrollMetrics
): ChatScrollState {
  if (isNearChatBottom(metrics)) {
    return {
      isPinned: true,
      scrollTop: metrics.scrollTop,
      scrollHeight: metrics.scrollHeight,
    };
  }
  const grewWithoutUpwardScroll =
    metrics.scrollHeight > prev.scrollHeight + 4 && metrics.scrollTop >= prev.scrollTop - 2;
  return {
    isPinned: grewWithoutUpwardScroll ? prev.isPinned : false,
    scrollTop: metrics.scrollTop,
    scrollHeight: metrics.scrollHeight,
  };
}

export function shouldAutoScrollChat({
  distanceFromBottom,
  isPinnedToBottom,
  forceScroll = false,
}: AutoScrollDecisionInput): boolean {
  if (forceScroll) return true;
  if (!isPinnedToBottom) return false;
  return distanceFromBottom < DEFAULT_CHAT_BOTTOM_THRESHOLD_PX || isPinnedToBottom;
}
