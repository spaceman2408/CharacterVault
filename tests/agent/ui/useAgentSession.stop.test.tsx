// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentHost } from '../../../src/agent/core/types';
import { useAgentSession } from '../../../src/agent/ui/useAgentSession';
import { DEFAULT_SETTINGS } from '../../../src/db/characterTypes';
import { AIError, AIService } from '../../../src/services/AIService';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const aiConfig = {
  ...DEFAULT_SETTINGS.ai,
  baseUrl: 'http://stop.test/v1',
  modelId: 'mock',
  enableStreaming: false,
};

function hangUntilAbort() {
  let cancel: (() => void) | null = null;
  const chat = vi.spyOn(AIService.prototype, 'chat').mockImplementation(
    () =>
      new Promise((_, reject) => {
        cancel = () => reject(new AIError('Request was cancelled', 'unknown'));
      }),
  );
  vi.spyOn(AIService.prototype, 'abort').mockImplementation(() => cancel?.());
  return chat;
}

function renderSession(flush: () => Promise<void>) {
  const host = (): AgentHost => ({
    toolNames: ['update_entry'],
    tools: [{ name: 'update_entry', description: 'Update an entry', parameters: { type: 'object' } }],
    buildSystemPrompt: () => 'sys',
    extraContextChunks: async () => [],
    execute: async (action) => ({ ok: true, toolName: action.name, message: 'ok #4 Harbor' }),
    flush,
  });
  return renderHook(() =>
    useAgentSession({
      aiConfig,
      samplerSettings: DEFAULT_SETTINGS.sampler,
      promptSettings: DEFAULT_SETTINGS.prompts,
      createHost: host,
      flushDraft: () => undefined,
      lookupToolNames: new Set(),
      chatOwnerType: 'lorebook',
      chatOwnerId: '',
    }),
  );
}

describe('useAgentSession Stop', () => {
  it('stays busy until the stopped run has saved its edits', async () => {
    const chat = hangUntilAbort();
    let finishSave = () => {};
    const saved = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const { result } = renderSession(() => saved);

    let run: Promise<void> = Promise.resolve();
    await act(async () => {
      run = result.current.handleAsk('Rewrite Harbor');
      await vi.waitFor(() => expect(chat).toHaveBeenCalled());
    });
    await act(async () => {
      result.current.handleAbort();
    });
    expect(result.current.isProcessing).toBe(true);

    await act(async () => {
      await result.current.handleAsk('Second request');
    });
    expect(result.current.chatHistory.map((message) => message.content)).not.toContain('Second request');

    await act(async () => {
      finishSave();
      await run;
    });
    expect(result.current.isProcessing).toBe(false);
  });
});
