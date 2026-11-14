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

export function shouldAutoScrollChat({
  distanceFromBottom,
  isPinnedToBottom,
  forceScroll = false,
}: AutoScrollDecisionInput): boolean {
  if (forceScroll) return true;
  if (!isPinnedToBottom) return false;
  return distanceFromBottom < DEFAULT_CHAT_BOTTOM_THRESHOLD_PX || isPinnedToBottom;
}
