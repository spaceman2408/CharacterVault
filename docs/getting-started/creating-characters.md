# Creating & Editing Characters

Character Vault provides a tabbed editor for managing every aspect of a character card. This guide walks you through creating a new character and editing each section.

## Creating a New Character

1. Click the **New** button in the top right of the character library.
2. Enter a name for your character.
3. Click **Create**.

Your new character opens in the workspace immediately.

## The Tabbed Editor

The workspace organizes character fields into tabs. Click any tab to navigate to that section.

| Section | Purpose |
| :--- | :--- |
| **Image** | Upload a character portrait image |
| **Name** | Your character's name |
| **Description** | How the character looks, acts, and behaves |
| **First Message** | The opening greeting users see when starting a conversation |
| **Greetings** | Alternate opening messages (V2/V3 spec `alternate_greetings`) |
| **Examples** | Sample dialogue showing how the character talks (`mes_example`) |
| **Scenario** | The setting or situation for roleplay |
| **Appearance** | Physical description details (V3 `physical_description`) |
| **Personality** | Personality traits and quirks |
| **System** | Instructions for the AI about how to play the character (`system_prompt`) |
| **Lorebook** | Extra information that triggers on keywords (`character_book`) |
| **Creator** | Your name (optional) |
| **Creator Notes** | Notes for other users — supports HTML/CSS with live preview |
| **Tags** | Keywords to categorize your character |

## Auto-Save

All changes are saved automatically as you type. There's no need to click a save button.

## Image Support

On the **Image** tab you can:

- **Upload** a new portrait from your device.
- **Replace** an existing portrait by uploading a new image.

Character Vault generates a 128×192 JPEG thumbnail for the library grid view automatically.

## Lorebook / World Info

The Lorebook tab lets you add entries that activate based on keywords during AI conversations. Each entry has:

| Field | Description |
| :--- | :--- |
| **Keys** | Comma-separated keywords that trigger the entry |
| **Content** | The information injected when the entry is triggered |
| **Priority** | Determines insertion order when multiple entries fire |
| **Position** | Where the entry is inserted in the prompt |
| **Enabled** | Toggle the entry on or off |
| **Case Sensitive** | Require exact case match on keywords |
| **Constant** | Always include this entry regardless of keywords |

For the full two-panel editor, search, AI key generation, and context visibility controls, see [Lorebook Editor](/features/lorebook-editor).

## Creator Notes

The Creator Notes tab supports **HTML and CSS** with a sandboxed live preview — useful for sharing styled notes, credits, or usage instructions with other users who import your card. See [Creator Notes Preview](/features/creator-notes) for details.

## Next Steps

- [Lorebook editor deep dive](/features/lorebook-editor)
- [Creator Notes preview](/features/creator-notes)
- [Use the AI assistant to brainstorm content](/features/ai-assistant)
- [Import existing character cards](/features/import-export)
- [Learn about snapshot history and rollback](/features/snapshots-history)
