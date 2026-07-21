import { describe, expect, it } from 'vitest';
import { shouldCommitCancelledPartial } from '../../../src/components/ai/hooks/useAIChat';

describe('shouldCommitCancelledPartial', () => {
  it('commits partial when Stop leaves generation current', () => {
    expect(shouldCommitCancelledPartial(true, 3, 3)).toBe(true);
  });

  it('does not commit when New Chat bumps generation', () => {
    expect(shouldCommitCancelledPartial(true, 3, 4)).toBe(false);
  });

  it('does not commit when unmounted', () => {
    expect(shouldCommitCancelledPartial(false, 3, 3)).toBe(false);
  });

  it('does not commit when unmounted and generation also advanced', () => {
    expect(shouldCommitCancelledPartial(false, 3, 5)).toBe(false);
  });
});
