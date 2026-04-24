# Greetings Editor

The **Greetings** tab provides a dedicated two-panel editor for managing alternate greetings — the first messages your character sends during roleplay.

## Two-Panel Layout

The greetings editor uses a sidebar + detail layout:

- **Left sidebar** — Lists all greetings with content indicators and token counts.
- **Right panel** — Full CodeMirror editor with AI toolbar for the selected greeting.

On mobile, the sidebar and detail panel switch between each other — tap a greeting to open it, tap **Back to greetings** to return to the list.

## Greeting List Sidebar

Each greeting card shows:

- **Content indicator** — A green dot means the greeting has content; a grey dot means it's empty.
- **Label** — "Greeting 1", "Greeting 2", etc.
- **Token count** — Shown for the currently selected greeting.
- **Delete button** — Appears on hover. Removing a greeting requires confirmation.

### Adding Greetings

Click **New Greeting** at the bottom of the sidebar to add a blank greeting. The new greeting is automatically selected for editing.

### Deleting Greetings

Hover over a greeting card and click the trash icon. A confirmation dialog asks you to confirm before the greeting is removed. If you delete the currently selected greeting, selection moves to the previous one.

## Greeting Editor

Selecting a greeting opens the full CodeMirror editor on the right. The editor includes all the same features as other text editors:

- **AI toolbar** — Enhance, Rephrase, Custom, and polish operations. See [Text Editor → AI Toolbar](/features/editor#ai-toolbar).
- **Search & Replace** — Press `Ctrl+F` or click the 🔍 button.
- **Font size** — Click **aA** to adjust.
- **Auto-save** — Changes are saved automatically with a short debounce (250ms after you stop typing).

## Tips

- **First Message vs. Greetings** — The **First Message** tab is the primary greeting. The Greetings tab holds alternate greetings that give players a choice of opening messages.
- **Use the AI toolbar** — Select a greeting and use Enhance or Custom to quickly rewrite or improve it.
- **Keep greetings distinct** — Each greeting should offer a noticeably different opening scenario or tone so players have meaningful choices.

## Next Steps

- [Text Editor features](/features/editor)
- [Lorebook Editor](/features/lorebook-editor)
- [Configure AI provider](/configuration/ai-setup)
