import { describe, it, expect } from 'vitest';
import { BYTES_PER_TOKEN, estimateTokens } from '../../src/services/AIService';

describe('estimateTokens', () => {
  it('uses a conservative bytes-per-token ratio (≤ 4)', () => {
    // Keep this ≤ 4 so local budgeting stays at or under typical BPE counts
    expect(BYTES_PER_TOKEN).toBeLessThanOrEqual(4);
  });

  it('returns 0 for empty input', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('ceil-divides UTF-8 byte length by BYTES_PER_TOKEN', () => {
    const ascii = 'a'.repeat(BYTES_PER_TOKEN);
    expect(estimateTokens(ascii)).toBe(1);

    const asciiPlus = 'a'.repeat(BYTES_PER_TOKEN + 1);
    expect(estimateTokens(asciiPlus)).toBe(2);
  });

  it('counts multi-byte UTF-8 characters by bytes, not code units', () => {
    // "你" is 3 bytes in UTF-8
    const cjk = '你';
    const byteLen = new TextEncoder().encode(cjk).length;
    expect(byteLen).toBe(3);
    expect(estimateTokens(cjk)).toBe(Math.ceil(byteLen / BYTES_PER_TOKEN));
  });

  it('estimates more tokens than the old 5-byte heuristic for the same text', () => {
    const text = 'The quick brown fox jumps over the lazy dog. '.repeat(100);
    const bytes = new TextEncoder().encode(text).length;
    const oldHeuristic = Math.ceil(bytes / 5);
    const current = estimateTokens(text);
    expect(current).toBeGreaterThan(oldHeuristic);
    expect(current).toBe(Math.ceil(bytes / BYTES_PER_TOKEN));
  });
});
