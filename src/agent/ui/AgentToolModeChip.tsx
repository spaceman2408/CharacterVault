import type { ReactElement } from 'react';
import type { AgentToolMode } from '../core/types';

export function AgentToolModeChip({ mode }: { mode: AgentToolMode }): ReactElement {
  const xml = mode === 'xml';
  return (
    <span
      className="hidden sm:inline-flex items-center rounded-md bg-hover px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted"
      title={
        xml
          ? 'This model rejected native tools. Later runs stay on XML until you change model or provider.'
          : 'Using native function calling.'
      }
    >
      {xml ? 'XML' : 'Native'}
    </span>
  );
}
