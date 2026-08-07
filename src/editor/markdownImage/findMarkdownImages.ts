/**
 * @fileoverview Pure helpers for Markdown image syntax detection.
 *
 * Shared by the in-editor highlighter / open-link control and by the
 * spellcheck tokenizer (so URL path segments are not flagged as misspellings).
 *
 * @module editor/markdownImage/findMarkdownImages
 */

export interface MarkdownImageMatch {
  /** Absolute document offset (inclusive) */
  from: number;
  /** Absolute document offset (exclusive) */
  to: number;
  /** Alt text between `[` and `]` (may be empty) */
  alt: string;
  /** Destination URL (angle brackets stripped if present) */
  url: string;
  /** Optional title */
  title?: string;
  /** Absolute offsets of the URL segment within the document */
  urlFrom: number;
  urlTo: number;
}

/**
 * `![alt](url)`, `![alt](<url>)`, optional title:
 * `![alt](url "title")` / `'title'` / `(title)`.
 * Single-line only (no newlines inside the construct).
 */
const MD_IMAGE_RE =
  /!\[([^\]]*)]\(\s*(?:<([^>\n]+)>|([^)\s\n]+))(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?\s*\)/g;

/**
 * Find all Markdown image constructs in `text`.
 * Offsets are relative to the start of `text`.
 */
export function findMarkdownImages(text: string): MarkdownImageMatch[] {
  if (!text) return [];

  const results: MarkdownImageMatch[] = [];
  MD_IMAGE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MD_IMAGE_RE.exec(text)) !== null) {
    const full = match[0];
    const alt = match[1] ?? '';
    const angleUrl = match[2];
    const bareUrl = match[3];
    const url = (angleUrl ?? bareUrl ?? '').trim();
    if (!url) continue;

    const title = match[4] ?? match[5] ?? match[6];
    const from = match.index;
    const to = from + full.length;

    // Locate the URL span inside the match for finer highlighting.
    const parenOpen = full.indexOf('](');
    let urlFromRel = -1;
    let urlToRel = -1;
    if (parenOpen !== -1) {
      const afterParen = parenOpen + 2;
      const rest = full.slice(afterParen);
      const leadingWs = rest.match(/^\s*/)?.[0].length ?? 0;
      const urlStartInRest = leadingWs;
      if (angleUrl !== undefined) {
        // `<url>`
        const lt = rest.indexOf('<', urlStartInRest);
        if (lt !== -1) {
          urlFromRel = afterParen + lt + 1;
          urlToRel = urlFromRel + angleUrl.length;
        }
      } else {
        urlFromRel = afterParen + urlStartInRest;
        urlToRel = urlFromRel + url.length;
      }
    }

    results.push({
      from,
      to,
      alt,
      url,
      title: title || undefined,
      urlFrom: urlFromRel >= 0 ? from + urlFromRel : from,
      urlTo: urlToRel >= 0 ? from + urlToRel : to,
    });
  }
  return results;
}

/** Range-only form for spellcheck skip sets. */
export function findMarkdownImageRanges(text: string): Array<{ from: number; to: number }> {
  return findMarkdownImages(text).map(({ from, to }) => ({ from, to }));
}

/**
 * Whether `raw` is a safe http(s) URL to open in a new tab.
 * Rejects javascript:, data:, file:, relative paths, and malformed strings.
 */
export function isOpenableHttpUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function formatUrlForDisplay(raw: string): { host: string; truncated: string } {
  const trimmed = raw.trim();
  try {
    const parsed = new URL(trimmed);
    const full = parsed.href;
    return {
      host: parsed.hostname,
      truncated: full.length > 96 ? `${full.slice(0, 93)}…` : full,
    };
  } catch {
    return {
      host: '',
      truncated: trimmed.length > 96 ? `${trimmed.slice(0, 93)}…` : trimmed,
    };
  }
}
