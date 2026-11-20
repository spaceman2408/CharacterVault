import { PRUNE_HOLD_SHARE, pruneMessagesToBudget } from './pruneMessages';
import { stripFences } from './stripFences';
import { isValidToolName, mapNativeToolCalls } from './toolCalls';
import type {
  ActionResult,
  AgentHost,
  AgentMessage,
  NativeToolCall,
  ParsedAction,
  RunLoopOptions,
  RunLoopResult,
} from './types';

export const DEFAULT_MAX_TURNS = 32;
export const DEFAULT_MAX_ACTIONS_PER_TURN = 24;
export const AGENT_MAX_OUTPUT_TOKENS = 16384;

function appliedLabels(results: ActionResult[]): string[] {
  const labels: string[] = [];
  for (const result of results) {
    if (!result.ok) continue;
    const ok = /^ok\s+(.+)$/.exec(result.message.trim());
    labels.push(ok?.[1] ?? result.message.trim() ?? result.toolName);
  }
  return labels;
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

function formatInvalidNative(call: NativeToolCall): ActionResult {
  const name = call.name.trim();
  const problem = isValidToolName(name) ? 'its arguments are not valid JSON' : 'its name is not a tool name';
  const stub = call.arguments.replace(/\s+/g, ' ').trim().slice(0, 240);
  const parts = [`error: this call could not be read: ${problem}.`];
  if (stub) parts.push(`Stub: ${stub}`);
  parts.push('Re-send only this call, fixed.');
  return {
    ok: false,
    toolName: name || 'unknown_action',
    message: parts.join(' '),
  };
}

// A throw would skip flush() and lose the run's earlier writes.
async function executeAction(host: AgentHost, action: ParsedAction): Promise<ActionResult> {
  try {
    return await host.execute(action);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, toolName: action.name, message: `error: ${message}` };
  }
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
    maxInputTokens,
    measurePrompt,
    toolTokens = 0,
  } = options;

  const emit = onEvent ?? (() => undefined);

  const sentToolTokens = () => (host.tools.length > 0 ? toolTokens : 0);
  // At least 1: a budget of 0 or less turns pruning off instead of cutting to the minimum.
  const messageBudget = (limit: number) => Math.max(1, limit - sentToolTokens());

  const extra = await host.extraContextChunks();
  const messages: AgentMessage[] = [
    { role: 'system', content: host.buildSystemPrompt({ extraChunks: extra }) },
    ...history.filter((message) => message.role !== 'system'),
    { role: 'user', content: userMessage },
  ];
  // Re-pruning from the full list every turn would move the cut each time and miss the prompt cache.
  const holdBudget = () => {
    if (maxInputTokens == null || !measurePrompt) return;
    const budget = messageBudget(maxInputTokens);
    const pruned = pruneMessagesToBudget(messages, budget, measurePrompt, {
      dropTo: Math.floor(budget * PRUNE_HOLD_SHARE),
    });
    if (pruned !== messages) messages.splice(0, messages.length, ...pruned);
  };
  const notifyPrompt = () => {
    onPrompt?.(messages, sentToolTokens());
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
    let toolCalls: NativeToolCall[] = [];
    try {
      holdBudget();
      notifyPrompt();
      const result = await complete(messages, onChunk);
      content = result.content ?? '';
      reasoning = result.reasoning;
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

    const { actions, ids: nativeIds, invalid: nativeInvalid, incomplete: nativeIncomplete } =
      mapNativeToolCalls(toolCalls);

    emit({
      type: 'assistant_text',
      text: stripFences(content),
      reasoning,
    });

    const toRun = actions.slice(0, maxActionsPerTurn);
    const extras = actions.slice(maxActionsPerTurn);
    const results: ActionResult[] = [];
    const nativeResultById = new Map<string, ActionResult>();

    for (let index = 0; index < toRun.length; index += 1) {
      if (isAborted()) {
        return finish('abort');
      }
      const action = toRun[index];
      emit({ type: 'tool_start', toolName: action.name, headers: action.headers });
      const result = host.toolNames.includes(action.name)
        ? await executeAction(host, action)
        : {
            ok: false,
            toolName: action.name,
            message: `unknown_action: ${action.name}`,
          };
      results.push(result);
      emit({ type: 'tool_result', result, action });
      nativeResultById.set(nativeIds[index], result);
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
      nativeResultById.set(nativeIds[toRun.length + extraIndex], result);
    }

    // Strict providers reject the next request unless every call id gets a tool reply.
    for (const call of nativeInvalid) {
      const result = formatInvalidNative(call);
      results.push(result);
      emit({ type: 'tool_result', result });
      if (call.id) nativeResultById.set(call.id, result);
    }

    let incompleteResult: ActionResult | null = null;
    if (nativeIncomplete) {
      incompleteResult = formatIncompleteNative(nativeIncomplete, results);
      results.push(incompleteResult);
      emit({ type: 'tool_result', result: incompleteResult });
    }

    if (results.length === 0) {
      return finish('complete');
    }

    messages.push({
      role: 'assistant',
      content: content || '',
      tool_calls: toolCalls,
      ...(reasoning ? { reasoning_content: reasoning } : {}),
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
    if (nativeIncomplete && incompleteResult) {
      messages.push({
        role: 'tool',
        tool_call_id: nativeIncomplete.id || 'incomplete',
        content: incompleteResult.message,
      });
    }
    notifyPrompt();
  }

  return finish('max_turns');
}
