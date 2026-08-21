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

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type AgentDoneReason = 'complete' | 'max_turns' | 'abort' | 'error';

export type AgentEvent =
  | { type: 'assistant_text'; text: string; reasoning?: string }
  | { type: 'tool_start'; toolName: string }
  | { type: 'tool_result'; result: ActionResult }
  | { type: 'error'; message: string }
  | { type: 'done'; reason: AgentDoneReason };

export type CompleterChunk = { content?: string; reasoning?: string };

export type Completer = (
  messages: AgentMessage[],
  onChunk?: (chunk: CompleterChunk) => void,
) => Promise<{ content: string; reasoning?: string }>;

export interface AgentHost {
  readonly toolNames: readonly string[];
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
  isAborted?: () => boolean;
  maxTurns?: number;
  maxActionsPerTurn?: number;
}

export interface RunLoopResult {
  reason: AgentDoneReason;
}
