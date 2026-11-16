import type { SamplerSettings } from '../../db/characterTypes';

/**
 * The agent's system prompt and tool definitions alone need several thousand tokens, and a run has
 * to keep what it has read. A smaller window makes pruning drop every earlier step, so the agent
 * forgets its own reads and repeats them.
 */
export const AGENT_MIN_CONTEXT_LENGTH = 65536;

/** Sampler the agent runs with: the user's settings, with the context length raised to the agent's minimum. */
export function agentSamplerSettings(sampler: SamplerSettings): SamplerSettings {
  if (sampler.contextLength >= AGENT_MIN_CONTEXT_LENGTH) return sampler;
  return { ...sampler, contextLength: AGENT_MIN_CONTEXT_LENGTH };
}
