// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentHost, CompleterResult } from '../../../src/agent/core/types';
import { useAgentSession } from '../../../src/agent/ui/useAgentSession';
import { DEFAULT_SETTINGS } from '../../../src/db/characterTypes';
import { AIService, type ChatMessage } from '../../../src/services/AIService';
import { getCapabilityCache } from '../../../src/services/chatRequestRepair';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const aiConfig = {
  ...DEFAULT_SETTINGS.ai,
  baseUrl: 'http://keep-edits.test/v1',
  modelId: 'mock',
  enableStreaming: false,
};

function fakeHost(): AgentHost {
  return {
    toolNames: ['update_entry', 'read_entry'],
    tools: [
      { name: 'update_entry', description: 'Update an entry', parameters: { type: 'object' } },
      { name: 'read_entry', description: 'Read an entry', parameters: { type: 'object' } },
    ],
    buildSystemPrompt: () => 'sys',
    extraContextChunks: async () => [],
    execute: async (action) => ({
      ok: true,
      toolName: action.name,
      message: action.name === 'read_entry' ? '#4 Harbor\n---\nOld body' : 'ok #4 Harbor',
    }),
    flush: async () => undefined,
  };
}

function scriptChat(replies: CompleterResult[]): ChatMessage[][] {
  const requests: ChatMessage[][] = [];
  let index = 0;
  vi.spyOn(AIService.prototype, 'chat').mockImplementation(async (messages) => {
    requests.push(structuredClone(messages));
    const reply = replies[index] ?? { content: 'Done.' };
    index += 1;
    return reply;
  });
  return requests;
}

function renderSession(keep: boolean, config = aiConfig) {
  return renderHook(
    ({ keepEdits }: { keepEdits: boolean }) =>
      useAgentSession({
        aiConfig: config,
        samplerSettings: DEFAULT_SETTINGS.sampler,
        promptSettings: DEFAULT_SETTINGS.prompts,
        createHost: fakeHost,
        flushDraft: () => undefined,
        lookupToolNames: new Set(['read_entry']),
        chatOwnerType: 'lorebook',
        chatOwnerId: '',
        keepEditsInContext: keepEdits,
      }),
    { initialProps: { keepEdits: keep } },
  );
}

const editRun: CompleterResult[] = [
  {
    content: '',
    toolCalls: [
      { id: 'call_read', name: 'read_entry', arguments: '{"id":4}' },
      { id: 'call_fog', name: 'update_entry', arguments: '{"id":4,"content":"Fog"}' },
    ],
  },
  { content: 'Done.' },
];

function replayedCalls(request: ChatMessage[]): { name: string; arguments: string }[] {
  return request.flatMap((message) =>
    (message.tool_calls ?? []).map((call) => ({ name: call.function.name, arguments: call.function.arguments })),
  );
}

function allText(request: ChatMessage[]): string {
  return request.map((message) => message.content ?? '').join('\n');
}

describe('useAgentSession keepEditsInContext', () => {
  it('stores the write call and replays it as a tool call on the next run', async () => {
    const requests = scriptChat(editRun);
    const { result } = renderSession(true);

    await act(async () => {
      await result.current.handleAsk('Rewrite Harbor');
    });
    const events = Object.values(result.current.toolEventsByMessageId).flat();
    expect(events.find((event) => event.toolName === 'update_entry')?.call).toEqual({
      headers: { id: '4' },
      body: 'Fog',
    });
    expect(events.find((event) => event.toolName === 'read_entry')?.call).toBeUndefined();

    await act(async () => {
      await result.current.handleAsk('Change the word in edit 1');
    });
    expect(requests).toHaveLength(3);
    const next = requests[2];
    expect(replayedCalls(next)).toEqual([{ name: 'update_entry', arguments: '{"id":"4","content":"Fog"}' }]);
    const callId = next.find((message) => message.tool_calls?.length)?.tool_calls?.[0].id;
    expect(next.find((message) => message.role === 'tool')).toMatchObject({
      tool_call_id: callId,
      content: 'ok #4 Harbor',
    });
    expect(next.map((message) => message.role)).toEqual(['system', 'user', 'assistant', 'tool', 'assistant', 'user']);
    expect(allText(next)).not.toContain('Old body');
    expect(allText(next)).not.toContain('[App note: edits this run');
  });

  it('follows the option per send and keeps the call stored while it is off', async () => {
    const requests = scriptChat(editRun);
    const { result, rerender } = renderSession(false);

    await act(async () => {
      await result.current.handleAsk('Rewrite Harbor');
    });
    await act(async () => {
      await result.current.handleAsk('What changed?');
    });
    expect(allText(requests[2])).toContain('[App note: edits this run: ');
    expect(replayedCalls(requests[2])).toEqual([]);
    const events = Object.values(result.current.toolEventsByMessageId).flat();
    expect(events.find((event) => event.toolName === 'update_entry')?.call?.body).toBe('Fog');

    rerender({ keepEdits: true });
    await act(async () => {
      await result.current.handleAsk('Now change the word in edit 1');
    });
    expect(replayedCalls(requests[3])).toEqual([{ name: 'update_entry', arguments: '{"id":"4","content":"Fog"}' }]);
  });

  it('replays as XML text for a provider that rejects native tools', async () => {
    const xmlConfig = { ...aiConfig, baseUrl: 'http://keep-edits-xml.test/v1' };
    getCapabilityCache(xmlConfig.baseUrl, xmlConfig.modelId).rejectedParams.add('tools');
    const requests = scriptChat([
      { content: '<tool_call>\nupdate_entry\nid: 4\n---\nFog\n</tool_call>' },
      { content: 'Done.' },
    ]);
    const { result } = renderSession(true, xmlConfig);

    await act(async () => {
      await result.current.handleAsk('Rewrite Harbor');
    });
    await act(async () => {
      await result.current.handleAsk('Change the word in edit 1');
    });
    const next = requests[2];
    expect(replayedCalls(next)).toEqual([]);
    expect(next.some((message) => message.role === 'tool')).toBe(false);
    expect(next.map((message) => message.role)).toEqual(['system', 'user', 'assistant', 'user', 'assistant', 'user']);
    expect(next[2].content).toBe('<tool_call>\nupdate_entry\nid: 4\n---\nFog\n</tool_call>');
    expect(next[3].content).toBe('Tool results:\n[update_entry] ok #4 Harbor');
  });
});

