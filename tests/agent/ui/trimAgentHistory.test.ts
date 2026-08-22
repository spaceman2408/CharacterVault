import { describe, expect, it } from 'vitest';
import {
  AGENT_MAX_CHAT_MESSAGES,
  trimAgentHistory,
} from '../../../src/agent/ui/useAgentSession';
import type { ChatMessage } from '../../../src/components/ai/types';
import type { AgentToolEvent } from '../../../src/agent/ui/types';

function makeMessage(id: string, role: 'user' | 'assistant'): ChatMessage {
  return { id, role, content: `content-${id}`, timestamp: 1 };
}

describe('trimAgentHistory', () => {
  it('returns the inputs unchanged at or under the cap', () => {
    const history = [makeMessage('m1', 'user'), makeMessage('m2', 'assistant')];
    const events = { m2: [{ toolName: 'read_entry', ok: true, message: '#1' }] };
    const errors = { m2: 'boom' };
    const result = trimAgentHistory(history, events, errors);
    expect(result.history).toBe(history);
    expect(result.toolEventsByMessageId).toBe(events);
    expect(result.errorByMessageId).toBe(errors);
  });

  it('slices oldest-first at the cap and preserves order', () => {
    const ids = Array.from({ length: AGENT_MAX_CHAT_MESSAGES + 2 }, (_, i) => `m${i}`);
    const history = ids.map((id) => makeMessage(id, 'user'));
    const result = trimAgentHistory(history, {}, {});
    expect(result.history).toHaveLength(AGENT_MAX_CHAT_MESSAGES);
    expect(result.history[0].id).toBe('m2');
    expect(result.history[result.history.length - 1].id).toBe(ids[ids.length - 1]);
    expect(result.history.map((m) => m.id)).toEqual(ids.slice(2));
  });

  it('drops tool events and errors for trimmed messages only', () => {
    const count = AGENT_MAX_CHAT_MESSAGES + 3;
    const history: ChatMessage[] = Array.from({ length: count }, (_, i) =>
      makeMessage(`m${i}`, i % 2 === 0 ? 'user' : 'assistant'),
    );
    const events = Object.fromEntries(
      history.map((m, i): [string, AgentToolEvent[]] => [
        m.id,
        [{ toolName: `update_entry_${i}`, ok: true, message: `ok #${i}` }],
      ]),
    );
    const errors = Object.fromEntries(history.map((m) => [m.id, `error-${m.id}`]));

    const result = trimAgentHistory(history, events, errors);

    const keepIds = new Set(result.history.map((m) => m.id));
    expect(Object.keys(result.toolEventsByMessageId).sort()).toEqual(
      [...keepIds].sort(),
    );
    expect(Object.keys(result.errorByMessageId).sort()).toEqual([...keepIds].sort());
    expect('m0' in result.toolEventsByMessageId).toBe(false);
    expect('m1' in result.errorByMessageId).toBe(false);
  });
});
