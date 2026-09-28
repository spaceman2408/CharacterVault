// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAIChat, type UseAIChatOptions } from '../../../src/components/ai/hooks/useAIChat';

afterEach(cleanup);

function options(modelId: string): UseAIChatOptions {
  return {
    aiConfig: { modelId } as UseAIChatOptions['aiConfig'],
    samplerSettings: {} as UseAIChatOptions['samplerSettings'],
    promptSettings: {} as UseAIChatOptions['promptSettings'],
    enableStreaming: false,
    showReasoning: false,
    contextEntryIds: [],
    chatOwnerType: 'character',
    chatOwnerId: '',
  };
}

describe('useAIChat handleAsk when AI is not configured', () => {
  it('resolves false and skips beforeSend', async () => {
    const { result } = renderHook(() => useAIChat(options('')));
    const beforeSend = vi.fn();

    let sent: boolean | undefined;
    await act(async () => {
      sent = await result.current.handleAsk('Hello', beforeSend);
    });

    expect(sent).toBe(false);
    expect(beforeSend).not.toHaveBeenCalled();
    expect(result.current.chatHistory).toEqual([]);
    expect(result.current.error).toBe('Please configure AI settings first');
  });
});
