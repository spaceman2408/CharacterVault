import type { ChatMessage } from '../../components/ai/types';
import type { SamplerSettings } from '../../db/characterTypes';
import { AIService } from '../../services/AIService';
import { stripFences } from '../core/stripFences';
import type { AgentMessage, AgentToolMode, NativeToolCall } from '../core/types';
import { formatToolResults, renderXmlCall } from '../core/xmlHistory';
import { formatToolEvent } from './formatToolEvent';
import {
  REVIEW_NOTE_TOOL,
  RUN_INTERRUPTED_NOTE,
  RUN_INTERRUPTED_TOOL,
  TURN_LIMIT_NOTICE,
  visibleToolEvents,
} from './notices';
import { estimatePromptTokens, messageTokenText } from './promptUsage';
import type { AgentToolEvent } from './types';

export interface LoopHistoryOptions {
  /** Replay each earlier write as the tool call the model made, not a one-line summary. */
  keepEdits?: boolean;
  /** How replayed calls are written. Defaults to native. */
  toolMode?: AgentToolMode;
  /** A run whose replay would take more than this many tokens is sent as summary notes instead. */
  maxKeptRunTokens?: number;
}

/** Final reply for a replayed run that ended without speech, so a user turn never follows a tool result. */
export const KEPT_RUN_EMPTY_REPLY = 'Done.';

/** Share of the input budget one replayed run may take. Call arguments cannot be trimmed at send time. */
export const KEPT_RUN_BUDGET_SHARE = 0.25;

export function keptEditsOptions(
  keepEdits: boolean,
  toolMode: AgentToolMode,
  sampler: Pick<SamplerSettings, 'contextLength' | 'maxTokens'>,
): LoopHistoryOptions {
  return {
    keepEdits,
    toolMode,
    maxKeptRunTokens: Math.floor(AIService.inputTokenBudget(sampler) * KEPT_RUN_BUDGET_SHARE),
  };
}

/** Successful writes in the order they ran, without the add-then-revise merge the transcript shows. */
export function keptWriteEvents(
  events: AgentToolEvent[],
  lookupToolNames: ReadonlySet<string>,
): AgentToolEvent[] {
  return events.filter(
    (event) =>
      event.ok
      && !lookupToolNames.has(event.toolName)
      && event.toolName !== REVIEW_NOTE_TOOL
      && event.toolName !== RUN_INTERRUPTED_TOOL,
  );
}

/** 9 alphanumerics: the strictest tool call id format among OpenAI-compatible providers. */
function keptCallId(n: number): string {
  return `k${String(n).padStart(8, '0')}`;
}

function callArguments(call: NonNullable<AgentToolEvent['call']>): string {
  const args: Record<string, string> = { ...call.headers };
  if (call.body) args.content = call.body;
  return JSON.stringify(args);
}

function replayRun(
  writes: AgentToolEvent[],
  notes: string[],
  speech: string,
  toolMode: AgentToolMode,
  nextId: () => string,
): AgentMessage[] {
  const results = writes.map((event) => ({ toolName: event.toolName, message: event.message }));
  const last = results[results.length - 1];
  if (notes.length > 0) last.message = `${last.message}\n${notes.join('\n')}`;
  const reply: AgentMessage = { role: 'assistant', content: speech || KEPT_RUN_EMPTY_REPLY };

  if (toolMode === 'xml') {
    const calls = writes.map((event) =>
      renderXmlCall({ name: event.toolName, headers: event.call!.headers, body: event.call!.body }),
    );
    return [
      { role: 'assistant', content: calls.join('\n\n') },
      { role: 'user', content: formatToolResults(results) },
      reply,
    ];
  }

  const calls: NativeToolCall[] = writes.map((event) => ({
    id: nextId(),
    name: event.toolName,
    arguments: callArguments(event.call!),
  }));
  return [
    { role: 'assistant', content: '', tool_calls: calls },
    ...calls.map((call, index): AgentMessage => ({
      role: 'tool',
      tool_call_id: call.id,
      content: results[index].message,
    })),
    reply,
  ];
}

/**
 * Prior chat as the model sees it. Each run becomes one assistant message
 * with `[App note: …]` lines naming what it changed, how review went, and
 * whether it hit the turn limit. With `keepEdits`, a run's writes are instead
 * replayed as the tool calls and results they were, with the notes on the
 * last result. Lookup bodies are never resent.
 */
export function toLoopHistory(
  history: ChatMessage[],
  toolEventsByMessageId: Record<string, AgentToolEvent[]>,
  lookupToolNames: ReadonlySet<string>,
  errorByMessageId: Record<string, string> = {},
  options: LoopHistoryOptions = {},
): AgentMessage[] {
  const messages: AgentMessage[] = [];
  let speech: string[] = [];
  let edits: string[] = [];
  let writes: AgentToolEvent[] = [];
  let review: string[] = [];
  let hitTurnLimit = false;
  let interrupted = false;
  let callCount = 0;
  const nextId = () => keptCallId(++callCount);

  const reset = () => {
    speech = [];
    edits = [];
    writes = [];
    review = [];
    hitTurnLimit = false;
    interrupted = false;
  };

  const flushRun = () => {
    const notes: string[] = [];
    if (review.length > 0) notes.push(`[App note: review: ${review.join(' ')}]`);
    if (hitTurnLimit) notes.push(`[App note: ${TURN_LIMIT_NOTICE}]`);

    const canReplay =
      options.keepEdits && !interrupted && writes.length > 0 && writes.every((event) => event.call);
    if (canReplay) {
      const replay = replayRun(writes, notes, speech.join('\n\n'), options.toolMode ?? 'native', nextId);
      if (options.maxKeptRunTokens == null || estimatePromptTokens(replay) <= options.maxKeptRunTokens) {
        messages.push(...replay);
        reset();
        return;
      }
    }

    const parts = [...speech];
    if (interrupted) parts.push(`[App note: ${RUN_INTERRUPTED_NOTE}]`);
    else if (edits.length > 0) parts.push(`[App note: edits this run: ${edits.join('; ')}]`);
    parts.push(...notes);
    if (parts.length > 0) messages.push({ role: 'assistant', content: parts.join('\n\n') });
    reset();
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
    writes.push(...keptWriteEvents(events, lookupToolNames));
  }
  flushRun();
  return messages;
}

/** Transcript rows the idle context meter counts. Replayed calls are counted as they will be sent. */
export function contextMeterHistory(
  history: ChatMessage[],
  toolEventsByMessageId: Record<string, AgentToolEvent[]>,
  lookupToolNames: ReadonlySet<string>,
  errorByMessageId: Record<string, string>,
  options: LoopHistoryOptions,
): Array<{ content: string }> {
  if (!options.keepEdits) return history;
  return toLoopHistory(history, toolEventsByMessageId, lookupToolNames, errorByMessageId, options).map(
    (message) => ({ content: messageTokenText(message) }),
  );
}
