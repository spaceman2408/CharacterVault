import type { AgentToolEvent } from './types';

function parseOkEntry(
  message: string,
): { id: string; name: string; replaced?: number } | null {
  const match = /^ok #(\d+)\s+(.+)$/.exec(message);
  if (!match) return null;
  const replaced = /^(.*) — replaced (\d+)$/.exec(match[2]);
  if (replaced) {
    return { id: match[1], name: replaced[1], replaced: Number(replaced[2]) };
  }
  return { id: match[1], name: match[2] };
}

function parseOkField(
  message: string,
): { label: string; chars?: number; replaced?: number } | null {
  const replaced = /^ok \S+ \((.+)\) — replaced (\d+)(?: \((\d+) chars\))?$/.exec(
    message,
  );
  if (replaced) {
    return {
      label: replaced[1],
      replaced: Number(replaced[2]),
      chars: replaced[3] != null ? Number(replaced[3]) : undefined,
    };
  }
  const updated = /^ok \S+ \((.+)\) — (\d+) chars$/.exec(message);
  if (!updated) return null;
  return { label: updated[1], chars: Number(updated[2]) };
}

function parseOkGreeting(
  message: string,
): { index: number; total: number; replaced?: number } | null {
  const match = /^ok greeting (\d+)\/(\d+)(?: — replaced (\d+))?$/.exec(message);
  if (!match) return null;
  return {
    index: Number(match[1]),
    total: Number(match[2]),
    replaced: match[3] != null ? Number(match[3]) : undefined,
  };
}

function greetingSlot(index: number, total: number): string {
  return `greeting ${index} of ${total}`;
}

function failedToolLabel(toolName: string): string {
  if (toolName === 'incomplete_action') return 'Incomplete action';
  if (toolName === 'unknown_action') return 'Unknown action';
  return `Couldn't ${toolName.replace(/_/g, ' ')}`;
}

function failedToolDetail(message: string, toolName: string): string {
  let detail = message.trim();
  detail = detail.replace(/^(error|limit|exists):\s*/i, '');
  detail = detail.replace(new RegExp(`^${toolName}:\\s*`, 'i'), '');
  return detail.trim();
}

export function formatToolEvent(event: AgentToolEvent): string {
  if (!event.ok) {
    const label = failedToolLabel(event.toolName);
    const detail = failedToolDetail(event.message, event.toolName);
    if (!detail || detail === label) return label;
    return `${label} — ${detail}`;
  }

  if (event.toolName === 'replace_in_field') {
    const parsed = parseOkField(event.message);
    if (parsed?.replaced != null) return `Replaced ${parsed.replaced} in ${parsed.label}`;
  }

  if (event.toolName === 'update_field') {
    const parsed = parseOkField(event.message);
    if (parsed) {
      return parsed.chars != null
        ? `Updated ${parsed.label} (${parsed.chars} chars)`
        : `Updated ${parsed.label}`;
    }
  }

  if (
    event.toolName === 'add_entry' ||
    event.toolName === 'update_entry' ||
    event.toolName === 'delete_entry' ||
    event.toolName === 'replace_in_entry'
  ) {
    const parsed = parseOkEntry(event.message);
    if (parsed) {
      if (event.toolName === 'replace_in_entry' || parsed.replaced != null) {
        return parsed.replaced != null
          ? `Replaced ${parsed.replaced} in “${parsed.name}” (#${parsed.id})`
          : `Replaced in “${parsed.name}” (#${parsed.id})`;
      }
      const verb =
        event.toolName === 'update_entry'
          ? 'Updated'
          : event.toolName === 'delete_entry'
            ? 'Deleted'
            : 'Added';
      return `${verb} “${parsed.name}” (#${parsed.id})`;
    }
  }

  if (event.toolName === 'replace_in_greeting') {
    const parsed = parseOkGreeting(event.message);
    if (parsed?.replaced != null) {
      return `Replaced ${parsed.replaced} in ${greetingSlot(parsed.index, parsed.total)}`;
    }
  }

  if (event.toolName === 'add_greeting' || event.toolName === 'update_greeting') {
    const parsed = parseOkGreeting(event.message);
    if (parsed) {
      const verb = event.toolName === 'add_greeting' ? 'Added' : 'Updated';
      return `${verb} ${greetingSlot(parsed.index, parsed.total)}`;
    }
  }

  if (event.toolName === 'delete_greeting') {
    const match = /^ok deleted greeting (\d+); (\d+) remaining$/.exec(event.message);
    if (match) {
      const index = Number(match[1]);
      const remaining = match[2];
      return `Deleted greeting ${index} (${remaining} remaining)`;
    }
  }

  if (event.toolName === 'list_entries') {
    const match = /^(\d+)\s/.exec(event.message);
    if (match) {
      const count = match[1];
      return `Listed ${count} ${count === '1' ? 'entry' : 'entries'}`;
    }
    return 'Listed entries';
  }

  return event.message;
}
