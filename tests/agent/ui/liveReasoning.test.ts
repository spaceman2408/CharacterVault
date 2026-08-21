import { describe, expect, it } from 'vitest';
import { clipLiveReasoning, LIVE_REASONING_MAX_CHARS } from '../../../src/agent/ui/liveReasoning';

describe('clipLiveReasoning', () => {
  it('returns short text unchanged', () => {
    expect(clipLiveReasoning('hello')).toBe('hello');
  });

  it('keeps only the tail of a long think so the live DOM stays bounded', () => {
    const text = 'a'.repeat(LIVE_REASONING_MAX_CHARS + 50);
    const clipped = clipLiveReasoning(text);
    expect(clipped.startsWith('…')).toBe(true);
    expect(clipped.length).toBe(LIVE_REASONING_MAX_CHARS + 1);
    expect(clipped.endsWith('a'.repeat(20))).toBe(true);
  });
});
