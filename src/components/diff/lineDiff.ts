import { countWords, diffWords, type WordDiffResult, type WordDiffSegment } from './wordDiff';

/**
 * One aligned row of a review diff. `pair` rows are a removed and an added
 * line similar enough to show word highlights side by side; `del` / `add`
 * rows exist on one side only. `breakBefore` marks a paragraph boundary on
 * either side so both layouts can keep the source's spacing.
 */
export type LineRow =
  | { kind: 'same'; text: string; breakBefore: boolean }
  | { kind: 'pair'; diff: WordDiffResult; breakBefore: boolean }
  | { kind: 'del'; text: string; breakBefore: boolean }
  | { kind: 'add'; text: string; breakBefore: boolean };

export interface LineDiff {
  rows: LineRow[];
  addedWords: number;
  removedWords: number;
  /** The texts differ, but only in spacing or blank lines, which rows do not show. */
  whitespaceOnly: boolean;
}

// Below this share of kept words a pair reads as a rewrite, not an edit, and
// word highlights would mostly cover the whole line anyway.
const MIN_PAIR_SIMILARITY = 0.4;

// Line pairing diffs every removed line against every added line in a block.
const MAX_PAIR_CANDIDATES = 400;

// LCS table guard: line counts are small in practice, but a pathological
// input with thousands of lines must not blow memory.
const MAX_SEQUENCE_CELLS = 250000;

interface SourceLine {
  text: string;
  paraStart: boolean;
}

function splitLines(text: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let pendingBreak = false;
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (line === '') {
      pendingBreak = lines.length > 0;
      continue;
    }
    lines.push({ text: line, paraStart: pendingBreak });
    pendingBreak = false;
  }
  return lines;
}

type SequenceOp = { type: 'same'; i: number; j: number } | { type: 'del'; i: number } | { type: 'add'; j: number };

function diffSequences(before: SourceLine[], after: SourceLine[]): SequenceOp[] {
  const ops: SequenceOp[] = [];
  const n = before.length;
  const m = after.length;
  if (n * m > MAX_SEQUENCE_CELLS) {
    for (let i = 0; i < n; i += 1) ops.push({ type: 'del', i });
    for (let j = 0; j < m; j += 1) ops.push({ type: 'add', j });
    return ops;
  }
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] =
        before[i].text === after[j].text ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i].text === after[j].text) {
      ops.push({ type: 'same', i, j });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'del', i });
      i += 1;
    } else {
      ops.push({ type: 'add', j });
      j += 1;
    }
  }
  for (; i < n; i += 1) ops.push({ type: 'del', i });
  for (; j < m; j += 1) ops.push({ type: 'add', j });
  return ops;
}

function pairWordDiff(before: string, after: string): WordDiffResult | null {
  const diff = diffWords(before, after);
  if (diff.truncated) return null;
  if (diff.similarity < MIN_PAIR_SIMILARITY) return null;
  return diff;
}

/**
 * Order-preserving pairing of removed and added lines that maximizes total
 * similarity, so several reworded lines (or a split/merged paragraph) each
 * keep word highlights instead of the whole block turning solid.
 */
function pairLines(removed: SourceLine[], added: SourceLine[]): LineRow[] {
  const n = removed.length;
  const m = added.length;
  const pairs: (WordDiffResult | null)[][] = Array.from({ length: n }, () =>
    new Array<WordDiffResult | null>(m).fill(null),
  );
  if (n * m <= MAX_PAIR_CANDIDATES) {
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < m; j += 1) pairs[i][j] = pairWordDiff(removed[i].text, added[j].text);
    }
  }
  const best: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      const pair = pairs[i][j];
      const paired = pair ? pair.similarity + best[i + 1][j + 1] : -1;
      best[i][j] = Math.max(best[i + 1][j], best[i][j + 1], paired);
    }
  }
  const rows: LineRow[] = [];
  const del = (line: SourceLine): void => {
    rows.push({ kind: 'del', text: line.text, breakBefore: line.paraStart });
  };
  const add = (line: SourceLine): void => {
    rows.push({ kind: 'add', text: line.text, breakBefore: line.paraStart });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const pair = pairs[i][j];
    if (pair && best[i][j] === pair.similarity + best[i + 1][j + 1]) {
      rows.push({
        kind: 'pair',
        diff: pair,
        breakBefore: removed[i].paraStart || added[j].paraStart,
      });
      i += 1;
      j += 1;
    } else if (best[i + 1][j] >= best[i][j + 1]) {
      del(removed[i]);
      i += 1;
    } else {
      add(added[j]);
      j += 1;
    }
  }
  for (; i < n; i += 1) del(removed[i]);
  for (; j < m; j += 1) add(added[j]);
  return rows;
}

/**
 * Align two texts line by line. Unchanged lines anchor the alignment; each
 * run of changes between anchors is paired by similarity so reworded lines
 * carry word diffs and the rest show as whole-line removals or additions.
 */
export function diffLines(before: string, after: string): LineDiff {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  const rows: LineRow[] = [];
  let removed: SourceLine[] = [];
  let added: SourceLine[] = [];

  const flush = (): void => {
    if (removed.length > 0 || added.length > 0) rows.push(...pairLines(removed, added));
    removed = [];
    added = [];
  };

  for (const op of diffSequences(beforeLines, afterLines)) {
    if (op.type === 'same') {
      flush();
      rows.push({
        kind: 'same',
        text: beforeLines[op.i].text,
        breakBefore: beforeLines[op.i].paraStart || afterLines[op.j].paraStart,
      });
    } else if (op.type === 'del') {
      removed.push(beforeLines[op.i]);
    } else {
      added.push(afterLines[op.j]);
    }
  }
  flush();

  let addedWords = 0;
  let removedWords = 0;
  for (const row of rows) {
    if (row.kind === 'pair') {
      addedWords += row.diff.addedWords;
      removedWords += row.diff.removedWords;
    } else if (row.kind === 'del') {
      removedWords += countWords(row.text);
    } else if (row.kind === 'add') {
      addedWords += countWords(row.text);
    }
  }
  const whitespaceOnly = before !== after && rows.every((row) => row.kind === 'same');
  return { rows, addedWords, removedWords, whitespaceOnly };
}

export type SideCell =
  | { tone: 'same'; text: string }
  | { tone: 'changed'; text: string }
  | { tone: 'words'; segments: WordDiffSegment[] };

export interface SplitRow {
  breakBefore: boolean;
  left: SideCell | null;
  right: SideCell | null;
}

/**
 * Shape rows for a side-by-side view. Unpaired removals and additions in the
 * same run share rows (like VS Code) instead of stacking against blank space.
 */
export function toSplitRows(rows: LineRow[]): SplitRow[] {
  const split: SplitRow[] = [];
  let index = 0;
  while (index < rows.length) {
    const row = rows[index];
    if (row.kind === 'same') {
      const cell: SideCell = { tone: 'same', text: row.text };
      split.push({ breakBefore: row.breakBefore, left: cell, right: cell });
      index += 1;
    } else if (row.kind === 'pair') {
      split.push({
        breakBefore: row.breakBefore,
        left: { tone: 'words', segments: row.diff.segments.filter((segment) => segment.type !== 'add') },
        right: { tone: 'words', segments: row.diff.segments.filter((segment) => segment.type !== 'del') },
      });
      index += 1;
    } else {
      const removed: LineRow[] = [];
      const added: LineRow[] = [];
      while (index < rows.length && (rows[index].kind === 'del' || rows[index].kind === 'add')) {
        (rows[index].kind === 'del' ? removed : added).push(rows[index]);
        index += 1;
      }
      for (let offset = 0; offset < Math.max(removed.length, added.length); offset += 1) {
        const left = removed[offset];
        const right = added[offset];
        split.push({
          breakBefore: Boolean(left?.breakBefore || right?.breakBefore),
          left: left?.kind === 'del' ? { tone: 'changed', text: left.text } : null,
          right: right?.kind === 'add' ? { tone: 'changed', text: right.text } : null,
        });
      }
    }
  }
  return split;
}

export type FoldedItem<T> = { kind: 'item'; item: T } | { kind: 'fold'; key: number; items: T[] };

const FOLD_CONTEXT = 2;
const MIN_FOLDED = 3;

/**
 * Hide long unchanged stretches behind folds, keeping a little context next
 * to each change. Text with no changes at all is left unfolded.
 */
export function foldUnchanged<T>(items: T[], isUnchanged: (item: T) => boolean): FoldedItem<T>[] {
  const folded: FoldedItem<T>[] = [];
  const pushItems = (from: number, to: number): void => {
    for (let index = from; index < to; index += 1) folded.push({ kind: 'item', item: items[index] });
  };
  if (items.every(isUnchanged)) {
    pushItems(0, items.length);
    return folded;
  }
  let index = 0;
  while (index < items.length) {
    if (!isUnchanged(items[index])) {
      pushItems(index, index + 1);
      index += 1;
      continue;
    }
    let end = index;
    while (end < items.length && isUnchanged(items[end])) end += 1;
    const hiddenFrom = index === 0 ? 0 : index + FOLD_CONTEXT;
    const hiddenTo = end === items.length ? end : end - FOLD_CONTEXT;
    if (hiddenTo - hiddenFrom >= MIN_FOLDED) {
      pushItems(index, hiddenFrom);
      folded.push({ kind: 'fold', key: hiddenFrom, items: items.slice(hiddenFrom, hiddenTo) });
      pushItems(hiddenTo, end);
    } else {
      pushItems(index, end);
    }
    index = end;
  }
  return folded;
}
