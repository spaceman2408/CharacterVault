import { describe, expect, it, vi } from 'vitest';
import {
  flushLorebookDraft,
  registerLorebookDraftFlush,
} from '../../../src/components/editor/lorebook/draftFlush';

describe('lorebook draft flush registry', () => {
  it('calls the registered flush and ignores it after unregister', () => {
    const first = vi.fn();
    const unregister = registerLorebookDraftFlush(first);

    flushLorebookDraft();
    expect(first).toHaveBeenCalledTimes(1);

    unregister();
    flushLorebookDraft();
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('replaces a previous flush and does not let an old unregister clear the new one', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unregisterFirst = registerLorebookDraftFlush(first);
    registerLorebookDraftFlush(second);

    unregisterFirst();
    flushLorebookDraft();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
