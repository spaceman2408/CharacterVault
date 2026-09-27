import type { ChatMessage } from '../../components/ai/types';
import { stripFences } from '../core/stripFences';
import type { AgentMessage } from '../core/types';
import { formatToolEvent } from './formatToolEvent';
import { REVIEW_NOTE_TOOL, visibleToolEvents } from './notices';
import type { AgentToolEvent } from './types';

/**
 * Prior chat as the model sees it: one assistant message per run, with a note
 * naming what that run changed and how review went. Bodies are never resent;
 * the model reads current text with tools.
 */
export function toLoopHistory(
  history: ChatMessage[],
  toolEventsByMessageId: Record<string, AgentToolEvent[]>,
  lookupToolNames: ReadonlySet<string>,
): AgentMessage[] {
  const messages: AgentMessage[] = [];
  let speech: string[] = [];
  let edits: string[] = [];
  let review: string[] = [];

  const flushRun = () => {
    const parts = [...speech];
    if (edits.length > 0) parts.push(`[App note: edits this run: ${edits.join('; ')}]`);
    if (review.length > 0) parts.push(`[App note: review: ${review.join(' ')}]`);
    if (parts.length > 0) messages.push({ role: 'assistant', content: parts.join('\n\n') });
    speech = [];
    edits = [];
    review = [];
  };

  for (const message of history) {
    if (message.role === 'user') {
      flushRun();
      messages.push({ role: 'user', content: message.content });
      continue;
    }
    const text = stripFences(message.content).trim();
    if (text) speech.push(text);
    const events = toolEventsByMessageId[message.id] ?? [];
    for (const event of events) {
      if (event.toolName === REVIEW_NOTE_TOOL) review.push(event.message);
    }
    for (const event of visibleToolEvents(events, lookupToolNames)) {
      if (event.ok) edits.push(formatToolEvent(event));
    }
  }
  flushRun();
  return messages;
}
