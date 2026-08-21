import { describe, expect, it } from 'vitest';
import { lastUserMessageIndex } from '../../../src/agent/ui/useLorebookAgent';

describe('lastUserMessageIndex', () => {
  it('returns the last user message so abort can retry that turn', () => {
    expect(
      lastUserMessageIndex([
        { role: 'user' },
        { role: 'assistant' },
        { role: 'user' },
        { role: 'assistant' },
      ]),
    ).toBe(2);
  });

  it('returns -1 when there is no user message', () => {
    expect(lastUserMessageIndex([{ role: 'assistant' }])).toBe(-1);
    expect(lastUserMessageIndex([])).toBe(-1);
  });
});
