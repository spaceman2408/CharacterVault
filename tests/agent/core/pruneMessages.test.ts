import { describe, expect, it } from 'vitest';
import {
  pruneMessagesToBudget,
  TOOL_RESULTS_PREFIX,
  TRUNCATION_SUFFIX,
} from '../../../src/agent/core/pruneMessages';
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

const sys = (content = 'system prompt') => ({ role: 'system' as const, content });
const user = (content: string): AgentMessage => ({ role: 'user', content });

function nativeExchange(tag: string, body: string, speech = ''): AgentMessage[] {
  return [
    {
      role: 'assistant',
      content: speech,
      tool_calls: [{ id: `call_${tag}`, name: 'read_entry', arguments: '{}' }],
    },
    { role: 'tool', tool_call_id: `call_${tag}`, content: body },
  ];
}

function xmlExchange(tag: string, body: string, speech = `thinking ${tag}`): AgentMessage[] {
  return [
    { role: 'assistant', content: speech },
    { role: 'user', content: `${TOOL_RESULTS_PREFIX}[read_entry] ${body}` },
  ];
}

/** Every assistant tool_calls id must have its tool reply present and vice versa. */
function expectValidPairing(messages: AgentMessage[]) {
  const called = new Set<string>();
  const answered = new Set<string>();
  for (const message of messages) {
    for (const call of message.tool_calls ?? []) called.add(call.id);
    if (message.role === 'tool' && message.tool_call_id) answered.add(message.tool_call_id);
  }
  expect([...called].sort()).toEqual([...answered].sort());
}

describe('pruneMessagesToBudget passthrough', () => {
  it('returns under-budget input referentially unchanged', () => {
    const messages: AgentMessage[] = [sys(), user('go'), ...nativeExchange('a', 'body')];
    expect(pruneMessagesToBudget(messages, charMeasure(messages), charMeasure)).toBe(messages);
    expect(pruneMessagesToBudget(messages, charMeasure(messages) + 1000, charMeasure)).toBe(
      messages,
    );
  });

  it('returns degenerate inputs unchanged', () => {
    expect(pruneMessagesToBudget([], 10, charMeasure)).toEqual([]);
    const single: AgentMessage[] = [sys()];
    expect(pruneMessagesToBudget(single, 10, charMeasure)).toBe(single);
    const messages: AgentMessage[] = [sys(), user('go')];
    expect(pruneMessagesToBudget(messages, 0, charMeasure)).toBe(messages);
    expect(pruneMessagesToBudget(messages, -5, charMeasure)).toBe(messages);
  });

  it('does not mutate the input', () => {
    const messages: AgentMessage[] = [
      sys(),
      user('history question'),
      ...nativeExchange('old', 'x'.repeat(5000)),
      ...nativeExchange('new', 'y'.repeat(5000)),
      user('go'),
    ];
    const snapshot = JSON.stringify(messages);
    pruneMessagesToBudget(messages, 2000, charMeasure);
    expect(JSON.stringify(messages)).toBe(snapshot);
  });
});

describe('pruneMessagesToBudget drop phase', () => {
  it('drops the oldest native exchanges first and keeps pairing valid', () => {
    const survivors = [sys(), user('first question')];
    const messages: AgentMessage[] = [
      ...survivors,
      ...nativeExchange('one', 'A'.repeat(1000)),
      ...nativeExchange('two', 'B'.repeat(1000)),
      ...nativeExchange('three', 'C'.repeat(1000)),
      user('latest question'),
    ];
    const budget = charMeasure([...survivors, ...nativeExchange('three', 'C'.repeat(1000)), user('latest question')]);
    const pruned = pruneMessagesToBudget(messages, budget, charMeasure);
    expect(pruned.map((m) => m.content)).toEqual([
      'system prompt',
      'first question',
      '',
      'C'.repeat(1000),
      'latest question',
    ]);
    expectValidPairing(pruned);
    expect(charMeasure(pruned)).toBeLessThanOrEqual(budget);
  });

  it('keeps a multi-tool exchange atomic', () => {
    const exchange: AgentMessage[] = [
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          { id: 'call_a', name: 'read_entry', arguments: '{}' },
          { id: 'call_b', name: 'read_entry', arguments: '{}' },
        ],
      },
      { role: 'tool', tool_call_id: 'call_a', content: 'AAA' },
      { role: 'tool', tool_call_id: 'call_b', content: 'BBB' },
    ];
    const messages: AgentMessage[] = [sys(), ...nativeExchange('old', 'Z'.repeat(2000)), ...exchange, user('go')];
    const budget = charMeasure([sys(), ...exchange, user('go')]);
    const pruned = pruneMessagesToBudget(messages, budget, charMeasure);
    expect(pruned).toHaveLength(1 + exchange.length + 1);
    expectValidPairing(pruned);
  });

  it('drops oldest XML assistant+blob pairs first', () => {
    const messages: AgentMessage[] = [
      sys(),
      user('question'),
      ...xmlExchange('one', 'A'.repeat(1000)),
      ...xmlExchange('two', 'B'.repeat(1000)),
      user('follow-up'),
    ];
    const budget = charMeasure([sys(), user('question'), ...xmlExchange('two', 'B'.repeat(1000)), user('follow-up')]);
    const pruned = pruneMessagesToBudget(messages, budget, charMeasure);
    expect(pruned.map((m) => m.content)).toEqual([
      'system prompt',
      'question',
      'thinking two',
      `${TOOL_RESULTS_PREFIX}[read_entry] ${'B'.repeat(1000)}`,
      'follow-up',
    ]);
  });

  it('pins the first user message while dropping lone history singletons', () => {
    const messages: AgentMessage[] = [
      sys(),
      user('stale history one'),
      user('stale history two'),
      ...nativeExchange('only', 'body'),
      user('go'),
    ];
    const budget = charMeasure([sys(), user('stale history one'), ...nativeExchange('only', 'body'), user('go')]);
    const pruned = pruneMessagesToBudget(messages, budget, charMeasure);
    expect(pruned.map((m) => m.content)).toEqual([
      'system prompt',
      'stale history one',
      '',
      'body',
      'go',
    ]);
    expectValidPairing(pruned);
  });

  it('drops a huge middle user question as a singleton instead of truncating it', () => {
    const bigQuestion = 'Q'.repeat(5000);
    const messages: AgentMessage[] = [sys(), user('anchor'), user(bigQuestion), ...nativeExchange('n', 'body'), user('go')];
    const budget = charMeasure([sys(), user('anchor'), ...nativeExchange('n', 'body'), user('go')]);
    const pruned = pruneMessagesToBudget(messages, budget, charMeasure);
    expect(pruned.every((m) => m.content !== bigQuestion)).toBe(true);
    expect(pruned.every((m) => typeof m.content !== 'string' || !m.content.includes(TRUNCATION_SUFFIX.trim()))).toBe(true);
    expect(pruned.map((m) => m.content)).toEqual(['system prompt', 'anchor', '', 'body', 'go']);
  });
});

describe('pruneMessagesToBudget hog-guard phase', () => {
  it('caps older hogs at the absolute 32k ceiling on generous budgets', () => {
    const messages: AgentMessage[] = [
      sys(),
      ...nativeExchange('old1', 'H'.repeat(40000)),
      ...nativeExchange('old2', 'J'.repeat(40000)),
      ...nativeExchange('new', 'fresh'),
      user('go'),
    ];
    const pruned = pruneMessagesToBudget(messages, 70000, charMeasure);
    expect(pruned).toHaveLength(messages.length);
    for (const tag of ['H', 'J']) {
      const capped = pruned.find((m) => typeof m.content === 'string' && m.content.startsWith(tag));
      expect(capped!.content).toContain(TRUNCATION_SUFFIX.trim());
      expect(charMeasure([capped!])).toBeLessThanOrEqual(32000);
      expect(charMeasure([capped!])).toBeGreaterThan(30000);
    }
    expect(pruned[pruned.length - 2].content).toBe('fresh');
    expect(charMeasure(pruned)).toBeLessThanOrEqual(70000);
    expectValidPairing(pruned);
  });

  it('caps relative to a small budget via the hog fraction', () => {
    const hog = 'H'.repeat(5000);
    const messages: AgentMessage[] = [sys(), ...nativeExchange('old', hog), ...nativeExchange('new', 'fresh'), user('go')];
    const pruned = pruneMessagesToBudget(messages, 4000, charMeasure);
    expect(pruned).toHaveLength(messages.length);
    const capped = pruned.find((m) => typeof m.content === 'string' && m.content.includes('H'));
    expect(capped).toBeDefined();
    expect(capped!.content).toContain(TRUNCATION_SUFFIX.trim());
    expect(charMeasure([capped!])).toBeLessThanOrEqual(Math.floor(4000 * 0.5));
    expectValidPairing(pruned);
  });

  it('exempts the system prompt, speech, newest exchange, and trailing question from hog caps', () => {
    const messages: AgentMessage[] = [
      sys('S'.repeat(40000)),
      { role: 'assistant', content: 'A'.repeat(40000) },
      ...nativeExchange('new', 'B'.repeat(40000)),
      user('C'.repeat(40000)),
    ];
    const pruned = pruneMessagesToBudget(messages, 130000, charMeasure);
    expect(pruned.map((m) => m.content)).toEqual([
      'S'.repeat(40000),
      '',
      'B'.repeat(40000),
      'C'.repeat(40000),
    ]);
    expectValidPairing(pruned);
  });

  it('respects custom hog fraction and ceiling options', () => {
    const hog = 'H'.repeat(30000);
    const messages: AgentMessage[] = [sys(), ...nativeExchange('old', hog), ...nativeExchange('new', 'fresh'), user('go')];
    const pruned = pruneMessagesToBudget(messages, 20000, charMeasure, {
      hogFraction: 1,
      maxHogTokens: 1000,
    });
    expect(pruned).toHaveLength(messages.length);
    const capped = pruned.find((m) => typeof m.content === 'string' && m.content.includes('H'));
    expect(capped!.content).toContain(TRUNCATION_SUFFIX.trim());
    expect(charMeasure([capped!])).toBeLessThanOrEqual(1000);
    expectValidPairing(pruned);
  });
});

describe('pruneMessagesToBudget last resort', () => {
  it('trims the newest exchange just enough to fit, keeping pairing valid', () => {
    const body = 'N'.repeat(5000);
    const messages: AgentMessage[] = [sys('S'), ...nativeExchange('new', body), user('Q')];
    const pinned = charMeasure([sys('S'), user('Q')]);
    const budget = pinned + 2000;
    const pruned = pruneMessagesToBudget(messages, budget, charMeasure);
    expect(charMeasure(pruned)).toBeLessThanOrEqual(budget);
    const tool = pruned.find((m) => m.role === 'tool');
    expect(tool!.content).toContain(TRUNCATION_SUFFIX.trim());
    expect(tool!.content).toContain('N');
    expectValidPairing(pruned);
  });

  it('sends as-is when system plus trailing question alone exceed the budget', () => {
    const messages: AgentMessage[] = [sys('S'.repeat(5000)), ...nativeExchange('new', 'body'), user('Q')];
    const pruned = pruneMessagesToBudget(messages, 100, charMeasure);
    expect(pruned[0].content).toBe('S'.repeat(5000));
    expect(pruned[pruned.length - 1].content).toBe('Q');
    expectValidPairing(pruned);
  });

  it('preserves assistant speech verbatim while trimming only tool bodies', () => {
    const speech = 'reasoning aloud about the harbor';
    const messages: AgentMessage[] = [sys('S'), ...nativeExchange('new', 'N'.repeat(5000), speech), user('Q')];
    const pinned = charMeasure([sys('S'), user('Q')]);
    const pruned = pruneMessagesToBudget(messages, pinned + 100, charMeasure);
    const assistant = pruned.find((m) => m.role === 'assistant');
    expect(assistant!.content).toBe(speech);
  });
});
