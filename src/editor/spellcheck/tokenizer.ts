/**
 * @fileoverview Spellcheck tokenizer and ignore-rule helpers.
 *
 * Pure, browser-safe logic that decides which text ranges should be spellchecked.
 * Tokenization is conservative: a "word" run is a sequence of Unicode letters
 * or digits optionally including apostrophes (straight or curly) and hyphens.
 *
 * Tokens that fall inside a code fence, an inline code span, or a `{{macro}}`
 * placeholder are flagged with a `skipped` reason and the spellchecker should
 * ignore them. Pure numeric and ALL-CAPS tokens are also flagged.
 *
 * Note: URL/email skipping is implicit — these rarely appear in tokenized form
 * without punctuation, and we don't try to detect URL-shaped ranges here. The
 * user can still "Ignore word" via the tooltip for the rare false positive.
 * @module editor/spellcheck/tokenizer
 */

export interface SpellcheckToken {
  /** Absolute document offset (inclusive) */
  from: number;
  /** Absolute document offset (exclusive) */
  to: number;
  /**
   * The word content **with the original case preserved**.
   * Hunspell dictionaries are case-sensitive (e.g. proper nouns are stored
   * with a Sentence-case affix), so `correct()` and `suggest()` must be
   * called on the original surface form, not a lowercased one.
   */
  word: string;
  /**
   * The same word, lowercased. Useful for ignore-list comparisons and
   * de-duplicating custom-word entries.
   */
  wordLower: string;
  /** Why this token was skipped, if at all. */
  skipped?: SkipReason;
}

export type SkipReason =
  | 'inCodeFence'
  | 'inInlineCode'
  | 'macroPlaceholder'
  | 'number'
  | 'allCaps';

export interface TokenizerOptions {
  /** Whether ` ``` ` blocks should be ignored */
  ignoreCodeFences: boolean;
  /** Whether inline `` `code` `` spans should be ignored */
  ignoreInlineCode: boolean;
  /** Whether `{{...}}` macro placeholders should be ignored */
  ignoreMacros: boolean;
  /** Whether pure numeric tokens should be ignored */
  ignoreNumbers: boolean;
  /** Whether all-uppercase acronyms/proper nouns should be ignored */
  ignoreAllCaps: boolean;
}

export const DEFAULT_TOKENIZER_OPTIONS: TokenizerOptions = {
  ignoreCodeFences: true,
  ignoreInlineCode: true,
  ignoreMacros: true,
  ignoreNumbers: true,
  ignoreAllCaps: true,
};

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const STRICT_NUMBER_RE = /^\d[\d.,_]*$/;

/**
 * Find code-fence ranges in `text`. A code fence is a run of ` ``` ` (3+)
 * possibly with a language tag, ending at the next fence.
 */
export function findCodeFenceRanges(text: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  const lines = text.split('\n');
  let absoluteOffset = 0;
  let fenceStartOffset: number | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const isFence = trimmed.startsWith('```') || trimmed.startsWith('~~~');
    if (isFence) {
      if (fenceStartOffset === null) {
        fenceStartOffset = absoluteOffset;
      } else {
        ranges.push({ from: fenceStartOffset, to: absoluteOffset + line.length });
        fenceStartOffset = null;
      }
    }
    absoluteOffset += line.length + 1;
  }

  // Unterminated fence — treat it as open for the rest of the document
  if (fenceStartOffset !== null) {
    ranges.push({ from: fenceStartOffset, to: text.length });
  }

  return ranges;
}

/**
 * Find inline-code spans (`` `…` ``) in `text`. Backticks are not allowed to
 * contain another unescaped backtick.
 */
export function findInlineCodeRanges(text: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf('`', cursor);
    if (open === -1) break;
    // Skip double-tick runs `` `` `` (also valid inline code in some flavors)
    let next = open + 1;
    while (next < text.length && text[next] === '`') next += 1;
    if (next > open + 1 && (next - open) % 2 === 0) {
      cursor = next;
      continue;
    }
    const close = text.indexOf('`', next);
    if (close === -1) break;
    ranges.push({ from: open, to: close + 1 });
    cursor = close + 1;
  }
  return ranges;
}

/**
 * Find `{{...}}` macro placeholder ranges.
 */
export function findMacroRanges(text: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  const re = /\{\{[^}]*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    ranges.push({ from: m.index, to: m.index + m[0].length });
  }
  return ranges;
}

interface RangeSet {
  contains(offset: number): boolean;
}

function makeRangeSet(ranges: ReadonlyArray<{ from: number; to: number }>): RangeSet {
  for (const range of ranges) {
    if (range.from < 0 || range.to < range.from) {
      throw new Error(`Invalid range: ${JSON.stringify(range)}`);
    }
  }
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  return {
    contains(offset: number): boolean {
      let lo = 0;
      let hi = sorted.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const range = sorted[mid];
        if (offset < range.from) {
          hi = mid - 1;
        } else if (offset >= range.to) {
          lo = mid + 1;
        } else {
          return true;
        }
      }
      return false;
    },
  };
}

/**
 * Tokenize `text` into words and apply skip rules.
 *
 * A token is "skipped" when its midpoint falls inside a code fence / inline
 * code / macro placeholder, or when its surface form is a pure number or
 * ALL-CAPS acronym.
 *
 * Note: the returned `word` field preserves the original case. Hunspell
 * dictionaries are case-sensitive — proper nouns typically carry a
 * sentence-case affix, so `correct('Richard')` succeeds while
 * `correct('richard')` fails. Downstream code must compare `wordLower`
 * (or lowercase `word`) against the user's ignore/custom lists rather than
 * the raw `word`.
 */
export function tokenize(
  text: string,
  options: TokenizerOptions = DEFAULT_TOKENIZER_OPTIONS,
): SpellcheckToken[] {
  if (!text) return [];

  const fenceRanges = options.ignoreCodeFences ? makeRangeSet(findCodeFenceRanges(text)) : null;
  const inlineRanges = options.ignoreInlineCode ? makeRangeSet(findInlineCodeRanges(text)) : null;
  const macroRanges = options.ignoreMacros ? makeRangeSet(findMacroRanges(text)) : null;

  const tokens: SpellcheckToken[] = [];
  WORD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WORD_RE.exec(text)) !== null) {
    const word = match[0];
    const from = match.index;
    const to = from + word.length;
    const skip = shouldSkip(word, from, text, {
      fenceRanges,
      inlineRanges,
      macroRanges,
      options,
    });
    tokens.push({ from, to, word, wordLower: word.toLowerCase(), skipped: skip });
  }
  return tokens;
}

interface SkipContext {
  fenceRanges: RangeSet | null;
  inlineRanges: RangeSet | null;
  macroRanges: RangeSet | null;
  options: TokenizerOptions;
}

function shouldSkip(
  word: string,
  from: number,
  _text: string,
  ctx: SkipContext,
): SkipReason | undefined {
  const mid = from + Math.floor(word.length / 2);
  if (ctx.fenceRanges?.contains(mid)) return 'inCodeFence';
  if (ctx.inlineRanges?.contains(mid)) return 'inInlineCode';
  if (ctx.macroRanges?.contains(mid)) return 'macroPlaceholder';

  if (ctx.options.ignoreNumbers && STRICT_NUMBER_RE.test(word)) return 'number';
  if (
    ctx.options.ignoreAllCaps &&
    /^\p{L}+$/u.test(word) &&
    word === word.toUpperCase() &&
    /[A-Z]/u.test(word)
  ) {
    return 'allCaps';
  }

  return undefined;
}

export const __testing__ = {
  findCodeFenceRanges,
  findInlineCodeRanges,
  findMacroRanges,
  shouldSkip,
};
