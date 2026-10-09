import type { ChatMessage } from '../../components/ai/types';
import { stripFences } from '../core/stripFences';
import type { AgentMessage } from '../core/types';
import { formatToolEvent } from './formatToolEvent';
import {
  REVIEW_NOTE_TOOL,
  RUN_INTERRUPTED_NOTE,
  RUN_INTERRUPTED_TOOL,
  TURN_LIMIT_NOTICE,
  visibleToolEvents,
} from './notices';
import type { AgentToolEvent } from './types';

/**
 * Prior chat as the model sees it: one assistant message per run, with notes
 * naming what that run changed, how review went, and whether it hit the turn
 * limit. Bodies are never resent; the model reads current text with tools.
 */
export function toLoopHistory(
  history: ChatMessage[],
  toolEventsByMessageId: Record<string, AgentToolEvent[]>,
  lookupToolNames: ReadonlySet<string>,
  errorByMessageId: Record<string, string> = {},
): AgentMessage[] {
  const messages: AgentMessage[] = [];
  let speech: string[] = [];
  let edits: string[] = [];
  let review: string[] = [];
  let hitTurnLimit = false;
  let interrupted = false;

  const flushRun = () => {
    const parts = [...speech];
    if (interrupted) parts.push(`[App note: ${RUN_INTERRUPTED_NOTE}]`);
    else if (edits.length > 0) parts.push(`[App note: edits this run: ${edits.join('; ')}]`);
    if (review.length > 0) parts.push(`[App note: review: ${review.join(' ')}]`);
    if (hitTurnLimit) parts.push(`[App note: ${TURN_LIMIT_NOTICE}]`);
    if (parts.length > 0) messages.push({ role: 'assistant', content: parts.join('\n\n') });
    speech = [];
    edits = [];
    review = [];
    hitTurnLimit = false;
    interrupted = false;
  };

  for (const message of history) {
    if (message.role === 'user') {
      flushRun();
      messages.push({ role: 'user', content: message.content });
      continue;
    }
    const text = stripFences(message.content).trim();
    if (text) speech.push(text);
    if (errorByMessageId[message.id] === TURN_LIMIT_NOTICE) hitTurnLimit = true;
    const events = toolEventsByMessageId[message.id] ?? [];
    for (const event of events) {
      if (event.toolName === REVIEW_NOTE_TOOL) review.push(event.message);
      if (event.toolName === RUN_INTERRUPTED_TOOL) interrupted = true;
    }
    for (const event of visibleToolEvents(events, lookupToolNames)) {
      if (event.ok) edits.push(formatToolEvent(event));
    }
  }
  flushRun();
  return messages;
}
