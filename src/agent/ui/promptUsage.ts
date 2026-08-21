import { estimateTokens } from '../../services/AIService';
import type { AgentMessage } from '../core/types';
import {
  usageStatus,
  type AgentContextUsage,
} from '../hosts/lorebook/contextUsage';

const MESSAGE_OVERHEAD_TOKENS = 6;

function messageTokenText(message: AgentMessage): string {
  const parts: string[] = [];
  if (message.content) parts.push(message.content);
  if (message.tool_calls?.length) parts.push(JSON.stringify(message.tool_calls));
  if (message.tool_call_id) parts.push(message.tool_call_id);
  return parts.join('\n');
}

export function estimatePromptTokens(messages: readonly AgentMessage[]): number {
  let tokens = 0;
  for (const message of messages) {
    tokens += estimateTokens(messageTokenText(message)) + MESSAGE_OVERHEAD_TOKENS;
  }
  return tokens;
}

export function withLivePromptTokens(
  baseline: AgentContextUsage,
  livePromptTokens: number | null,
): AgentContextUsage {
  if (livePromptTokens == null) return baseline;
  const limit = Math.max(1, baseline.limit);
  const percentage = Math.min(100, (livePromptTokens / limit) * 100);
  return {
    tokens: livePromptTokens,
    limit: baseline.limit,
    percentage,
    status: usageStatus(percentage),
  };
}
