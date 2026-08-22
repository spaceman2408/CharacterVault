import { describe, expect, it } from 'vitest';
import {
  clipCommitReasoning,
  COMMIT_REASONING_MAX_CHARS,
  LIVE_REASONING_MAX_CHARS,
} from '../../../src/components/ai/utils';

describe('clipCommitReasoning', () => {
  it('passes through undefined and empty reasoning', () => {
    expect(clipCommitReasoning(undefined)).toBeUndefined();
    expect(clipCommitReasoning('')).toBeUndefined();
  });

  it('keeps short reasoning as-is', () => {
    expect(clipCommitReasoning('thinking aloud')).toBe('thinking aloud');
    const exact = 'x'.repeat(COMMIT_REASONING_MAX_CHARS);
    expect(clipCommitReasoning(exact)).toBe(exact);
  });

  it('clips oversized reasoning to the tail with an ellipsis marker', () => {
    const head = 'h'.repeat(5000);
    const tail = 't'.repeat(COMMIT_REASONING_MAX_CHARS);
    const clipped = clipCommitReasoning(head + tail);
    expect(clipped).toBe(`…${tail}`);
  });

  it('keeps a more generous tail than the live preview', () => {
    expect(COMMIT_REASONING_MAX_CHARS).toBeGreaterThan(LIVE_REASONING_MAX_CHARS);
  });
});
