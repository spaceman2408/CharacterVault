import type { ParsedAction } from '../core/types';

export type ReplaceTextResult =
  | { ok: true; text: string; count: number }
  | { ok: false; message: string };

export function parseReplaceAll(raw: string | undefined): boolean {
  return (raw ?? '').trim().toLowerCase() === 'true';
}

export function replacementText(action: ParsedAction): string {
  if (Object.prototype.hasOwnProperty.call(action.headers, 'new')) {
    return action.headers.new ?? '';
  }
  return action.body;
}

export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
}

export function replaceText(
  source: string,
  oldText: string,
  newText: string,
  replaceAll: boolean,
): ReplaceTextResult {
  if (!oldText) {
    return { ok: false, message: 'error: old is empty' };
  }
  const count = countOccurrences(source, oldText);
  if (count === 0) {
    return { ok: false, message: 'error: old not found (copy the exact text from read)' };
  }
  if (count > 1 && !replaceAll) {
    return {
      ok: false,
      message: `error: old matches ${count} times; pass replace_all true or a longer unique snippet`,
    };
  }
  if (!replaceAll) {
    const at = source.indexOf(oldText);
    return {
      ok: true,
      text: source.slice(0, at) + newText + source.slice(at + oldText.length),
      count: 1,
    };
  }
  return { ok: true, text: source.split(oldText).join(newText), count };
}
