import type { AgentToolMode } from './types';

export const ACTION_SYNTAX = `Use XML:
<tool_call>
add_entry
name: Harbor
keys: harbor, port
---
A busy harbor.
</tool_call>

Tools with no body: <tool_call>list_entries</tool_call>
You may also use <tool_call name="add_entry">…</tool_call>
Put the real tool id as the first line or in name="…". Never write the word tool_name.
Headers are one per line as key: value. The body starts after a line that is exactly --- and ends at </tool_call>.
Do not wrap a whole lorebook in one JSON blob. Always close every <tool_call> before starting the next.`;

export const NATIVE_TOOL_INTRO =
  'Call tools with the provided functions. Do not write tool XML or JSON in the message body.';

export const HISTORY_NOTES_GUIDE =
  'Earlier replies and tool results may include [App note: …] lines. The app adds them to list what that run changed, what the user kept after review, and why a run stopped. Never write them yourself.';

export const MENTIONS_GUIDE =
  'In user messages, @Name points at the field, greeting, or entry with that name, e.g. @Description, @Greeting 2, or @“Harbor” (#4) for entry #4.';

export function formatAgentToolGuide(
  mode: AgentToolMode,
  toolList: string,
  xmlSyntax: string = ACTION_SYNTAX,
): string {
  if (mode === 'native') {
    return `${NATIVE_TOOL_INTRO}

${toolList}

You may emit up to 12 actions per reply, then wait for tool results. Finish each call with complete JSON arguments before starting the next.

${HISTORY_NOTES_GUIDE}

${MENTIONS_GUIDE}`;
  }
  return `${xmlSyntax}

${toolList}

You may emit up to 12 actions per reply, then wait for tool results. Close every </tool_call> before starting the next.

${HISTORY_NOTES_GUIDE}

${MENTIONS_GUIDE}`;
}
