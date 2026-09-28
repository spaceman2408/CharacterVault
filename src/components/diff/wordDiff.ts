export type WordDiffType = 'same' | 'del' | 'add';

export interface WordDiffSegment {
  text: string;
  type: WordDiffType;
}

export interface WordDiffResult {
  segments: WordDiffSegment[];
  truncated: boolean;
  addedWords: number;
  removedWords: number;
  /** Share of words kept unchanged, 0..1 (Dice coefficient over word tokens). */
  similarity: number;
}

const MAX_DIFF_TOKENS = 4000;

// Myers memory grows with the square of the edit distance; past this the two
// texts are too different for word highlights to help anyway.
const MAX_EDIT_DISTANCE = 1500;

const TOKEN_PATTERN = /\s+|[\p{L}\p{N}_]+(?:['’][\p{L}\p{N}_]+)*|[^\s\p{L}\p{N}_]/gu;
const WORD_PATTERN = /[\p{L}\p{N}_]+(?:['’][\p{L}\p{N}_]+)*/gu;

function tokenize(text: string): string[] {
  return text.match(TOKEN_PATTERN) ?? [];
}

export function countWords(text: string): number {
  return text.match(WORD_PATTERN)?.length ?? 0;
}

function mergeSegments(segments: WordDiffSegment[]): WordDiffSegment[] {
  const merged: WordDiffSegment[] = [];
  for (const segment of segments) {
    const last = merged[merged.length - 1];
    if (last && last.type === segment.type) {
      last.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

function myers(a: string[], b: string[]): WordDiffSegment[] | null {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  if (max === 0) return [];
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3).fill(-1);
  v[offset + 1] = 0;
  // trace[d] holds v for diagonals -d..d after step d, indexed k + d.
  const trace: Int32Array[] = [];

  let done = false;
  for (let d = 0; d <= max; d += 1) {
    if (d > MAX_EDIT_DISTANCE) return null;
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1];
      } else {
        x = v[offset + k - 1] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        done = true;
        break;
      }
    }
    trace.push(v.slice(offset - d, offset + d + 1));
    if (done) break;
  }

  const reversed: WordDiffSegment[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d > 0; d -= 1) {
    const prev = trace[d - 1];
    const at = (k: number): number => prev[k + d - 1];
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && at(k - 1) < at(k + 1))) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      x -= 1;
      y -= 1;
      reversed.push({ text: a[x], type: 'same' });
    }
    if (x === prevX) {
      y -= 1;
      reversed.push({ text: b[y], type: 'add' });
    } else {
      x -= 1;
      reversed.push({ text: a[x], type: 'del' });
    }
  }
  while (x > 0 && y > 0) {
    x -= 1;
    y -= 1;
    reversed.push({ text: a[x], type: 'same' });
  }
  while (x > 0) {
    x -= 1;
    reversed.push({ text: a[x], type: 'del' });
  }
  while (y > 0) {
    y -= 1;
    reversed.push({ text: b[y], type: 'add' });
  }
  return mergeSegments(reversed.reverse());
}

type Block = { type: 'same'; text: string } | { type: 'change'; del: string; add: string };

function toBlocks(segments: WordDiffSegment[]): Block[] {
  const blocks: Block[] = [];
  for (const segment of segments) {
    const last = blocks[blocks.length - 1];
    if (segment.type === 'same') {
      blocks.push({ type: 'same', text: segment.text });
    } else if (last?.type === 'change') {
      if (segment.type === 'del') last.del += segment.text;
      else last.add += segment.text;
    } else {
      blocks.push({
        type: 'change',
        del: segment.type === 'del' ? segment.text : '',
        add: segment.type === 'add' ? segment.text : '',
      });
    }
  }
  return blocks;
}

function changeWeight(block: Extract<Block, { type: 'change' }>): number {
  return Math.max(countWords(block.del), countWords(block.add));
}

/**
 * Folds short unchanged islands between two edits into those edits so a
 * rewritten phrase reads as one highlight instead of alternating fragments
 * (the idea behind diff-match-patch's semantic cleanup, at word granularity).
 */
function cleanupSemantic(segments: WordDiffSegment[]): WordDiffSegment[] {
  const blocks = toBlocks(segments);
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = 1; index < blocks.length - 1; index += 1) {
      const prev = blocks[index - 1];
      const same = blocks[index];
      const next = blocks[index + 1];
      if (same.type !== 'same' || prev.type !== 'change' || next.type !== 'change') continue;
      const keptWords = countWords(same.text);
      if (keptWords > Math.min(changeWeight(prev), changeWeight(next))) continue;
      blocks.splice(index - 1, 3, {
        type: 'change',
        del: prev.del + same.text + next.del,
        add: prev.add + same.text + next.add,
      });
      changed = true;
      break;
    }
  }
  const out: WordDiffSegment[] = [];
  for (const block of blocks) {
    if (block.type === 'same') {
      out.push({ type: 'same', text: block.text });
    } else {
      if (block.del) out.push({ type: 'del', text: block.del });
      if (block.add) out.push({ type: 'add', text: block.add });
    }
  }
  return out;
}

function truncatedResult(): WordDiffResult {
  return { segments: [], truncated: true, addedWords: 0, removedWords: 0, similarity: 0 };
}

export function diffWords(before: string, after: string): WordDiffResult {
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length > MAX_DIFF_TOKENS || b.length > MAX_DIFF_TOKENS) return truncatedResult();
  const raw = myers(a, b);
  if (!raw) return truncatedResult();
  let addedWords = 0;
  let removedWords = 0;
  let keptWords = 0;
  for (const segment of raw) {
    const words = countWords(segment.text);
    if (segment.type === 'add') addedWords += words;
    else if (segment.type === 'del') removedWords += words;
    else keptWords += words;
  }
  const totalWords = countWords(before) + countWords(after);
  const similarity =
    totalWords === 0 ? (before.trim() === after.trim() ? 1 : 0) : (2 * keptWords) / totalWords;
  return {
    segments: cleanupSemantic(raw),
    truncated: false,
    addedWords,
    removedWords,
    similarity,
  };
}
