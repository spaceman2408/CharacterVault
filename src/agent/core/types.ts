export interface ParsedAction {
  name: string;
  headers: Record<string, string>;
  body: string;
}

export type ParseSegment =
  | { kind: 'speech'; text: string }
  | { kind: 'action'; action: ParsedAction }
  | { kind: 'incomplete'; raw: string };

export interface ParseResult {
  segments: ParseSegment[];
  actions: ParsedAction[];
  speech: string;
  incomplete: boolean;
}

export interface ActionResult {
  ok: boolean;
  toolName: string;
  message: string;
}

export interface NativeToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface AgentToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: NativeToolCall[];
  tool_call_id?: string;
}

export type AgentDoneReason = 'complete' | 'max_turns' | 'abort' | 'error';

export type AgentEvent =
  | { type: 'assistant_text'; text: string; reasoning?: string }
  | { type: 'tool_start'; toolName: string }
  | { type: 'tool_result'; result: ActionResult }
  | { type: 'error'; message: string }
  | { type: 'done'; reason: AgentDoneReason };

export type CompleterChunk = { content?: string; reasoning?: string };

export interface CompleterResult {
  content: string;
  reasoning?: string;
  finishReason?: string | null;
  toolCalls?: NativeToolCall[];
}

export type Completer = (
  messages: AgentMessage[],
  onChunk?: (chunk: CompleterChunk) => void,
) => Promise<CompleterResult>;

export interface AgentHost {
  readonly toolNames: readonly string[];
  readonly tools?: readonly AgentToolSpec[];
  buildSystemPrompt(input: { extraChunks: string[] }): string;
  extraContextChunks(): Promise<string[]>;
  execute(action: ParsedAction): Promise<ActionResult>;
  /** Persist side effects once per run. No-op when nothing changed. */
  flush?(): Promise<void>;
}

export interface RunLoopOptions {
  host: AgentHost;
  complete: Completer;
  userMessage: string;
  history?: AgentMessage[];
  onEvent?: (event: AgentEvent) => void;
  onChunk?: (chunk: CompleterChunk) => void;
  /** Live prompt for the next (or just-updated) completion. Do not retain the array. */
  onPrompt?: (messages: readonly AgentMessage[]) => void;
  isAborted?: () => boolean;
  maxTurns?: number;
  maxActionsPerTurn?: number;
}

export interface RunLoopResult {
  reason: AgentDoneReason;
}
