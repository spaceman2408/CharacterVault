# Greetings Editor

The **Greetings** tab provides a dedicated two-panel editor for managing alternate greetings — the first messages your character sends during roleplay.

The **First Message** tab holds the primary greeting. The Greetings tab holds the alternates that give players a choice of opening messages. The [Agent](/features/ai-agent) uses the same numbering: Greeting 1 is the first alternate.

## Two-Panel Layout

The greetings editor uses a sidebar + detail layout:

- **Left sidebar** — Lists all greetings with content indicators and token counts. The sidebar header shows the total token count.
- **Right panel** — Full CodeMirror editor with AI toolbar for the selected greeting.

On mobile, the sidebar and detail panel switch between each other — tap a greeting to open it, tap **Back** to return to the list.

## Greeting List Sidebar

Each greeting card shows:

- **Content indicator** — A green dot means the greeting has content; a grey dot means it's empty.
- **Label** — "Greeting 1", "Greeting 2", etc.
- **Token count** — The greeting's token count, or "Empty".
- **Preview** — A short preview of the greeting text.
- **Delete** — Removes the greeting after confirmation.
- **Duplicate** — Copies the greeting and inserts it immediately after. Confirm first.
- **Move up / down** — Reorder alternate greetings.

These buttons are always visible on each card.

### Adding Greetings

Click **New Greeting** at the bottom of the sidebar to add a blank greeting. The new greeting is automatically selected for editing.

### Duplicating Greetings

Use the copy control on a greeting row, or **Duplicate** in the detail header. A confirmation dialog inserts a copy right after the original and selects it.

### Reordering Greetings

Use the up/down controls on a greeting row. The first greeting cannot move up; the last cannot move down.

### Deleting Greetings

Click the trash icon on a greeting card, or **Delete** in the detail header. A confirmation dialog asks you to confirm before the greeting is removed; it cannot be undone. Use [Snapshots](/features/snapshots-history) to recover a deleted greeting.

If you delete the selected greeting, the next greeting is selected (or the previous one if you deleted the last).

## Greeting Editor

Selecting a greeting opens the full CodeMirror editor on the right. The editor includes all the same features as other text editors:

- **AI toolbar** — Enhance, Rephrase, Custom, and polish operations. See [Text Editor → AI Toolbar](/features/editor#ai-toolbar).
- **Search & Replace** — Press `Ctrl+F` or click the 🔍 button.
- **Font size** — Click **aA** to adjust.
- **Auto-save** — Changes are saved automatically with a short debounce (250ms after you stop typing).

## Tips

- **Agent.** Ask the character Agent to add or rewrite alternates. Changes show when the run finishes.
- **Use the AI toolbar** — Select a greeting and use Enhance or Custom to quickly rewrite or improve it.
- **Keep greetings distinct** — Each greeting should offer a noticeably different opening scenario or tone so players have meaningful choices.

## Next Steps

- [Text Editor features](/features/editor)
- [AI Agent](/features/ai-agent)
- [Lorebook Editor](/features/lorebook-editor)
- [Configure AI provider](/configuration/ai-setup)
