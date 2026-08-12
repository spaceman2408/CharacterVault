import { describe, expect, it, vi } from 'vitest';
import {
  resolveContextAtCallTime,
  shouldCommitCancelledPartial,
} from '../../../src/components/ai/hooks/useAIChat';

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

describe('resolveContextAtCallTime', () => {
  it('skips the loader when nothing is pinned and custom context is off', async () => {
    const getContextContent = vi.fn(async () => ['Custom Context:\nnotes']);
    await expect(resolveContextAtCallTime(getContextContent, [])).resolves.toEqual([]);
    expect(getContextContent).not.toHaveBeenCalled();
  });

  it('loads context when only custom context is included', async () => {
    const getContextContent = vi.fn(async (ids: string[]) => {
      expect(ids).toEqual([]);
      return ['Custom Context:\nnotes'];
    });
    await expect(
      resolveContextAtCallTime(getContextContent, [], true),
    ).resolves.toEqual(['Custom Context:\nnotes']);
    expect(getContextContent).toHaveBeenCalledWith([]);
  });

  it('loads pinned sections even when custom context is off', async () => {
    const getContextContent = vi.fn(async () => ['Description:\nKisuki']);
    await expect(
      resolveContextAtCallTime(getContextContent, ['description'], false),
    ).resolves.toEqual(['Description:\nKisuki']);
    expect(getContextContent).toHaveBeenCalledWith(['description']);
  });
});
