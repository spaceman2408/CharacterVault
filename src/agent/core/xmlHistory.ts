import { TOOL_RESULTS_PREFIX } from './pruneMessages';
import { parsedActionFromToolCall } from './toolCalls';
import type { ActionResult, AgentMessage, ParsedAction } from './types';

export function formatToolResults(results: Pick<ActionResult, 'toolName' | 'message'>[]): string {
  const lines = results.map((result) => `[${result.toolName}] ${result.message}`);
  return `${TOOL_RESULTS_PREFIX}${lines.join('\n')}`;
}

/** One call in the XML syntax the prompt teaches. XML headers are single-line; newlines fold to spaces, as replace matching does. */
export function renderXmlCall(action: ParsedAction): string {
  const lines = [action.name];
  for (const [key, value] of Object.entries(action.headers)) {
    lines.push(`${key}: ${value.replace(/\s*\n\s*/g, ' ')}`);
  }
  if (action.body) lines.push('---', action.body);
  return `<tool_call>\n${lines.join('\n')}\n</tool_call>`;
}

/**
 * Rewrites native `tool_calls` / `role: tool` turns as XML text plus a user
 * result blob, for a run that falls back to XML after its history was built.
 */
export function nativeToXmlMessages(messages: AgentMessage[]): AgentMessage[] {
  const out: AgentMessage[] = [];
  let pending: { toolName: string; message: string }[] = [];
  let namesById = new Map<string, string>();

  const flushResults = () => {
    if (pending.length > 0) out.push({ role: 'user', content: formatToolResults(pending) });
    pending = [];
  };

  for (const message of messages) {
    if (message.role === 'tool') {
      pending.push({
        toolName: namesById.get(message.tool_call_id ?? '') ?? 'tool',
        message: message.content ?? '',
      });
      continue;
    }
    flushResults();
    if (message.role === 'assistant' && message.tool_calls?.length) {
      namesById = new Map(message.tool_calls.map((call) => [call.id, call.name]));
      const calls = message.tool_calls.map((call) =>
        renderXmlCall(parsedActionFromToolCall(call) ?? { name: call.name, headers: {}, body: call.arguments }),
      );
      const parts = message.content ? [message.content, ...calls] : calls;
      out.push({ role: 'assistant', content: parts.join('\n\n') });
      continue;
    }
    out.push(message);
  }
  flushResults();
  return out;
}

export function hasNativeToolTurns(messages: AgentMessage[]): boolean {
  return messages.some((message) => message.role === 'tool' || Boolean(message.tool_calls?.length));
}
