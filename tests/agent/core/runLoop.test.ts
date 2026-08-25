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
        `<<<add_entry
name: Keep
keys: keep
---
Castle
>>>
<<<add_entry
name: Harbor
keys: harbor
---
Docks
>>>`,
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
    expect(persist).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(2);
    expect(host.extraContextChunks).toHaveBeenCalledTimes(1);
    const secondMessages = complete.mock.calls[1][0];
    const toolFollowUp = secondMessages[secondMessages.length - 1];
    expect(toolFollowUp.role).toBe('user');
    expect(toolFollowUp.content).toContain('[add_entry] ok add_entry');
    const promptedWithTools = onPrompt.mock.calls.some((call) => {
      const prompt = call[0] as AgentMessage[];
      return prompt.some(
        (message) =>
          typeof message.content === 'string' && message.content.includes('[add_entry] ok add_entry'),
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
        return { content: '<<<list_entries>>>' };
      },
      userMessage: 'go',
      maxTurns: 3,
    });
    expect(result.reason).toBe('max_turns');
    expect(turns).toBe(3);
    expect(persist).toHaveBeenCalledTimes(1);
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

  it('salvages an unclosed add_entry that already has headers and a body', async () => {
    const { host, calls } = fakeHost();
    const complete = vi.fn(
      scriptedComplete([
        `<<<add_entry
name: Keep
keys: keep
---
Castle`,
        'Stopped.',
      ]),
    );
    const events: AgentEvent[] = [];
    const result = await runLoop({
      host,
      complete,
      userMessage: 'go',
      onEvent: collect(events).push,
    });
    expect(result.reason).toBe('complete');
    expect(calls[0]?.headers.name).toBe('Keep');
    expect(calls[0]?.body).toBe('Castle');
    expect(events.some((event) => event.type === 'tool_result' && event.result.toolName === 'incomplete_action')).toBe(
      false,
    );
  });

  it('feeds a name-only incomplete call back with applied names', async () => {
    const { host } = fakeHost();
    const complete = vi.fn(
      scriptedComplete([
        `<tool_call>
add_entry
name: Keep
keys: keep
---
Castle
</tool_call>
<tool_call>
add_entry`,
        'Stopped.',
      ]),
    );
    const events: AgentEvent[] = [];
    const result = await runLoop({
      host,
      complete,
      userMessage: 'go',
      onEvent: collect(events).push,
    });
    expect(result.reason).toBe('complete');
    const incomplete = events.find(
      (event) => event.type === 'tool_result' && event.result.toolName === 'incomplete_action',
    );
    expect(incomplete?.type === 'tool_result' && incomplete.result.message).toContain('Applied:');
    expect(incomplete?.type === 'tool_result' && incomplete.result.message).toContain('Re-emit ONLY');
    const followUp = complete.mock.calls[1][0].at(-1);
    expect(followUp?.content).toContain('incomplete_action');
  });

  it('continues once when finish_reason is length and the tail is not salvageable', async () => {
    const { host, calls } = fakeHost();
    const complete = vi.fn(
      scriptedComplete([
        { content: '<tool_call>\nadd_entry\n', finishReason: 'length' },
        `name: Keep
keys: keep
---
Castle
</tool_call>`,
        'Stopped.',
      ]),
    );
    const result = await runLoop({
      host,
      complete,
      userMessage: 'go',
    });
    expect(result.reason).toBe('complete');
    expect(complete).toHaveBeenCalledTimes(3);
    expect(calls[0]?.headers.name).toBe('Keep');
    const continueMessages = complete.mock.calls[1][0];
    expect(continueMessages.at(-1)?.content).toContain('cut off');
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

  it('does not parse XML from the body in native mode', async () => {
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
      toolMode: 'native',
    });
    expect(result.reason).toBe('complete');
    expect(calls).toHaveLength(0);
  });

  it('rebuilds an XML prompt after native tools are rejected', async () => {
    const { host, calls } = fakeHost();
    host.buildSystemPrompt = ({ extraChunks, toolMode }) =>
      `${toolMode ?? 'none'}\n${extraChunks.join('\n')}`;
    let attempts = 0;
    const complete = vi.fn(async (messages: AgentMessage[]) => {
      attempts += 1;
      if (attempts === 1) {
        expect(messages[0]?.content).toContain('native');
        throw Object.assign(new Error('Unknown parameter: tools'), { type: 'tools_unsupported' });
      }
      expect(messages[0]?.content).toContain('xml');
      if (attempts === 2) {
        return {
          content: `<tool_call>
add_entry
name: Keep
keys: keep
---
Castle
</tool_call>`,
        };
      }
      return { content: 'Stopped.' };
    });
    const result = await runLoop({
      host,
      complete,
      userMessage: 'go',
      toolMode: 'native',
    });
    expect(result.reason).toBe('complete');
    expect(attempts).toBe(3);
    expect(calls[0]?.headers.name).toBe('Keep');
  });
});
