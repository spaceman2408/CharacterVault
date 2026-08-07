/**
 * @fileoverview Word-level correctness checks for the in-editor spellchecker.
 *
 * nspell (and the bundled English Hunspell list) often lack whole hyphenated
 * compounds like "soft-spoken" even when each segment is a valid word. When the
 * full surface form is unknown, we accept the token if every hyphen-separated
 * segment is itself correct.
 *
 * @module editor/spellcheck/wordCheck
 */

/** Minimal surface of nspell used by the checker. */
export interface SpellCheckerLike {
  correct(word: string): boolean;
}

/**
 * Whether `word` should be treated as spelled correctly.
 *
 * Passes the original-case surface form to the dictionary first (Hunspell
 * stores proper nouns with sentence-case affixes). If that fails and the
 * token contains hyphens, each non-empty segment is checked independently.
 */
export function isWordCorrect(spell: SpellCheckerLike, word: string): boolean {
  if (!word) return true;

  try {
    if (spell.correct(word)) return true;
  } catch {
    return true;
  }

  if (!word.includes('-')) return false;

  const segments = word.split('-').filter((segment) => segment.length > 0);
  if (segments.length === 0) return false;

  try {
    return segments.every((segment) => spell.correct(segment));
  } catch {
    return true;
  }
}
