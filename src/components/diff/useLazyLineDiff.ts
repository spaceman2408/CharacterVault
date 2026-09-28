import { useMemo } from 'react';
import { diffLines, type LineDiff } from './lineDiff';

export interface TextPair {
  before: string;
  after: string;
}

export interface DiffWordCounts {
  addedWords: number;
  removedWords: number;
}

/**
 * Word counts for a card header, plus the full rows only while `open`.
 * A review can hold hundreds of cards; closed ones keep two numbers instead
 * of every diff row. Pass a memoized pair so the counts are not recomputed.
 */
export function useLazyLineDiff(
  pair: TextPair | null,
  open: boolean,
): { counts: DiffWordCounts | null; diff: LineDiff | null } {
  const counts = useMemo(() => {
    if (!pair) return null;
    const { addedWords, removedWords } = diffLines(pair.before, pair.after);
    return { addedWords, removedWords };
  }, [pair]);
  const diff = useMemo(() => (pair && open ? diffLines(pair.before, pair.after) : null), [pair, open]);
  return { counts, diff };
}
