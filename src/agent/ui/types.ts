export type AgentToolTarget =
  | { type: 'field'; id: string }
  | { type: 'greeting'; index: number }
  | { type: 'entry'; id: number };

export interface AgentBusyAction {
  toolName: string;
  headers: Record<string, string>;
}

export interface AgentToolEvent {
  toolName: string;
  ok: boolean;
  message: string;
  target?: AgentToolTarget;
}
