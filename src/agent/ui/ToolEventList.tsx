import React from 'react';
import { Check, Eye, ScrollText, X } from 'lucide-react';
import { formatToolEvent } from './formatToolEvent';
import { foldToolRows, isLookupEvent } from './notices';
import type { AgentToolEvent, AgentToolTarget } from './types';

export function ToolEventList({
  events,
  lost = false,
  onOpenTarget,
}: {
  events: AgentToolEvent[];
  /** Writes that never landed: shown struck through and not clickable. Lookups are unaffected. */
  lost?: boolean;
  onOpenTarget?: (target: AgentToolTarget) => void;
}): React.ReactElement | null {
  if (events.length === 0) return null;
  return (
    <ul className="space-y-1">
      {foldToolRows(events).map(({ event, count }, index) => {
        const ok = event.ok;
        const lookup = isLookupEvent(event);
        const notSaved = ok && lost && !lookup;
        const clickable = Boolean(ok && !notSaved && event.target && onOpenTarget);
        const Icon = !ok ? X : lookup ? (event.toolName === 'read_skill' ? ScrollText : Eye) : Check;
        const className = `flex w-full items-start gap-1.5 rounded-md px-2 py-1 text-left text-xs leading-5 ${
          notSaved || lookup
            ? 'border border-border bg-surface text-fg-muted'
            : ok
              ? 'bg-success-soft text-success-soft-fg'
              : 'bg-danger-soft text-danger-soft-fg'
        } ${clickable ? 'hover:opacity-90 cursor-pointer' : ''}`;
        const times = count > 1 ? <span className="ml-auto shrink-0 pl-2 tabular-nums opacity-70">×{count}</span> : null;
        const inner = notSaved ? (
          <>
            <span className="line-through" title="Not saved">{formatToolEvent(event)}</span>
            {times}
          </>
        ) : (
          <>
            <Icon className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>{formatToolEvent(event)}</span>
            {times}
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
