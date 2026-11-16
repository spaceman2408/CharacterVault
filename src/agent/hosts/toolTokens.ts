import { estimateTokens } from '../../services/AIService';
import type { AgentToolSpec } from '../core/types';

/** Estimated size of the `tools` array as AIService sends it. */
export function estimateToolTokens(tools: readonly AgentToolSpec[] | undefined): number {
  if (!tools?.length) return 0;
  return estimateTokens(
    JSON.stringify(
      tools.map((tool) => ({
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: tool.parameters },
      })),
    ),
  );
}
