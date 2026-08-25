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

export function formatAgentToolGuide(
  mode: AgentToolMode,
  toolList: string,
  xmlSyntax: string = ACTION_SYNTAX,
): string {
  if (mode === 'native') {
    return `${NATIVE_TOOL_INTRO}

${toolList}

You may emit up to 12 actions per reply, then wait for tool results. Finish each call with complete JSON arguments before starting the next.`;
  }
  return `${xmlSyntax}

${toolList}

You may emit up to 12 actions per reply, then wait for tool results. Close every </tool_call> before starting the next.`;
}
