export type AgentToolTarget =
  | { type: 'field'; id: string }
  | { type: 'greeting'; index: number }
  | { type: 'entry'; id: number };

export interface AgentBusyAction {
  toolName: string;
  headers: Record<string, string>;
}

export interface AgentToolCallArgs {
  headers: Record<string, string>;
  body: string;
}

export interface AgentToolEvent {
  toolName: string;
  ok: boolean;
  message: string;
  target?: AgentToolTarget;
  /** Arguments of a successful write, kept so later runs can be shown exactly what was sent. */
  call?: AgentToolCallArgs;
}
