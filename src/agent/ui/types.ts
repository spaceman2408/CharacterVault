export type AgentToolTarget =
  | { type: 'field'; id: string }
  | { type: 'greeting'; index: number }
  | { type: 'entry'; id: number };

export interface AgentToolEvent {
  toolName: string;
  ok: boolean;
  message: string;
  target?: AgentToolTarget;
}
