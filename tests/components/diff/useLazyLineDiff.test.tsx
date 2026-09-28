// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLazyLineDiff, type TextPair } from '../../../src/components/diff';

describe('useLazyLineDiff', () => {
  const pair: TextPair = { before: 'One two three.', after: 'One two four.' };

  it('keeps word counts while closed but no rows', () => {
    const { result } = renderHook(() => useLazyLineDiff(pair, false));
    expect(result.current.counts).toEqual({ addedWords: 1, removedWords: 1 });
    expect(result.current.diff).toBeNull();
  });

  it('builds rows when opened and drops them when closed', () => {
    const { result, rerender } = renderHook(({ open }) => useLazyLineDiff(pair, open), {
      initialProps: { open: true },
    });
    expect(result.current.diff?.rows.length).toBeGreaterThan(0);

    const counts = result.current.counts;
    rerender({ open: false });
    expect(result.current.diff).toBeNull();
    expect(result.current.counts).toBe(counts);
  });

  it('returns nothing for a change without text', () => {
    const { result } = renderHook(() => useLazyLineDiff(null, true));
    expect(result.current).toEqual({ counts: null, diff: null });
  });
});
