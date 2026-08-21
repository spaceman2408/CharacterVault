import { describe, expect, it, vi } from 'vitest';
import { runLoop } from '../../../src/agent/core/runLoop';
import type {
  ActionResult,
  AgentEvent,
  AgentHost,
  Completer,
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

function scriptedComplete(replies: Array<string | { content: string; reasoning?: string }>): Completer {
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
    const result = await runLoop({
      host,
      complete,
      userMessage: 'build it',
      onEvent: collect(events).push,
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

  it('feeds incomplete fences back and continues', async () => {
    const { host } = fakeHost();
    const complete = vi.fn(
      scriptedComplete([
        `<<<add_entry
name: Keep
keys: keep
---
unterminated`,
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
    expect(events.some((event) => event.type === 'tool_result' && event.result.toolName === 'incomplete_action')).toBe(
      true,
    );
    const followUp = complete.mock.calls[1][0].at(-1);
    expect(followUp?.content).toContain('incomplete_action');
  });
});
