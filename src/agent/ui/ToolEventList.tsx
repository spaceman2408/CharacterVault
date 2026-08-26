import React from 'react';
import { Check, X } from 'lucide-react';
import { formatToolEvent } from './formatToolEvent';
import type { AgentToolEvent, AgentToolTarget } from './types';

export function ToolEventList({
  events,
  onOpenTarget,
}: {
  events: AgentToolEvent[];
  onOpenTarget?: (target: AgentToolTarget) => void;
}): React.ReactElement | null {
  if (events.length === 0) return null;
  return (
    <ul className="space-y-1">
      {events.map((event, index) => {
        const ok = event.ok;
        const clickable = Boolean(ok && event.target && onOpenTarget);
        const className = `flex w-full items-start gap-1.5 rounded-md px-2 py-1 text-left text-xs leading-5 ${
          ok
            ? 'bg-success-soft text-success-soft-fg'
            : 'bg-danger-soft text-danger-soft-fg'
        } ${clickable ? 'hover:opacity-90 cursor-pointer' : ''}`;
        const inner = (
          <>
            {ok ? (
              <Check className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            ) : (
              <X className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            )}
            <span>{formatToolEvent(event)}</span>
          </>
        );
        return (
          <li key={`${event.toolName}-${index}`}>
            {clickable ? (
              <button
                type="button"
                className={className}
                onClick={() => onOpenTarget!(event.target!)}
              >
                {inner}
              </button>
            ) : (
              <div className={className}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
