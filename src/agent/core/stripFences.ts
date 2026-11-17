const APP_NOTE_BLOCK = /^\[App note:[\s\S]*?\][ \t]*$/gm;

// Transcripts saved before tool XML was dropped still hold it, and some models leak it into speech.
const TOOL_CALL_TEXT = /<tool_call\b[^>]*\/>|<tool_call\b[^>]*>[\s\S]*?(?:<\/tool_call>|$)/gi;
const FENCE_TEXT = /<<<[A-Za-z][A-Za-z0-9_]*[\s\S]*?(?:>>>|$)/g;

/** Models sometimes copy the app's history notes into a reply; those are never the model's speech. */
export function stripAppNotes(text: string): string {
  return text.replace(APP_NOTE_BLOCK, '');
}

export function stripFences(text: string): string {
  const speech = text.replace(TOOL_CALL_TEXT, '').replace(FENCE_TEXT, '');
  return stripAppNotes(speech).replace(/\n{3,}/g, '\n\n').trim();
}
