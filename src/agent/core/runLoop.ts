import { parseActions } from './parseActions';
import { stripFences } from './stripFences';
import type {
  ActionResult,
  AgentMessage,
  RunLoopOptions,
  RunLoopResult,
} from './types';

export const DEFAULT_MAX_TURNS = 16;
export const DEFAULT_MAX_ACTIONS_PER_TURN = 3;

export function formatToolResults(results: ActionResult[]): string {
  const lines = results.map((result) => `[${result.toolName}] ${result.message}`);
  return `Tool results:\n${lines.join('\n')}`;
}

export async function runLoop(options: RunLoopOptions): Promise<RunLoopResult> {
  const {
    host,
    complete,
    userMessage,
    history = [],
    onEvent,
    onChunk,
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
    try {
      const result = await complete(messages, onChunk);
      content = result.content;
      reasoning = result.reasoning;
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

    const parsed = parseActions(content);
    emit({
      type: 'assistant_text',
      text: stripFences(content),
      reasoning,
    });

    const toRun = parsed.actions.slice(0, maxActionsPerTurn);
    const extras = parsed.actions.slice(maxActionsPerTurn);
    const results: ActionResult[] = [];

    if (parsed.incomplete) {
      const incomplete: ActionResult = {
        ok: false,
        toolName: 'incomplete_action',
        message: 'incomplete_action: a tool_call was not closed with </tool_call>',
      };
      results.push(incomplete);
      emit({ type: 'tool_result', result: incomplete });
    }

    if (toRun.length === 0 && extras.length === 0 && !parsed.incomplete) {
      return finish('complete');
    }

    for (const action of toRun) {
      if (isAborted()) {
        return finish('abort');
      }
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
    }

    for (const extraAction of extras) {
      const result: ActionResult = {
        ok: false,
        toolName: extraAction.name,
        message: `too_many_actions: max ${maxActionsPerTurn} per turn`,
      };
      results.push(result);
      emit({ type: 'tool_result', result });
    }

    messages.push({ role: 'assistant', content });
    messages.push({ role: 'user', content: formatToolResults(results) });
  }

  return finish('max_turns');
}
