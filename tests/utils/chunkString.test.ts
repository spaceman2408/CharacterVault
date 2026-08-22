import { describe, expect, it } from 'vitest';
import { ChunkString } from '../../src/utils/chunkString';

describe('ChunkString', () => {
  it('joins many small appends to the same text as += would', () => {
    const buf = new ChunkString();
    let expected = '';
    for (let i = 0; i < 200; i += 1) {
      const piece = String(i);
      buf.append(piece);
      expected += piece;
    }
    expect(buf.toString()).toBe(expected);
    expect(buf.length).toBe(expected.length);
  });

  it('sliceFrom returns only the tail without rebuilding the prefix', () => {
    const buf = new ChunkString();
    buf.append('abcd');
    buf.append('efgh');
    expect(buf.sliceFrom(0)).toBe('abcdefgh');
    expect(buf.sliceFrom(3)).toBe('defgh');
    expect(buf.sliceFrom(8)).toBe('');
    buf.append('ij');
    expect(buf.sliceFrom(8)).toBe('ij');
  });

  it('tail keeps a bounded live preview', () => {
    const buf = new ChunkString();
    buf.append('abcdefghij');
    expect(buf.tail(4)).toBe('…ghij');
    expect(buf.tail(40)).toBe('abcdefghij');
  });

  it('clears so the next run does not retain the previous body', () => {
    const buf = new ChunkString();
    buf.append('hello');
    buf.append(' world');
    expect(buf.toString()).toBe('hello world');
    buf.clear();
    expect(buf.toString()).toBe('');
    expect(buf.length).toBe(0);
    buf.append('x');
    expect(buf.toString()).toBe('x');
  });
});
