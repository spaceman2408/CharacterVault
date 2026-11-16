import { describe, expect, it } from 'vitest';
import { pruneMessagesToBudget } from '../../../src/agent/core/pruneMessages';
import type { AgentMessage } from '../../../src/agent/core/types';

function charMeasure(messages: readonly AgentMessage[]): number {
  let total = 0;
  for (const message of messages) {
    total += (message.content?.length ?? 0) + 6;
    if (message.tool_calls) total += JSON.stringify(message.tool_calls).length;
    if (message.tool_call_id) total += message.tool_call_id.length;
  }
  return total;
}

function exchange(tag: string, body: string): AgentMessage[] {
  return [
    {
      role: 'assistant',
      content: '',
      tool_calls: [{ id: `call_${tag}`, name: 'read_entry', arguments: '{}' }],
    },
    { role: 'tool', tool_call_id: `call_${tag}`, content: body },
  ];
}

const body = 'x'.repeat(300);
const head: AgentMessage[] = [
  { role: 'system', content: 'system prompt' },
  { role: 'user', content: 'go' },
];

describe('pruneMessagesToBudget dropTo', () => {
  it('drops older exchanges down to dropTo once the prompt is over budget', () => {
    const messages = [
      ...head,
      ...exchange('a', body),
      ...exchange('b', body),
      ...exchange('c', body),
      ...exchange('d', body),
    ];
    const budget = charMeasure(messages) - 1;
    const dropTo = Math.floor(budget * 0.5);
    const fitted = pruneMessagesToBudget(messages, budget, charMeasure);
    const held = pruneMessagesToBudget(messages, budget, charMeasure, { dropTo });
    expect(JSON.stringify(fitted)).toContain('call_b');
    expect(JSON.stringify(held)).not.toContain('call_b');
    expect(JSON.stringify(held)).toContain('call_d');
    expect(charMeasure(held)).toBeLessThanOrEqual(dropTo);
  });

  it('leaves an under-budget prompt alone even when it is over dropTo', () => {
    const messages = [...head, ...exchange('a', body)];
    const budget = charMeasure(messages);
    expect(pruneMessagesToBudget(messages, budget, charMeasure, { dropTo: 10 })).toBe(messages);
  });

  it('does not trim the newest exchange to reach dropTo', () => {
    const messages = [...head, ...exchange('a', body), ...exchange('b', body)];
    const budget = charMeasure(messages) - 1;
    const held = pruneMessagesToBudget(messages, budget, charMeasure, { dropTo: 50 });
    expect(held.at(-1)?.content).toBe(body);
  });
});
