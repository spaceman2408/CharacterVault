import React from 'react';
import type { AgentToolEvent } from './types';

function formatToolEvent(event: AgentToolEvent): string {
  if (
    (event.toolName === 'add_entry' ||
      event.toolName === 'update_entry' ||
      event.toolName === 'delete_entry') &&
    event.ok
  ) {
    const match = /^ok #(\d+)\s+(.*)$/.exec(event.message);
    if (match) {
      const verb =
        event.toolName === 'update_entry'
          ? 'Updated'
          : event.toolName === 'delete_entry'
            ? 'Deleted'
            : 'Added';
      return `${verb} “${match[2]}” (#${match[1]})`;
    }
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
    <ul className="space-y-0.5">
      {events.map((event, index) => (
        <li key={`${event.toolName}-${index}`} className="text-xs text-fg-muted">
          {formatToolEvent(event)}
        </li>
      ))}
    </ul>
  );
}
