import React from 'react';
import { Check, List, AlertCircle } from 'lucide-react';
import type { AgentToolEvent } from './types';

function formatToolEvent(event: AgentToolEvent): string {
  if (event.toolName === 'add_entry' && event.ok) {
    const match = /^ok #(\d+)\s+(.*)$/.exec(event.message);
    if (match) return `Added “${match[2]}” (#${match[1]})`;
  }
  if (event.toolName === 'list_entries' && event.ok) {
    const match = /^(\d+)\s/.exec(event.message);
    if (match) {
      const count = match[1];
      return `Listed ${count} ${count === '1' ? 'entry' : 'entries'}`;
    }
    return 'Listed entries';
  }
  return event.message;
}

export function ToolEventList({ events }: { events: AgentToolEvent[] }): React.ReactElement | null {
  if (events.length === 0) return null;
  return (
    <ul className="ml-1 space-y-1">
      {events.map((event, index) => {
        const Icon = !event.ok ? AlertCircle : event.toolName === 'list_entries' ? List : Check;
        return (
          <li
            key={`${event.toolName}-${index}`}
            className={`flex items-start gap-1.5 text-[11px] ${
              event.ok ? 'text-fg-muted' : 'text-danger'
            }`}
          >
            <Icon className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{formatToolEvent(event)}</span>
          </li>
        );
      })}
    </ul>
  );
}
