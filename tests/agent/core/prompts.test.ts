import { describe, expect, it } from 'vitest';
import { AGENT_TOOL_GUIDE, MENTIONS_GUIDE } from '../../../src/agent/core/prompts';

describe('AGENT_TOOL_GUIDE', () => {
  it('explains @-mentions', () => {
    expect(AGENT_TOOL_GUIDE).toContain(MENTIONS_GUIDE);
  });

  it('teaches native functions and lists no tools', () => {
    expect(AGENT_TOOL_GUIDE).toContain('provided functions');
    expect(AGENT_TOOL_GUIDE).not.toMatch(/^- \w+ —/m);
  });
});
