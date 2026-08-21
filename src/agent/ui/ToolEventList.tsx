import React from 'react';
import { Check, X } from 'lucide-react';
import { formatToolEvent } from './formatToolEvent';
import type { AgentToolEvent } from './types';

export function ToolEventList({ events }: { events: AgentToolEvent[] }): React.ReactElement | null {
  if (events.length === 0) return null;
  return (
    <ul className="space-y-1">
      {events.map((event, index) => {
        const ok = event.ok;
        return (
          <li
            key={`${event.toolName}-${index}`}
            className={`flex items-start gap-1.5 rounded-md px-2 py-1 text-xs leading-5 ${
              ok
                ? 'bg-success-soft text-success-soft-fg'
                : 'bg-danger-soft text-danger-soft-fg'
            }`}
          >
            {ok ? (
              <Check className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            ) : (
              <X className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            )}
            <span>{formatToolEvent(event)}</span>
          </li>
        );
      })}
    </ul>
  );
}
