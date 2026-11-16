import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../src/db/characterTypes';
import { AGENT_MIN_CONTEXT_LENGTH, agentSamplerSettings } from '../../../src/agent/ui/agentSampler';

describe('agentSamplerSettings', () => {
  it('raises a smaller context length to the agent minimum and keeps the rest', () => {
    const sampler = { ...DEFAULT_SETTINGS.sampler, contextLength: 8192 };
    const raised = agentSamplerSettings(sampler);
    expect(raised.contextLength).toBe(AGENT_MIN_CONTEXT_LENGTH);
    expect(raised).toEqual({ ...sampler, contextLength: AGENT_MIN_CONTEXT_LENGTH });
    expect(sampler.contextLength).toBe(8192);
  });

  it('leaves a larger context length as it is', () => {
    const sampler = { ...DEFAULT_SETTINGS.sampler, contextLength: 200000 };
    expect(agentSamplerSettings(sampler)).toBe(sampler);
  });
});
