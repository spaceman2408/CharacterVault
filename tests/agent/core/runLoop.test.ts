import { describe, expect, it, vi } from 'vitest';
import { runLoop } from '../../../src/agent/core/runLoop';
import type {
  ActionResult,
  AgentEvent,
  AgentHost,
  AgentMessage,
  Completer,
  CompleterResult,
  ParsedAction,
} from '../../../src/agent/core/types';

function fakeHost(execute?: (action: ParsedAction) => Promise<ActionResult>): {
  host: AgentHost;
  persist: ReturnType<typeof vi.fn>;
  calls: ParsedAction[];
} {
  const calls: ParsedAction[] = [];
  const persist = vi.fn(async () => undefined);
  const host: AgentHost = {
    toolNames: ['add_entry', 'list_entries'],
    tools: [],
    buildSystemPrompt: ({ extraChunks }) => `sys\n${extraChunks.join('\n')}`,
    extraContextChunks: vi.fn(async () => ['catalog']),
    async execute(action) {
      calls.push(action);
      if (execute) return execute(action);
      return { ok: true, toolName: action.name, message: `ok ${action.name}` };
    },
    flush: persist,
  };
  return { host, persist, calls };
}

function scriptedComplete(replies: Array<string | CompleterResult>): Completer {
  let index = 0;
  return async () => {
    const reply = replies[index] ?? 'done';
    index += 1;
    return typeof reply === 'string' ? { content: reply } : reply;
  };
}

let callSeq = 0;

function addEntry(name: string, content = 'Body'): CompleterResult {
  callSeq += 1;
  return {
    content: '',
    toolCalls: [
      { id: `call_${callSeq}`, name: 'add_entry', arguments: JSON.stringify({ name, keys: name.toLowerCase(), content }) },
    ],
  };
}

function collect(events: AgentEvent[]) {
  return {
    push: (event: AgentEvent) => {
      events.push(event);
    },
    done: () => events.filter((event) => event.type === 'done'),
    results: () =>
      events.filter((event) => event.type === 'tool_result').map((event) => event.result),
  };
}

describe('runLoop', () => {
  it('stops on speech-only output and does not execute tools', async () => {
    const { host, persist, calls } = fakeHost();
    const events: AgentEvent[] = [];
    const result = await runLoop({
      host,
      complete: scriptedComplete(['The book already covers this.']),
      userMessage: 'fill it in',
      onEvent: collect(events).push,
    });
    expect(result.reason).toBe('complete');
    expect(persist).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(0);
    expect(events.some((event) => event.type === 'tool_result')).toBe(false);
  });

  it('runs two add_entry actions, persists once, then feeds results back', async () => {
    const { host, persist, calls } = fakeHost();
    const complete = vi.fn(
      scriptedComplete([
        {
          content: '',
          toolCalls: [
            { id: 'call_keep', name: 'add_entry', arguments: '{"name":"Keep","keys":"keep","content":"Castle"}' },
            { id: 'call_harbor', name: 'add_entry', arguments: '{"name":"Harbor","keys":"harbor","content":"Docks"}' },
          ],
        },
        'All set.',
      ]),
    );
    const events: AgentEvent[] = [];
    const onPrompt = vi.fn();
    const result = await runLoop({
      host,
      complete,
      userMessage: 'build it',
      onEvent: collect(events).push,
      onPrompt,
    });
    expect(result.reason).toBe('complete');
    expect(calls.map((action) => action.headers.name)).toEqual(['Keep', 'Harbor']);
    const starts = events.filter((event) => event.type === 'tool_start');
    expect(starts.map((event) => event.headers.name)).toEqual(['Keep', 'Harbor']);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(2);
    expect(host.extraContextChunks).toHaveBeenCalledTimes(1);
    const secondMessages = complete.mock.calls[1][0];
    const toolFollowUp = secondMessages[secondMessages.length - 1];
    expect(toolFollowUp.role).toBe('tool');
    expect(toolFollowUp.content).toBe('ok add_entry');
    const promptedWithTools = onPrompt.mock.calls.some((call) => {
      const prompt = call[0] as AgentMessage[];
      return prompt.some(
        (message) =>
          message.role === 'tool' && message.content === 'ok add_entry',
      );
    });
    expect(promptedWithTools).toBe(true);
  });

  it('stops at the max turn cap', async () => {
    const { host, persist } = fakeHost();
    let turns = 0;
    const result = await runLoop({
      host,
      complete: async () => {
        turns += 1;
        return { content: '', toolCalls: [{ id: `call_${turns}`, name: 'list_entries', arguments: '{}' }] };
      },
      userMessage: 'go',
      maxTurns: 3,
    });
    expect(result.reason).toBe('max_turns');
    expect(turns).toBe(3);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('turns a throwing tool into a failed result and still persists', async () => {
    const { host, persist, calls } = fakeHost(async (action) => {
      if (action.headers.name === 'Bad') throw new Error('Failed to fetch dynamically imported module');
      return { ok: true, toolName: action.name, message: `ok ${action.name}` };
    });
    const complete = vi.fn(
      scriptedComplete([
        {
          content: '',
          toolCalls: [
            { id: 'call_keep', name: 'add_entry', arguments: '{"name":"Keep","keys":"keep","content":"Castle"}' },
            { id: 'call_bad', name: 'add_entry', arguments: '{"name":"Bad","keys":"bad","content":"Oops"}' },
          ],
        },
        'Saved the keep.',
      ]),
    );
    const events: AgentEvent[] = [];
    const result = await runLoop({ host, complete, userMessage: 'go', onEvent: collect(events).push });
    expect(result.reason).toBe('complete');
    expect(calls).toHaveLength(2);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(collect(events).results()).toEqual([
      { ok: true, toolName: 'add_entry', message: 'ok add_entry' },
      { ok: false, toolName: 'add_entry', message: 'error: Failed to fetch dynamically imported module' },
    ]);
    const replies = complete.mock.calls[1][0].filter((message: AgentMessage) => message.role === 'tool');
    expect(replies.map((message: AgentMessage) => message.tool_call_id)).toEqual(['call_keep', 'call_bad']);
  });

  it('stops on abort without throwing', async () => {
    let aborted = false;
    const { host, persist } = fakeHost();
    const result = await runLoop({
      host,
      complete: async () => {
        aborted = true;
        throw new Error('cancelled');
      },
      userMessage: 'go',
      isAborted: () => aborted,
    });
    expect(result.reason).toBe('abort');
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('prefers native tool_calls and echoes role=tool results', async () => {
    const { host, calls } = fakeHost();
    const complete = vi.fn(
      scriptedComplete([
        {
          content: '',
          toolCalls: [
            {
              id: 'call_keep',
              name: 'add_entry',
              arguments: '{"name":"Keep","keys":"keep","content":"Castle"}',
            },
          ],
        },
        'Stopped.',
      ]),
    );
    const result = await runLoop({
      host,
      complete,
      userMessage: 'go',
    });
    expect(result.reason).toBe('complete');
    expect(calls[0]?.headers.name).toBe('Keep');
    const followUp = complete.mock.calls[1][0];
    expect(followUp.some((message) => message.role === 'assistant' && message.tool_calls?.length)).toBe(true);
    expect(followUp.some((message) => message.role === 'tool' && message.tool_call_id === 'call_keep')).toBe(true);
  });

  it('echoes the turn reasoning on its native tool-call message only when there is some', async () => {
    const { host } = fakeHost();
    const call = (id: string) => ({
      id,
      name: 'add_entry',
      arguments: `{"name":"${id}","keys":"k","content":"c"}`,
    });
    const complete = vi.fn(
      scriptedComplete([
        { content: '', reasoning: 'Plan the keep.', toolCalls: [call('a')] },
        { content: '', toolCalls: [call('b')] },
        'Stopped.',
      ]),
    );
    await runLoop({ host, complete, userMessage: 'go' });
    const assistants = complete.mock.calls[2][0].filter((message) => message.tool_calls?.length);
    expect(assistants[0]?.reasoning_content).toBe('Plan the keep.');
    expect(assistants[1]).not.toHaveProperty('reasoning_content');
  });

  it('does not execute a native call cut off inside a string', async () => {
    const { host, calls } = fakeHost();
    const events: AgentEvent[] = [];
    const complete = vi.fn(
      scriptedComplete([
        {
          content: '',
          toolCalls: [
            {
              id: 'call_cut',
              name: 'add_entry',
              arguments: '{"name":"Keep","keys":"keep","content":"Cast',
            },
          ],
        },
        'Stopped.',
      ]),
    );
    const result = await runLoop({
      host,
      complete,
      userMessage: 'go',
      onEvent: collect(events).push,
    });
    expect(result.reason).toBe('complete');
    expect(calls).toHaveLength(0);
    const incomplete = events.find(
      (event) => event.type === 'tool_result' && event.result.toolName === 'incomplete_action',
    );
    expect(incomplete?.type === 'tool_result' && incomplete.result.message).toContain('tool call JSON was cut off');
  });

  it('runs the calls after a malformed one and answers every call id', async () => {
    const { host, calls } = fakeHost();
    const events: AgentEvent[] = [];
    const complete = vi.fn(
      scriptedComplete([
        {
          content: '',
          toolCalls: [
            { id: 'call_keep', name: 'add_entry', arguments: '{"name":"Keep","keys":"keep","content":"Castle"}' },
            { id: 'call_bad', name: 'add_entry', arguments: '{name: Bad}' },
            { id: 'call_dock', name: 'add_entry', arguments: '{"name":"Dock","keys":"dock","content":"Pier"}' },
          ],
        },
        'Stopped.',
      ]),
    );
    await runLoop({ host, complete, userMessage: 'go', onEvent: collect(events).push });
    expect(calls.map((action) => action.headers.name)).toEqual(['Keep', 'Dock']);
    const bad = collect(events).results().find((result) => !result.ok);
    expect(bad?.toolName).toBe('add_entry');
    expect(bad?.message).toContain('not valid JSON');
    expect(bad?.message).not.toContain('cut off');
    const replies = complete.mock.calls[1][0].filter((message: AgentMessage) => message.role === 'tool');
    expect(replies.map((message: AgentMessage) => message.tool_call_id)).toEqual(['call_keep', 'call_bad', 'call_dock']);
  });

  it('prunes the live prompt to maxInputTokens while keeping the newest exchange', async () => {
    const big = 'x'.repeat(2000);
    const { host } = fakeHost(async () => ({
      ok: true,
      toolName: 'add_entry',
      message: `ok ${big}`,
    }));
    const measure = (messages: readonly AgentMessage[]) =>
      messages.reduce((total, message) => total + (message.content?.length ?? 0), 0);
    const seenSizes: number[] = [];
    const seenJson: string[] = [];
    const inner = scriptedComplete([
      addEntry('Keep', 'Castle'),
      addEntry('Harbor', 'Docks'),
      'All set.',
    ]);
    const complete = vi.fn(async (messages: AgentMessage[]) => {
      seenSizes.push(measure(messages));
      seenJson.push(JSON.stringify(messages));
      return inner(messages);
    });
    const result = await runLoop({
      host,
      complete,
      userMessage: 'go',
      maxInputTokens: 3000,
      measurePrompt: measure,
    });
    expect(result.reason).toBe('complete');
    expect(seenSizes).toHaveLength(3);
    for (const size of seenSizes) {
      expect(size).toBeLessThanOrEqual(3000);
    }
    expect(seenJson[2]).toContain('Harbor');
    expect(seenJson[2]).not.toContain('Castle');
  });

  it('takes the tool definitions off the message budget', async () => {
    const big = 'x'.repeat(2000);
    const { host: base } = fakeHost(async () => ({ ok: true, toolName: 'add_entry', message: `ok ${big}` }));
    const host: AgentHost = { ...base, tools: [{ name: 'add_entry', description: 'Add', parameters: {} }] };
    const measure = (messages: readonly AgentMessage[]) =>
      messages.reduce((total, message) => total + (message.content?.length ?? 0), 0);
    const sizes: number[] = [];
    const prompted: number[] = [];
    const inner = scriptedComplete([
      { content: '', toolCalls: [{ id: 'c1', name: 'add_entry', arguments: '{"name":"Keep","keys":"keep","content":"Castle"}' }] },
      { content: '', toolCalls: [{ id: 'c2', name: 'add_entry', arguments: '{"name":"Dock","keys":"dock","content":"Pier"}' }] },
      'All set.',
    ]);
    const complete = vi.fn(async (messages: AgentMessage[]) => {
      sizes.push(measure(messages));
      return inner(messages);
    });
    await runLoop({
      host,
      complete,
      userMessage: 'go',
      maxInputTokens: 4000,
      toolTokens: 1500,
      measurePrompt: measure,
      onPrompt: (_messages, toolTokens) => prompted.push(toolTokens),
    });
    expect(sizes).toHaveLength(3);
    for (const size of sizes) expect(size).toBeLessThanOrEqual(2500);
    expect(new Set(prompted)).toEqual(new Set([1500]));
  });

  it('counts no tool tokens for a host without tools', async () => {
    const { host } = fakeHost();
    const prompted: number[] = [];
    await runLoop({
      host,
      complete: scriptedComplete(['Nothing to do.']),
      userMessage: 'go',
      maxInputTokens: 4000,
      toolTokens: 1500,
      measurePrompt: () => 10,
      onPrompt: (_messages, toolTokens) => prompted.push(toolTokens),
    });
    expect(prompted).toEqual([0]);
  });

  it('holds a pruned prefix across turns instead of moving the cut every turn', async () => {
    const { host } = fakeHost(async () => ({
      ok: true,
      toolName: 'add_entry',
      message: `ok ${'x'.repeat(400)}`,
    }));
    const measure = (messages: readonly AgentMessage[]) =>
      messages.reduce((total, message) => total + (message.content?.length ?? 0), 0);
    const requests: string[][] = [];
    const replies = Array.from(
      { length: 11 },
      (_, index) => addEntry(`Entry${index}`),
    );
    const inner = scriptedComplete([...replies, 'All set.']);
    const complete = vi.fn(async (messages: AgentMessage[]) => {
      requests.push(messages.map((message) => JSON.stringify(message)));
      return inner(messages);
    });
    await runLoop({ host, complete, userMessage: 'go', maxInputTokens: 3000, measurePrompt: measure });

    expect(requests).toHaveLength(12);
    let moved = 0;
    for (let index = 1; index < requests.length; index += 1) {
      const previous = requests[index - 1];
      const keptPrefix = previous.every((message, at) => requests[index][at] === message);
      if (!keptPrefix) moved += 1;
    }
    expect(moved).toBeGreaterThanOrEqual(1);
    expect(moved).toBeLessThanOrEqual(3);
  });

  it('does not parse tool XML from the message body', async () => {
    const { host, calls } = fakeHost();
    const result = await runLoop({
      host,
      complete: scriptedComplete([
        `<tool_call>
add_entry
name: Keep
keys: keep
---
Castle
</tool_call>`,
      ]),
      userMessage: 'go',
    });
    expect(result.reason).toBe('complete');
    expect(calls).toHaveLength(0);
  });

  const replayedHistory: AgentMessage[] = [
    { role: 'user', content: 'Add Harbor' },
    {
      role: 'assistant',
      content: '',
      tool_calls: [{ id: 'k00000001', name: 'add_entry', arguments: '{"name":"Harbor","content":"Fog."}' }],
    },
    { role: 'tool', tool_call_id: 'k00000001', content: 'ok #4 Harbor' },
    { role: 'assistant', content: 'Done.' },
  ];

  it('keeps replayed history as tool calls', async () => {
    const { host } = fakeHost();
    const complete = vi.fn(scriptedComplete(['Stopped.']));
    await runLoop({ host, complete, userMessage: 'go', history: replayedHistory });
    expect(complete.mock.calls[0][0].slice(1, -1)).toEqual(replayedHistory);
  });

  it('stops with the error when the provider rejects tools', async () => {
    const { host, persist } = fakeHost();
    const events: AgentEvent[] = [];
    const complete = vi.fn(async () => {
      throw Object.assign(new Error("This model doesn't support tool calling"), { type: 'tools_unsupported' });
    });
    const result = await runLoop({ host, complete, userMessage: 'go', onEvent: collect(events).push });
    expect(result.reason).toBe('error');
    expect(complete).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(events).toContainEqual({ type: 'error', message: "This model doesn't support tool calling" });
  });

  it('hands each executed action to its tool_result event', async () => {
    const { host } = fakeHost();
    const events: AgentEvent[] = [];
    await runLoop({
      host,
      complete: scriptedComplete([
        {
          content: '',
          toolCalls: [
            {
              id: 'call_keep',
              name: 'add_entry',
              arguments: '{"name":"Keep","keys":"keep","content":"Castle"}',
            },
          ],
        },
        'Stopped.',
      ]),
      userMessage: 'go',
      onEvent: collect(events).push,
    });
    const results = events.filter((event) => event.type === 'tool_result');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      result: { ok: true, toolName: 'add_entry' },
      action: { name: 'add_entry', headers: { name: 'Keep', keys: 'keep' }, body: 'Castle' },
    });
  });

  it('sends no action with results for calls that never ran', async () => {
    const { host } = fakeHost();
    const events: AgentEvent[] = [];
    const complete = vi.fn(
      scriptedComplete([
        {
          content: '',
          toolCalls: [
            { id: 'call_a', name: 'add_entry', arguments: '{"name":"Keep","content":"Castle"}' },
            { id: 'call_b', name: 'add_entry', arguments: '{"name":"Dock","content":"Pier"}' },
          ],
        },
        'Stopped.',
      ]),
    );
    await runLoop({
      host,
      maxActionsPerTurn: 1,
      complete,
      userMessage: 'go',
      onEvent: collect(events).push,
    });
    const results = events.filter((event) => event.type === 'tool_result');
    expect(results).toHaveLength(2);
    expect(results[0].type === 'tool_result' && results[0].action?.name).toBe('add_entry');
    expect(results[1].type === 'tool_result' && results[1].result.message).toContain('too_many_actions');
    expect(results[1].type === 'tool_result' && results[1].action).toBeUndefined();
    const replies = complete.mock.calls[1][0].filter((message: AgentMessage) => message.role === 'tool');
    expect(replies.map((message: AgentMessage) => message.tool_call_id)).toEqual(['call_a', 'call_b']);
  });
});
