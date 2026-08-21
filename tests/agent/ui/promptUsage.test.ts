import { describe, expect, it } from 'vitest';
import { estimatePromptTokens, withLivePromptTokens } from '../../../src/agent/ui/promptUsage';
import type { AgentContextUsage } from '../../../src/agent/hosts/lorebook/contextUsage';

describe('estimatePromptTokens', () => {
  it('counts tool-result bodies, not just user/assistant speech', () => {
    const withoutReads = estimatePromptTokens([
      { role: 'system', content: 'catalog only' },
      { role: 'user', content: 'read the book' },
    ]);
    const withReads = estimatePromptTokens([
      { role: 'system', content: 'catalog only' },
      { role: 'user', content: 'read the book' },
      { role: 'assistant', content: '', tool_calls: [{ id: '1', name: 'read_entry', arguments: '{"id":"3"}' }] },
      { role: 'tool', tool_call_id: '1', content: `${'alpha '.repeat(400)}` },
    ]);
    expect(withReads).toBeGreaterThan(withoutReads + 200);
  });
});

describe('withLivePromptTokens', () => {
  const baseline: AgentContextUsage = {
    tokens: 2000,
    limit: 8192,
    percentage: (2000 / 8192) * 100,
    status: 'good',
  };

  it('leaves the idle baseline alone', () => {
    expect(withLivePromptTokens(baseline, null)).toEqual(baseline);
  });

  it('replaces tokens with the live prompt size', () => {
    const live = withLivePromptTokens(baseline, 6000);
    expect(live.tokens).toBe(6000);
    expect(live.limit).toBe(8192);
    expect(live.percentage).toBeCloseTo((6000 / 8192) * 100);
    expect(live.status).toBe('warning');
  });
});
