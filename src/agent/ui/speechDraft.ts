import { stripFences } from '../core/stripFences';

export const LIVE_SPEECH_MAX_CHARS = 8000;

export function liveAgentSpeech(raw: string): string {
  const speech = stripFences(raw);
  if (!speech) return '';
  if (speech.length <= LIVE_SPEECH_MAX_CHARS) return speech;
  return `…${speech.slice(-LIVE_SPEECH_MAX_CHARS)}`;
}
