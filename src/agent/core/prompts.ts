export const ACTION_SYNTAX = `If native tools are unavailable, use XML:
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
