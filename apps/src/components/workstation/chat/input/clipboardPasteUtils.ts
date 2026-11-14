export function markPasteEventOnce(
  seenEvents: WeakSet<Event>,
  nativeEvent?: Event | null
): boolean {
  if (!nativeEvent) return true;
  if (seenEvents.has(nativeEvent)) return false;
  seenEvents.add(nativeEvent);
  return true;
}

export function shouldProbeDesktopClipboardImage(
  clipboardData?: Pick<DataTransfer, "types"> | null,
  extractedFileCount = 0
): boolean {
  if (extractedFileCount > 0) return false;
  if (!clipboardData || !clipboardData.types) return true;

  const types = Array.from(clipboardData.types).map((t) => t.toLowerCase());
  const hasImageType = types.some((t) => t.startsWith("image/") || t === "files");
  if (hasImageType) return true;

  const hasText = types.some((t) => t === "text/plain" || t === "text/uri-list");
  return !hasText;
}
