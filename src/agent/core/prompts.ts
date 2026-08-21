export const ACTION_SYNTAX = `Action format:
<tool_call>
tool_name
header: value
---
body
</tool_call>

Tools with no body: <tool_call>list_entries</tool_call>
You may also use <tool_call name="tool_name">…</tool_call>
Headers are one per line as key: value. The body starts after a line that is exactly --- and ends at </tool_call>.
Do not wrap a whole lorebook in JSON. Prose may appear outside the action. Always close every <tool_call>.`;
