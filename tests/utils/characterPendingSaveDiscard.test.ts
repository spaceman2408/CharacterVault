import { describe, expect, it, vi } from 'vitest';
import {
  discardPendingSavesForCharacter,
  registerPendingSaveDiscard,
} from '../../src/utils/characterPendingSaveDiscard';

describe('characterPendingSaveDiscard', () => {
  it('fans out to registered handlers with the character id', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unregisterFirst = registerPendingSaveDiscard(first);
    const unregisterSecond = registerPendingSaveDiscard(second);
    discardPendingSavesForCharacter('char-1');
    expect(first).toHaveBeenCalledWith('char-1');
    expect(second).toHaveBeenCalledWith('char-1');
    unregisterFirst();
    unregisterSecond();
  });

  it('stops calling unregistered handlers', () => {
    const handler = vi.fn();
    const unregister = registerPendingSaveDiscard(handler);
    unregister();
    discardPendingSavesForCharacter('char-2');
    expect(handler).not.toHaveBeenCalled();
  });
});
