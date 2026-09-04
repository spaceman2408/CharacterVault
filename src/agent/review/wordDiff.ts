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
}

const MAX_DIFF_TOKENS = 2000;

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((token) => token.length > 0);
}

function isWord(token: string): boolean {
  return /\S/.test(token);
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

function myers(a: string[], b: string[]): WordDiffSegment[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  if (max === 0) return [];
  const offset = max;
  const v = new Int32Array(2 * max + 1).fill(-1);
  v[offset + 1] = 0;
  const trace: Int32Array[] = [];

  let done = false;
  for (let d = 0; d <= max; d += 1) {
    const cur = new Int32Array(2 * max + 1).fill(-1);
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
      cur[offset + k] = x;
      if (x >= n && y >= m) {
        trace.push(cur);
        done = true;
        break;
      }
    }
    if (done) break;
    trace.push(cur);
    v.set(cur);
  }

  const reversed: WordDiffSegment[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d > 0; d -= 1) {
    const prev = trace[d - 1];
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && prev[offset + k - 1] < prev[offset + k + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = prev[offset + prevK];
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

export function diffWords(before: string, after: string): WordDiffResult {
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length > MAX_DIFF_TOKENS || b.length > MAX_DIFF_TOKENS) {
    return { segments: [], truncated: true, addedWords: 0, removedWords: 0 };
  }
  const segments = myers(a, b);
  let addedWords = 0;
  let removedWords = 0;
  for (const segment of segments) {
    if (segment.type === 'add' && isWord(segment.text)) {
      addedWords += segment.text.split(/\s+/).filter(Boolean).length;
    } else if (segment.type === 'del' && isWord(segment.text)) {
      removedWords += segment.text.split(/\s+/).filter(Boolean).length;
    }
  }
  return { segments, truncated: false, addedWords, removedWords };
}
