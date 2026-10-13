// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentHost } from '../../../src/agent/core/types';
import { useAgentSession } from '../../../src/agent/ui/useAgentSession';
import { DEFAULT_SETTINGS } from '../../../src/db/characterTypes';
import { AIError, AIService } from '../../../src/services/AIService';
import { clearCapabilityCaches, getCapabilityCache } from '../../../src/services/chatRequestRepair';
import { normalizeBaseUrl } from '../../../src/utils/aiBaseUrl';

const aiConfig = {
  ...DEFAULT_SETTINGS.ai,
  baseUrl: 'http://stop-speech.test/v1',
  modelId: 'mock',
  enableStreaming: true,
};

beforeEach(() => {
  getCapabilityCache(normalizeBaseUrl(aiConfig.baseUrl), aiConfig.modelId).rejectedParams.add('tools');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  clearCapabilityCaches();
});

type Reply = { chunks: string[]; finishReason?: string; hang?: boolean };

function scriptChat(replies: Reply[]) {
  let cancel: (() => void) | null = null;
  let call = 0;
  const chat = vi.spyOn(AIService.prototype, 'chat').mockImplementation(async (_messages, _context, onChunk) => {
    const reply = replies[call] ?? { chunks: ['Done.'] };
    call += 1;
    for (const content of reply.chunks) onChunk?.({ content });
    if (reply.hang) {
      return new Promise<Awaited<ReturnType<AIService['chat']>>>((_, reject) => {
        cancel = () => reject(new AIError('Request was cancelled', 'unknown'));
      });
    }
    return { content: reply.chunks.join(''), finishReason: reply.finishReason ?? 'stop' };
  });
  vi.spyOn(AIService.prototype, 'abort').mockImplementation(() => cancel?.());
  return chat;
}

function renderSession() {
  const host = (): AgentHost => ({
    toolNames: ['update_entry'],
    buildSystemPrompt: () => 'sys',
    extraContextChunks: async () => [],
    execute: async (action) => ({ ok: true, toolName: action.name, message: 'ok #4 Harbor' }),
    flush: async () => undefined,
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

async function askThenStop(callsBeforeStop: number) {
  const { result } = renderSession();
  let run: Promise<void> = Promise.resolve();
  await act(async () => {
    run = result.current.handleAsk('Rewrite Harbor');
    await vi.waitFor(() => expect(AIService.prototype.chat).toHaveBeenCalledTimes(callsBeforeStop));
  });
  await act(async () => {
    result.current.handleAbort();
    await run;
  });
  return result.current.chatHistory.filter((message) => message.role === 'assistant').map((message) => message.content);
}

describe('useAgentSession Stop keeps only speech', () => {
  it('during a long XML tool call', async () => {
    const body = Array.from({ length: 40 }, () => 'x'.repeat(500));
    scriptChat([{ chunks: ['Writing it now.\n<tool_call>\nupdate_entry\nid: 4\n---\n', ...body], hang: true }]);
    expect(await askThenStop(1)).toEqual(['Writing it now.']);
  });

  it('during the continuation of a cut-off tool call', async () => {
    scriptChat([
      { chunks: ["I'll rewrite it.\n<tool_call>\nupdate_entry\n"], finishReason: 'length' },
      { chunks: ['id: 4\n---\nNew body\n</tool_call>\n'], hang: true },
    ]);
    expect(await askThenStop(2)).toEqual(["I'll rewrite it."]);
  });
});
