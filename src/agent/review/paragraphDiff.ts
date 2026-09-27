import { countWords, diffWords, type WordDiffResult } from './wordDiff';

export type RichPart =
  | { kind: 'same'; text: string }
  | { kind: 'changed'; text: string }
  | { kind: 'words'; diff: WordDiffResult };

export type ParagraphRow =
  | { kind: 'same'; paras: string[] }
  | { kind: 'replace'; left: RichPart[]; right: RichPart[] }
  | { kind: 'add'; paras: string[] }
  | { kind: 'del'; paras: string[] };

export interface ParagraphDiff {
  rows: ParagraphRow[];
  addedWords: number;
  removedWords: number;
}

// Below this share of kept words a pair reads as a rewrite, not an edit, and
// word highlights would mostly cover the whole line anyway.
const MIN_PAIR_SIMILARITY = 0.4;

// Line pairing diffs every removed line against every added line in a block.
const MAX_PAIR_CANDIDATES = 400;

// LCS table guard: paragraph counts are small in practice, but a pathological
// input with thousands of paragraphs must not blow memory.
const MAX_SEQUENCE_CELLS = 250000;

function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

type SequenceOp = { type: 'same' | 'del' | 'add'; paras: string[] };

function pushOp(ops: SequenceOp[], type: SequenceOp['type'], text: string): void {
  const last = ops[ops.length - 1];
  if (last?.type === type) last.paras.push(text);
  else ops.push({ type, paras: [text] });
}

function diffSequences(before: string[], after: string[]): SequenceOp[] {
  const ops: SequenceOp[] = [];
  const n = before.length;
  const m = after.length;
  if (n * m > MAX_SEQUENCE_CELLS) {
    if (n > 0) pushOp(ops, 'del', before.join('\n\n'));
    if (m > 0) pushOp(ops, 'add', after.join('\n\n'));
    return ops;
  }
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = before[i] === after[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      pushOp(ops, 'same', before[i]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushOp(ops, 'del', before[i]);
      i += 1;
    } else {
      pushOp(ops, 'add', after[j]);
      j += 1;
    }
  }
  while (i < n) {
    pushOp(ops, 'del', before[i]);
    i += 1;
  }
  while (j < m) {
    pushOp(ops, 'add', after[j]);
    j += 1;
  }
  return ops;
}

function pairWordDiff(before: string, after: string): WordDiffResult | null {
  if (!before || !after) return null;
  const diff = diffWords(before, after);
  if (diff.truncated) return null;
  if (diff.similarity < MIN_PAIR_SIMILARITY) return null;
  return diff;
}

type LineOp =
  | { type: 'pair'; diff: WordDiffResult }
  | { type: 'del'; line: string }
  | { type: 'add'; line: string };

/**
 * Order-preserving pairing of removed and added lines that maximizes total
 * similarity, so several reworded lines (or a split/merged paragraph) each
 * keep word highlights instead of the whole block turning solid.
 */
function pairLines(before: string[], after: string[]): LineOp[] {
  const n = before.length;
  const m = after.length;
  const pairs: (WordDiffResult | null)[][] = Array.from({ length: n }, () =>
    new Array<WordDiffResult | null>(m).fill(null),
  );
  if (n * m <= MAX_PAIR_CANDIDATES) {
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < m; j += 1) pairs[i][j] = pairWordDiff(before[i], after[j]);
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
  const ops: LineOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const pair = pairs[i][j];
    if (pair && best[i][j] === pair.similarity + best[i + 1][j + 1]) {
      ops.push({ type: 'pair', diff: pair });
      i += 1;
      j += 1;
    } else if (best[i + 1][j] >= best[i][j + 1]) {
      ops.push({ type: 'del', line: before[i] });
      i += 1;
    } else {
      ops.push({ type: 'add', line: after[j] });
      j += 1;
    }
  }
  for (; i < n; i += 1) ops.push({ type: 'del', line: before[i] });
  for (; j < m; j += 1) ops.push({ type: 'add', line: after[j] });
  return ops;
}

/**
 * Align the lines of a replaced block so kept lines stay plain and
 * reworded line pairs keep word highlights. Returns display parts per
 * side plus the true changed-word counts.
 */
function alignReplaceLines(
  before: string[],
  after: string[],
): { left: RichPart[]; right: RichPart[]; addedWords: number; removedWords: number } {
  const left: RichPart[] = [];
  const right: RichPart[] = [];
  let addedWords = 0;
  let removedWords = 0;
  const beforeLines = before.flatMap(splitLines);
  const afterLines = after.flatMap(splitLines);
  const ops = diffSequences(beforeLines, afterLines);

  const push = (parts: RichPart[], part: RichPart): void => {
    const last = parts[parts.length - 1];
    if (
      last &&
      last.kind !== 'words' &&
      part.kind !== 'words' &&
      last.kind === part.kind
    ) {
      last.text += `\n${part.text}`;
    } else {
      parts.push(part);
    }
  };

  const removeLine = (line: string): void => {
    push(left, { kind: 'changed', text: line });
    removedWords += countWords(line);
  };
  const addLine = (line: string): void => {
    push(right, { kind: 'changed', text: line });
    addedWords += countWords(line);
  };

  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index];
    const next = ops[index + 1];
    if (op.type === 'same') {
      for (const line of op.paras) {
        push(left, { kind: 'same', text: line });
        push(right, { kind: 'same', text: line });
      }
    } else if (next && next.type !== 'same' && next.type !== op.type) {
      const removed = op.type === 'del' ? op.paras : next.paras;
      const added = op.type === 'del' ? next.paras : op.paras;
      for (const lineOp of pairLines(removed, added)) {
        if (lineOp.type === 'pair') {
          addedWords += lineOp.diff.addedWords;
          removedWords += lineOp.diff.removedWords;
          left.push({ kind: 'words', diff: lineOp.diff });
          right.push({ kind: 'words', diff: lineOp.diff });
        } else if (lineOp.type === 'del') {
          removeLine(lineOp.line);
        } else {
          addLine(lineOp.line);
        }
      }
      index += 1;
    } else if (op.type === 'del') {
      op.paras.forEach(removeLine);
    } else {
      op.paras.forEach(addLine);
    }
  }

  return { left, right, addedWords, removedWords };
}

/**
 * Align two texts paragraph by paragraph. Adjacent removed and added runs
 * pair into `replace` rows so the review can show what each old paragraph
 * became; similar line pairs inside them carry word diffs for highlights.
 */
export function diffParagraphs(before: string, after: string): ParagraphDiff {
  const rows: ParagraphRow[] = [];
  let addedWords = 0;
  let removedWords = 0;
  const ops = diffSequences(splitParagraphs(before), splitParagraphs(after));

  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index];
    if (op.type === 'same') {
      rows.push({ kind: 'same', paras: op.paras });
    } else if (op.type === 'del' || op.type === 'add') {
      const next = ops[index + 1];
      if (next && next.type !== 'same' && next.type !== op.type) {
        const removed = op.type === 'del' ? op.paras : next.paras;
        const added = op.type === 'del' ? next.paras : op.paras;
        const aligned = alignReplaceLines(removed, added);
        addedWords += aligned.addedWords;
        removedWords += aligned.removedWords;
        rows.push({ kind: 'replace', left: aligned.left, right: aligned.right });
        index += 1;
      } else if (op.type === 'del') {
        for (const para of op.paras) removedWords += countWords(para);
        rows.push({ kind: 'del', paras: op.paras });
      } else {
        for (const para of op.paras) addedWords += countWords(para);
        rows.push({ kind: 'add', paras: op.paras });
      }
    }
  }

  return { rows, addedWords, removedWords };
}
