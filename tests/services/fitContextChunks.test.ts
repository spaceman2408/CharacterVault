import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  fitContextChunks,
  truncateTextToTokenLimit,
} from '../../src/services/AIService';

describe('fitContextChunks', () => {
  it('returns empty when budget is zero', () => {
    expect(fitContextChunks(['hello'], 0)).toEqual([]);
  });

  it('includes whole chunks that fit', () => {
    const a = 'Short A';
    const b = 'Short B';
    const budget = estimateTokens(a) + estimateTokens(b) + 20;
    expect(fitContextChunks([a, b], budget)).toEqual([a, b]);
  });

  it('does not drop a single oversized chunk to empty — partial fills remaining budget', () => {
    // One huge blob (simulates old monolithic lorebook string)
    const huge = 'Lore entry text. '.repeat(5000);
    const hugeTokens = estimateTokens(huge);
    expect(hugeTokens).toBeGreaterThan(2000);

    const budget = 1500;
    const fitted = fitContextChunks([huge], budget);

    expect(fitted.length).toBe(1);
    expect(fitted[0].endsWith('...')).toBe(true);
    expect(estimateTokens(fitted[0])).toBeLessThanOrEqual(budget);
    expect(estimateTokens(fitted[0])).toBeGreaterThan(100);
  });

  it('keeps earlier small chunks and partial-fills the overflow chunk', () => {
    const small = 'Header: Character Lore';
    const big = 'Body content goes here. '.repeat(3000);
    const smallCost = estimateTokens(small) + 5;
    const budget = smallCost + 800;

    const fitted = fitContextChunks([small, big], budget);
    expect(fitted[0]).toBe(small);
    expect(fitted.length).toBe(2);
    expect(fitted[1].endsWith('...')).toBe(true);

    const total =
      estimateTokens(fitted[0]) + 5 + estimateTokens(fitted[1]) + 5;
    expect(total).toBeLessThanOrEqual(budget + 5); // small slack for separator accounting
  });

  it('includes as many per-entry lorebook chunks as fit', () => {
    const header = 'Lorebook: Test';
    const entries = Array.from({ length: 20 }, (_, i) =>
      `[Entry ${i}] Name ${i}\nKeys: k${i}\n${'x'.repeat(400)}`
    );
    const fullCost = [header, ...entries].reduce(
      (sum, c) => sum + estimateTokens(c) + 5,
      0
    );
    // Budget for only a fraction of the book
    const budget = Math.max(400, Math.floor(fullCost / 4));
    const fitted = fitContextChunks([header, ...entries], budget);

    expect(fitted[0]).toBe(header);
    expect(fitted.length).toBeGreaterThan(1);
    // Not everything when budget is tight
    expect(fitted.length).toBeLessThan(1 + entries.length);

    let used = 0;
    for (const chunk of fitted) {
      used += estimateTokens(chunk) + 5;
    }
    expect(used).toBeLessThanOrEqual(budget + 5);
  });
});

describe('truncateTextToTokenLimit', () => {
  it('returns original when under budget', () => {
    expect(truncateTextToTokenLimit('hi', 100)).toBe('hi');
  });

  it('appends ellipsis when truncating', () => {
    const text = 'word '.repeat(500);
    const out = truncateTextToTokenLimit(text, 20);
    expect(out.endsWith('...')).toBe(true);
    expect(estimateTokens(out)).toBeLessThanOrEqual(20);
  });
});
