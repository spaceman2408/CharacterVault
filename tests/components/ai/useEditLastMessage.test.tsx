// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEditLastMessage } from '../../../src/components/ai/hooks/useEditLastMessage';
import type { ChatMessage } from '../../../src/components/ai/types';

afterEach(cleanup);

function msg(id: string, role: ChatMessage['role'], content = id): ChatMessage {
  return { id, role, content, timestamp: 1 };
}

const history = [msg('u1', 'user'), msg('a1', 'assistant'), msg('u2', 'user', 'Write a greeting'), msg('a2', 'assistant')];

function setup(initial: ChatMessage[] = history) {
  const deleteMessage = vi.fn();
  const setComposerText = vi.fn();
  const hook = renderHook(({ chat }) => useEditLastMessage(chat, deleteMessage), {
    initialProps: { chat: initial },
  });
  return { hook, deleteMessage, setComposerText };
}

describe('useEditLastMessage', () => {
  it('loads the text without trimming anything', () => {
    const { hook, deleteMessage, setComposerText } = setup();
    expect(hook.result.current.lastUserIndex).toBe(2);
    act(() => hook.result.current.startEdit(history[2], setComposerText));
    expect(setComposerText).toHaveBeenCalledWith('Write a greeting');
    expect(hook.result.current.editingId).toBe('u2');
    expect(deleteMessage).not.toHaveBeenCalled();
  });

  it('trims from the edited message when the edit is sent', () => {
    const { hook, deleteMessage, setComposerText } = setup();
    act(() => hook.result.current.startEdit(history[2], setComposerText));
    act(() => hook.result.current.commitEdit());
    expect(deleteMessage).toHaveBeenCalledWith('u2');
    expect(hook.result.current.editingId).toBeNull();
  });

  it('cancel clears the composer and keeps the chat', () => {
    const { hook, deleteMessage, setComposerText } = setup();
    act(() => hook.result.current.startEdit(history[2], setComposerText));
    act(() => hook.result.current.cancelEdit(setComposerText));
    expect(setComposerText).toHaveBeenLastCalledWith('');
    act(() => hook.result.current.commitEdit());
    expect(deleteMessage).not.toHaveBeenCalled();
  });

  it('drops the edit once another message becomes the last user message', () => {
    const { hook, deleteMessage, setComposerText } = setup();
    act(() => hook.result.current.startEdit(history[2], setComposerText));
    hook.rerender({ chat: [...history, msg('u3', 'user', 'Continue where you left off.')] });
    expect(hook.result.current.editingId).toBeNull();
    act(() => hook.result.current.commitEdit());
    expect(deleteMessage).not.toHaveBeenCalled();
  });
});
