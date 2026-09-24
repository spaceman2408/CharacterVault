import { diffWords, type WordDiffResult } from './wordDiff';

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

// Word highlights stay readable only while a changed paragraph pair has a
// handful of change fragments; beyond that they degrade into confetti.
const MAX_WORD_FRAGMENTS = 10;

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

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
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
  if (diff.addedWords === 0 && diff.removedWords === 0) return null;
  const fragments = diff.segments.filter((segment) => segment.type !== 'same').length;
  if (fragments > MAX_WORD_FRAGMENTS) return null;
  return diff;
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

  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index];
    if (op.type === 'same') {
      for (const line of op.paras) {
        push(left, { kind: 'same', text: line });
        push(right, { kind: 'same', text: line });
      }
    } else if (op.type === 'del') {
      const next = ops[index + 1];
      if (next?.type === 'add' && op.paras.length === 1 && next.paras.length === 1) {
        const wordDiff = pairWordDiff(op.paras[0], next.paras[0]);
        if (wordDiff) {
          addedWords += wordDiff.addedWords;
          removedWords += wordDiff.removedWords;
          left.push({ kind: 'words', diff: wordDiff });
          right.push({ kind: 'words', diff: wordDiff });
          index += 1;
          continue;
        }
      }
      if (next?.type === 'add') {
        for (const line of op.paras) {
          push(left, { kind: 'changed', text: line });
          removedWords += countWords(line);
        }
        for (const line of next.paras) {
          push(right, { kind: 'changed', text: line });
          addedWords += countWords(line);
        }
        index += 1;
      } else {
        for (const line of op.paras) {
          push(left, { kind: 'changed', text: line });
          removedWords += countWords(line);
        }
      }
    } else {
      for (const line of op.paras) {
        push(right, { kind: 'changed', text: line });
        addedWords += countWords(line);
      }
    }
  }

  return { left, right, addedWords, removedWords };
}

/**
 * Align two texts paragraph by paragraph. Removed runs immediately followed
 * by added runs pair into `replace` rows so the review can show what each
 * old paragraph became; a 1-vs-1 pair with a small, similar change carries
 * its word diff for inline highlights.
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
    } else if (op.type === 'del') {
      const next = ops[index + 1];
      if (next?.type === 'add') {
        const aligned = alignReplaceLines(op.paras, next.paras);
        addedWords += aligned.addedWords;
        removedWords += aligned.removedWords;
        rows.push({ kind: 'replace', left: aligned.left, right: aligned.right });
        index += 1;
      } else {
        for (const para of op.paras) removedWords += countWords(para);
        rows.push({ kind: 'del', paras: op.paras });
      }
    } else {
      for (const para of op.paras) addedWords += countWords(para);
      rows.push({ kind: 'add', paras: op.paras });
    }
  }

  return { rows, addedWords, removedWords };
}
