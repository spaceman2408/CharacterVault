import { describe, expect, it } from 'vitest';
import { formatAgentToolGuide, MENTIONS_GUIDE } from '../../../src/agent/core/prompts';

describe('formatAgentToolGuide', () => {
  it('explains @-mentions in both tool modes', () => {
    expect(formatAgentToolGuide('native', 'tools')).toContain(MENTIONS_GUIDE);
    expect(formatAgentToolGuide('xml', 'tools')).toContain(MENTIONS_GUIDE);
  });

  it('lists the tools in XML mode only, since native mode sends them as schemas', () => {
    expect(formatAgentToolGuide('native', '- some_tool — id.')).not.toContain('some_tool');
    expect(formatAgentToolGuide('xml', '- some_tool — id.')).toContain('- some_tool — id.');
  });
});
