import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  flushChatSessions,
  registerChatSessionFlush,
} from '../../src/utils/chatSessionFlush';

describe('chat session flush registry', () => {
  const unregisters: Array<() => void> = [];

  afterEach(async () => {
    while (unregisters.length > 0) {
      unregisters.pop()?.();
    }
    await flushChatSessions();
  });

  it('awaits every registered flush and ignores it after unregister', async () => {
    const first = vi.fn(async () => undefined);
    const unregister = registerChatSessionFlush(first);
    unregisters.push(unregister);

    await flushChatSessions();
    expect(first).toHaveBeenCalledTimes(1);

    unregister();
    await flushChatSessions();
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('runs remaining flushes after one unregisters', async () => {
    const first = vi.fn();
    const second = vi.fn(async () => undefined);
    const unregisterFirst = registerChatSessionFlush(first);
    unregisters.push(registerChatSessionFlush(second));

    unregisterFirst();
    await flushChatSessions();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
