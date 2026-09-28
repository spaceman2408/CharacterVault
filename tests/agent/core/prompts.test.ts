import { describe, expect, it } from 'vitest';
import { formatAgentToolGuide, MENTIONS_GUIDE } from '../../../src/agent/core/prompts';

describe('formatAgentToolGuide', () => {
  it('explains @-mentions in both tool modes', () => {
    expect(formatAgentToolGuide('native', 'tools')).toContain(MENTIONS_GUIDE);
    expect(formatAgentToolGuide('xml', 'tools')).toContain(MENTIONS_GUIDE);
  });
});
