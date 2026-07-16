# Lorebook Editor

The **Lorebook** tab (also called World Info) provides a dedicated two-panel interface for managing character lore entries — extra information that gets injected into the AI's context based on keyword triggers.

::: tip
Lorebook entries affect how an AI plays your character during roleplay. For a quick overview of each field, see [Creating & Editing Characters → Lorebook](/getting-started/creating-characters#lorebook--world-info).
:::

## Two-Panel Layout

The lorebook editor uses a sidebar + detail layout:

- **Left sidebar** — Lists all entries with search, context toggles, and add/delete controls.
- **Right panel** — Full detail editor for the selected entry.

On mobile, the sidebar and detail panel switch between each other with a back button.

## Entry List Sidebar

Each entry in the sidebar shows:

- **Entry name** (or "Entry N" if unnamed)
- **Key count** and **token count** for the selected entry
- **Context toggle** (eye icon) — quickly include or exclude the entry from AI context without disabling it entirely
- **Delete button** — removes the entry (with confirmation)

### Search

Use the search bar at the top of the sidebar to filter entries by name, content, or trigger keys. A result count appears when a search is active.

### Book Settings

Click **Book Settings** at the top of the sidebar to expand:

- **Book Name** — A display name for the lorebook (e.g., "Character Lorebook").
- **Description** — A brief description of the lorebook's purpose.
- **Context Visibility** — **Enable All** / **Disable All** buttons to quickly toggle whether every entry is included in AI context.

### Adding Entries

Click **New Entry** at the bottom of the sidebar to add a blank entry. The new entry is automatically selected for editing.

## Entry Detail Editor

Selecting an entry in the sidebar opens its full editor on the right with these fields:

| Field | Description |
| :--- | :--- |
| **Entry Name** | Display name for the entry (optional) |
| **Trigger Keys** | Comma-separated keywords that activate the entry during AI conversations |
| **Priority** | Determines insertion order when multiple entries fire (lower = higher priority) |
| **Position** | Where the entry content is inserted in the prompt |
| **Enabled** | Whether the entry is active |
| **Case Sensitive** | Require exact case matching on trigger keys |
| **Constant** | Always include this entry in context, regardless of keyword triggers |
| **Content** | The text injected when the entry activates — full CodeMirror editor with AI toolbar |
| **Comment** | Internal notes about this entry (not used in AI output) |

### Position Options

| Position | Description |
| :--- | :--- |
| **Before Character** | Inserted before the character description |
| **After Character** | Inserted after the character description |
| **Before Example** | Inserted before the dialogue examples |
| **After Example** | Inserted after the dialogue examples |

### AI Key Generation

The **sparkle icon** (✨) next to the Trigger Keys label uses AI to generate trigger keywords from the entry's content. This is useful when you've written lore content but aren't sure which keywords should activate it.

1. Write your entry content first.
2. Click the ✨ button next to Trigger Keys.
3. The AI analyzes the content and generates 2–5 comma-separated trigger keywords.
4. Generated keys are **merged** with any existing keys (duplicates are ignored).
5. Click the ✨ button again while generating to abort (15-second timeout).

::: tip
AI key generation requires an AI provider to be configured. See [AI Setup](/configuration/ai-setup).

If you mapped the **Custom** prompt to a specific endpoint/model under **Settings → Prompts**, key generation uses that mapping; otherwise it uses your global AI Config model.
:::

### Context Visibility

The eye icon on each entry in the sidebar controls whether that entry is included when the AI assistant (Orion) and AI toolbar operations use character context. This is separate from the **Enabled** toggle:

- **Enabled** — Controls whether the entry activates during AI roleplay (in SillyTavern, etc.).
- **Context** (eye icon) — Controls whether the entry content is sent to Character Vault's AI assistant as context.

An entry can be enabled for roleplay but excluded from Orion's context, or vice versa.

## Import & Export

You can import and export lorebooks independently of character cards. This is useful for:

- Sharing lorebooks between characters
- Backing up world info separately
- Importing lorebooks from other tools

### Exporting a Lorebook

1. Open the character with the lorebook you want to export.
2. Go to the **Lorebook** tab.
3. Click **Export** in the lorebook toolbar.
4. The lorebook is exported as a JSON file compatible with SillyTavern and other tools.

Empty character books are automatically filtered out during export.

### Importing a Lorebook

1. Open the character where you want to import the lorebook.
2. Go to the **Lorebook** tab.
3. Click **Import** in the lorebook toolbar.
4. Select a JSON file containing lorebook data.

::: tip Supported Formats
Lorebook import accepts JSON files with either:
- A `character_book` object
- An `entries` array
:::

## Next Steps

- [Creator Notes preview](/features/creator-notes)
- [AI Assistant — Orion](/features/ai-assistant)
- [Configure AI provider](/configuration/ai-setup)
