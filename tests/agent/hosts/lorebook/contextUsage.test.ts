import { describe, expect, it } from 'vitest';
import { createEmptyCharacterBook } from '../../../../src/db/characterTypes';
import { computeAgentContextUsage } from '../../../../src/agent/hosts/lorebook/contextUsage';

describe('computeAgentContextUsage', () => {
  it('uses sampler contextLength as the 100% limit', () => {
    const usage = computeAgentContextUsage({
      book: createEmptyCharacterBook('World'),
      customContextCharLength: 0,
      customContextIncluded: false,
      history: [],
      contextLength: 8192,
    });
    expect(usage.limit).toBe(8192);
    expect(usage.tokens).toBeGreaterThan(0);
    expect(usage.percentage).toBeGreaterThan(0);
    expect(usage.percentage).toBeLessThan(50);
    expect(usage.status).toBe('good');
  });

  it('counts enabled custom context and chat history', () => {
    const without = computeAgentContextUsage({
      book: createEmptyCharacterBook('World'),
      customContextCharLength: 0,
      customContextIncluded: false,
      history: [],
      contextLength: 8192,
    });
    const withNotes = computeAgentContextUsage({
      book: createEmptyCharacterBook('World'),
      customContextCharLength: 4000,
      customContextIncluded: true,
      history: [{ content: 'Build a lorebook from these notes.' }],
      contextLength: 8192,
    });
    expect(withNotes.tokens).toBeGreaterThan(without.tokens);
  });

  it('marks danger when usage is over 80% of the window', () => {
    const usage = computeAgentContextUsage({
      book: createEmptyCharacterBook('World'),
      customContextCharLength: 20_000,
      customContextIncluded: true,
      history: [],
      contextLength: 1024,
    });
    expect(usage.status).toBe('danger');
    expect(usage.percentage).toBe(100);
  });
});
