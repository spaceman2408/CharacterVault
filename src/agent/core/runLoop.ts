import { parseActions } from './parseActions';
import { stripFences } from './stripFences';
import { mapNativeToolCalls } from './toolCalls';
import type {
  ActionResult,
  AgentMessage,
  NativeToolCall,
  ParseResult,
  RunLoopOptions,
  RunLoopResult,
} from './types';

export const DEFAULT_MAX_TURNS = 32;
export const DEFAULT_MAX_ACTIONS_PER_TURN = 12;
export const AGENT_MAX_OUTPUT_TOKENS = 16384;

const CONTINUE_NUDGE =
  'Your last tool_call was cut off (output length). Continue exactly from the cutoff and close </tool_call>. Do not repeat completed calls.';

export function isLengthFinish(reason: string | null | undefined): boolean {
  if (!reason) return false;
  const normalized = reason.toLowerCase();
  return normalized === 'length' || normalized === 'max_tokens' || normalized === 'max_output_tokens';
}

export function formatToolResults(results: ActionResult[]): string {
  const lines = results.map((result) => `[${result.toolName}] ${result.message}`);
  return `Tool results:\n${lines.join('\n')}`;
}

function unfinishedNameFromRaw(raw: string): string | null {
  const named = /\bname\s*=\s*"([^"]+)"/i.exec(raw);
  if (named?.[1] && named[1].toLowerCase() !== 'tool_name') return named[1];
  const fence = /^<<<([A-Za-z][A-Za-z0-9_]*)/.exec(raw.trim());
  if (fence?.[1]) return fence[1];
  const afterOpen = raw.replace(/^[\s\S]*?<tool_call[^>]*>/i, '');
  const first = afterOpen.trim().split('\n')[0]?.trim().replace(/\(\s*\)\s*$/, '');
  if (first && /^[A-Za-z][A-Za-z0-9_]*$/.test(first) && first.toLowerCase() !== 'tool_name') {
    return first;
  }
  return null;
}

function appliedLabels(results: ActionResult[]): string[] {
  const labels: string[] = [];
  for (const result of results) {
    if (!result.ok) continue;
    const ok = /^ok\s+(.+)$/.exec(result.message.trim());
    labels.push(ok?.[1] ?? result.message.trim() ?? result.toolName);
  }
  return labels;
}

export function formatIncompleteAction(
  parsed: ParseResult,
  applied: ActionResult[],
  unfinished?: string | null,
): ActionResult {
  const incomplete = parsed.segments.find((segment) => segment.kind === 'incomplete');
  const raw = incomplete && incomplete.kind === 'incomplete' ? incomplete.raw : '';
  const name = unfinished ?? unfinishedNameFromRaw(raw);
  const stub = raw.replace(/\s+/g, ' ').trim().slice(0, 240);
  const appliedText = appliedLabels(applied);
  const parts = ['incomplete_action: a tool_call was cut off before it was closed.'];
  if (appliedText.length > 0) parts.push(`Applied: ${appliedText.join(', ')}.`);
  if (name) parts.push(`Unfinished: ${name}.`);
  if (stub) parts.push(`Stub: ${stub}`);
  parts.push('Re-emit ONLY the unfinished call, fully closed. Do not repeat applied calls.');
  return {
    ok: false,
    toolName: 'incomplete_action',
    message: parts.join(' '),
  };
}

function formatIncompleteNative(call: NativeToolCall, applied: ActionResult[]): ActionResult {
  const stub = call.arguments.replace(/\s+/g, ' ').trim().slice(0, 240);
  const appliedText = appliedLabels(applied);
  const parts = ['incomplete_action: a tool call JSON was cut off.'];
  if (appliedText.length > 0) parts.push(`Applied: ${appliedText.join(', ')}.`);
  if (call.name) parts.push(`Unfinished: ${call.name}.`);
  if (stub) parts.push(`Stub: ${stub}`);
  parts.push('Re-emit ONLY the unfinished call as valid JSON. Do not repeat applied calls.');
  return {
    ok: false,
    toolName: 'incomplete_action',
    message: parts.join(' '),
  };
}

export async function runLoop(options: RunLoopOptions): Promise<RunLoopResult> {
  const {
    host,
    complete,
    userMessage,
    history = [],
    onEvent,
    onChunk,
    onPrompt,
    isAborted = () => false,
    maxTurns = DEFAULT_MAX_TURNS,
    maxActionsPerTurn = DEFAULT_MAX_ACTIONS_PER_TURN,
  } = options;

  const emit = onEvent ?? (() => undefined);

  const extra = await host.extraContextChunks();
  const messages: AgentMessage[] = [
    { role: 'system', content: host.buildSystemPrompt({ extraChunks: extra }) },
    ...history.filter((message) => message.role !== 'system'),
    { role: 'user', content: userMessage },
  ];
  const notifyPrompt = (prompt: AgentMessage[] = messages) => {
    onPrompt?.(prompt);
  };

  const finish = async (reason: RunLoopResult['reason']): Promise<RunLoopResult> => {
    await host.flush?.();
    emit({ type: 'done', reason });
    return { reason };
  };

  for (let turn = 0; turn < maxTurns; turn += 1) {
    if (isAborted()) {
      return finish('abort');
    }

    let content: string;
    let reasoning: string | undefined;
    let finishReason: string | null | undefined;
    let toolCalls: NativeToolCall[] = [];
    try {
      notifyPrompt();
      const result = await complete(messages, onChunk);
      content = result.content ?? '';
      reasoning = result.reasoning;
      finishReason = result.finishReason;
      toolCalls = result.toolCalls ?? [];
    } catch (err) {
      if (isAborted()) {
        return finish('abort');
      }
      const message = err instanceof Error ? err.message : 'Agent request failed';
      emit({ type: 'error', message });
      return finish('error');
    }

    if (isAborted()) {
      return finish('abort');
    }

    let parsed: ParseResult;
    let nativeIds: string[] = [];
    let nativeIncomplete: NativeToolCall | null = null;
    const native = toolCalls.length > 0;

    if (native) {
      const mapped = mapNativeToolCalls(toolCalls);
      parsed = {
        segments: mapped.actions.map((action) => ({ kind: 'action' as const, action })),
        actions: mapped.actions,
        speech: content,
        incomplete: mapped.incomplete != null,
      };
      nativeIds = mapped.ids;
      nativeIncomplete = mapped.incomplete;
    } else {
      parsed = parseActions(content);
      if (parsed.incomplete && isLengthFinish(finishReason)) {
        if (isAborted()) {
          return finish('abort');
        }
        try {
          const continuationMessages: AgentMessage[] = [
            ...messages,
            { role: 'assistant', content },
            { role: 'user', content: CONTINUE_NUDGE },
          ];
          notifyPrompt(continuationMessages);
          const continuation = await complete(
            continuationMessages,
            onChunk,
          );
          content += continuation.content ?? '';
          if (continuation.reasoning) {
            reasoning = `${reasoning ?? ''}${continuation.reasoning}`;
          }
          parsed = parseActions(content);
        } catch (err) {
          if (isAborted()) {
            return finish('abort');
          }
          const message = err instanceof Error ? err.message : 'Agent request failed';
          emit({ type: 'error', message });
          return finish('error');
        }
      }
    }

    emit({
      type: 'assistant_text',
      text: stripFences(content),
      reasoning,
    });

    const toRun = parsed.actions.slice(0, maxActionsPerTurn);
    const extras = parsed.actions.slice(maxActionsPerTurn);
    const results: ActionResult[] = [];
    const nativeResultById = new Map<string, ActionResult>();

    for (let index = 0; index < toRun.length; index += 1) {
      if (isAborted()) {
        return finish('abort');
      }
      const action = toRun[index];
      emit({ type: 'tool_start', toolName: action.name });
      const result = host.toolNames.includes(action.name)
        ? await host.execute(action)
        : {
            ok: false,
            toolName: action.name,
            message: `unknown_action: ${action.name}`,
          };
      results.push(result);
      emit({ type: 'tool_result', result });
      const nativeId = nativeIds[index];
      if (nativeId) nativeResultById.set(nativeId, result);
    }

    for (let extraIndex = 0; extraIndex < extras.length; extraIndex += 1) {
      const extraAction = extras[extraIndex];
      const result: ActionResult = {
        ok: false,
        toolName: extraAction.name,
        message: `too_many_actions: max ${maxActionsPerTurn} per turn`,
      };
      results.push(result);
      emit({ type: 'tool_result', result });
      const nativeId = nativeIds[toRun.length + extraIndex] ?? toolCalls[toRun.length + extraIndex]?.id;
      if (nativeId) nativeResultById.set(nativeId, result);
    }

    if (parsed.incomplete) {
      const incomplete = nativeIncomplete
        ? formatIncompleteNative(nativeIncomplete, results)
        : formatIncompleteAction(parsed, results);
      results.push(incomplete);
      emit({ type: 'tool_result', result: incomplete });
    }

    if (toRun.length === 0 && extras.length === 0 && !parsed.incomplete) {
      return finish('complete');
    }

    if (native) {
      messages.push({
        role: 'assistant',
        content: content || '',
        tool_calls: toolCalls,
      });
      for (const call of toolCalls) {
        const result = nativeResultById.get(call.id);
        if (result) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: result.message,
          });
        }
      }
      if (nativeIncomplete) {
        const last = results[results.length - 1];
        if (last?.toolName === 'incomplete_action') {
          messages.push({
            role: 'tool',
            tool_call_id: nativeIncomplete.id || 'incomplete',
            content: last.message,
          });
        }
      }
    } else {
      messages.push({ role: 'assistant', content });
      messages.push({ role: 'user', content: formatToolResults(results) });
    }
    notifyPrompt();
  }

  return finish('max_turns');
}
