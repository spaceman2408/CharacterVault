export const LIVE_REASONING_FLUSH_MS = 80;
export const LIVE_REASONING_MAX_CHARS = 6000;

export function clipLiveReasoning(text: string): string {
  if (text.length <= LIVE_REASONING_MAX_CHARS) return text;
  return `…${text.slice(-LIVE_REASONING_MAX_CHARS)}`;
}
