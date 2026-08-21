import type { CharacterBook } from '../../../db/characterTypes';
import { estimateTokens } from '../../../services/AIService';
import { estimateCustomContextTokensFromCharLength } from '../../../services/CustomContextService';
import { formatEntryCatalog } from './catalog';
import { buildLorebookAgentSystemPrompt } from './prompt';

const MESSAGE_OVERHEAD_TOKENS = 6;

export type AgentContextUsageStatus = 'good' | 'warning' | 'danger';

export interface AgentContextUsage {
  tokens: number;
  limit: number;
  percentage: number;
  status: AgentContextUsageStatus;
}

export function usageStatus(percentage: number): AgentContextUsageStatus {
  if (percentage > 80) return 'danger';
  if (percentage > 50) return 'warning';
  return 'good';
}

export function computeAgentContextUsage(input: {
  book: CharacterBook;
  customContextCharLength: number;
  customContextIncluded: boolean;
  history: Array<{ content: string }>;
  contextLength: number;
}): AgentContextUsage {
  const limit = Math.max(1, input.contextLength || 0);
  const catalog = formatEntryCatalog(input.book);
  let tokens = estimateTokens(buildLorebookAgentSystemPrompt([catalog]));
  if (input.customContextIncluded && input.customContextCharLength > 0) {
    tokens += estimateCustomContextTokensFromCharLength(input.customContextCharLength);
  }
  for (const message of input.history) {
    tokens += estimateTokens(message.content) + MESSAGE_OVERHEAD_TOKENS;
  }
  const percentage = Math.min(100, (tokens / limit) * 100);
  return {
    tokens,
    limit,
    percentage,
    status: usageStatus(percentage),
  };
}
