import type { ParsedAction } from '../core/types';

export type ReplaceTextResult =
  | { ok: true; text: string; count: number }
  | { ok: false; message: string };

const NOT_FOUND =
  'error: old not found (re-read and copy a unique snippet, or rewrite the whole value)';
const HEADING_ONLY =
  'error: deleting a heading leaves the section body; put the first line through the last unique line in old';
const HEADING_HINT =
  'error: old not found; the first line matched once. Include that line through the last unique line of the block';

type Range = { start: number; end: number };

export function parseReplaceAll(raw: string | undefined): boolean {
  return (raw ?? '').trim().toLowerCase() === 'true';
}

export function replacementText(action: ParsedAction): string {
  if (Object.prototype.hasOwnProperty.call(action.headers, 'new')) {
    return action.headers.new ?? '';
  }
  return action.body;
}

export function searchText(action: ParsedAction): string {
  if (Object.prototype.hasOwnProperty.call(action.headers, 'old')) {
    return action.headers.old ?? '';
  }
  if (Object.prototype.hasOwnProperty.call(action.headers, 'new')) {
    return action.body;
  }
  return '';
}

export function countOccurrences(haystack: string, needle: string): number {
  return findExactRanges(haystack, needle).length;
}

export function makeSearchSnippet(
  source: string,
  start: number,
  end: number,
  radius = 36,
): string {
  const from = Math.max(0, start - radius);
  const to = Math.min(source.length, end + radius);
  const prefix = from > 0 ? '…' : '';
  const suffix = to < source.length ? '…' : '';
  return `${prefix}${source.slice(from, to).replace(/\s+/g, ' ').trim()}${suffix}`;
}

/** Case-insensitive search with the same quote/dash folding as replace. */
export function searchInText(
  source: string,
  query: string,
): { count: number; snippet: string | null } {
  const needle = normalizeForMatch(query).normalized.toLowerCase();
  if (!needle || !source) return { count: 0, snippet: null };
  const hay = normalizeForMatch(source);
  const hayLower = hay.normalized.toLowerCase();
  let count = 0;
  let snippet: string | null = null;
  let from = 0;
  while (from <= hayLower.length - needle.length) {
    const at = hayLower.indexOf(needle, from);
    if (at === -1) break;
    if (snippet == null) {
      const start = hay.origIndex[at];
      const end = hay.origIndex[at + needle.length];
      snippet = makeSearchSnippet(source, start, end);
    }
    count += 1;
    from = at + needle.length;
  }
  return { count, snippet };
}

function findExactRanges(haystack: string, needle: string): Range[] {
  if (!needle) return [];
  const ranges: Range[] = [];
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    ranges.push({ start: at, end: at + needle.length });
    from = at + needle.length;
  }
  return ranges;
}

function foldChar(ch: string): string {
  const code = ch.charCodeAt(0);
  if (ch === '\r') return '';
  if (code === 0x00a0 || code === 0x202f || code === 0x2007) return ' ';
  if (code === 0x200b || code === 0x200c || code === 0x200d || code === 0xfeff) return '';
  if (
    code === 0x2018 ||
    code === 0x2019 ||
    code === 0x201a ||
    code === 0x201b ||
    code === 0x2032
  ) {
    return "'";
  }
  if (
    code === 0x201c ||
    code === 0x201d ||
    code === 0x201e ||
    code === 0x201f ||
    code === 0x2033
  ) {
    return '"';
  }
  if (
    code === 0x2010 ||
    code === 0x2011 ||
    code === 0x2012 ||
    code === 0x2013 ||
    code === 0x2014 ||
    code === 0x2015 ||
    code === 0x2212
  ) {
    return '-';
  }
  if (code === 0x2026) return '...';
  return ch;
}

function normalizeForMatch(text: string): { normalized: string; origIndex: number[] } {
  let normalized = '';
  const origIndex: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const folded = foldChar(text[i]);
    for (let j = 0; j < folded.length; j += 1) {
      normalized += folded[j];
      origIndex.push(i);
    }
  }
  origIndex.push(text.length);
  return { normalized, origIndex };
}

function findNormalizedRanges(haystack: string, needle: string): Range[] {
  const hay = normalizeForMatch(haystack);
  const foldedNeedle = normalizeForMatch(needle).normalized;
  if (!foldedNeedle) return [];
  const ranges: Range[] = [];
  let from = 0;
  while (from <= hay.normalized.length - foldedNeedle.length) {
    const at = hay.normalized.indexOf(foldedNeedle, from);
    if (at === -1) break;
    ranges.push({
      start: hay.origIndex[at],
      end: hay.origIndex[at + foldedNeedle.length],
    });
    from = at + foldedNeedle.length;
  }
  return ranges;
}

function nonemptyLines(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

function isMarkdownHeading(line: string): boolean {
  return /^#{1,6}\s+\S/.test(line.trim());
}

function isHeadingOnlyDelete(oldText: string, newText: string): boolean {
  if (newText.length > 0) return false;
  const lines = nonemptyLines(oldText);
  return lines.length === 1 && isMarkdownHeading(lines[0]);
}

function findLineSpan(source: string, oldText: string): Range | null {
  const lines = nonemptyLines(oldText);
  if (lines.length < 2) return null;
  const first = findNormalizedRanges(source, lines[0]);
  const last = findNormalizedRanges(source, lines[lines.length - 1]);
  if (first.length !== 1 || last.length !== 1) return null;
  const start = first[0].start;
  let end = last[0].end;
  if (end < start) return null;
  if (source[end] === '\r' && source[end + 1] === '\n') end += 2;
  else if (source[end] === '\n') end += 1;
  return { start, end };
}

function applyRanges(source: string, ranges: Range[], newText: string): string {
  let next = source;
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    const range = ranges[i];
    next = next.slice(0, range.start) + newText + next.slice(range.end);
  }
  return next;
}

function resolveRanges(
  source: string,
  oldText: string,
  replaceAll: boolean,
): Range[] | { error: string } {
  const exact = findExactRanges(source, oldText);
  if (exact.length === 1 || (exact.length > 1 && replaceAll)) return exact;
  if (exact.length > 1) {
    return {
      error: `error: old matches ${exact.length} times; pass replace_all true or a longer unique snippet`,
    };
  }

  const folded = findNormalizedRanges(source, oldText);
  if (folded.length === 1 || (folded.length > 1 && replaceAll)) return folded;
  if (folded.length > 1) {
    return {
      error: `error: old matches ${folded.length} times; pass replace_all true or a longer unique snippet`,
    };
  }

  const trimmed = oldText.trim();
  if (trimmed && trimmed !== oldText) {
    const trimmedExact = findExactRanges(source, trimmed);
    if (trimmedExact.length === 1 || (trimmedExact.length > 1 && replaceAll)) return trimmedExact;
    if (trimmedExact.length > 1) {
      return {
        error: `error: old matches ${trimmedExact.length} times; pass replace_all true or a longer unique snippet`,
      };
    }
    const trimmedFolded = findNormalizedRanges(source, trimmed);
    if (trimmedFolded.length === 1 || (trimmedFolded.length > 1 && replaceAll)) return trimmedFolded;
    if (trimmedFolded.length > 1) {
      return {
        error: `error: old matches ${trimmedFolded.length} times; pass replace_all true or a longer unique snippet`,
      };
    }
  }

  if (!replaceAll) {
    const span = findLineSpan(source, oldText);
    if (span) return [span];
  }

  const lines = nonemptyLines(oldText);
  if (lines.length >= 2 && findNormalizedRanges(source, lines[0]).length === 1) {
    return { error: HEADING_HINT };
  }
  return { error: NOT_FOUND };
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
  if (isHeadingOnlyDelete(oldText, newText)) {
    const heading = nonemptyLines(oldText)[0];
    const hits = findNormalizedRanges(source, heading);
    if (hits.length === 1) {
      return { ok: false, message: HEADING_ONLY };
    }
  }
  const resolved = resolveRanges(source, oldText, replaceAll);
  if ('error' in resolved) {
    return { ok: false, message: resolved.error };
  }
  return {
    ok: true,
    text: applyRanges(source, resolved, newText),
    count: resolved.length,
  };
}
