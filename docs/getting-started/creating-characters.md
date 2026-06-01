# Creating & Editing Characters

Character Vault provides two ways to create characters: generate them with AI or build them manually in the tabbed editor.

## Creating a New Character

### Option 1: AI Creation Studio

Generate a complete character card from scratch using AI:

1. Click the **✨ AI Creation Studio** button in the vault header.
2. Choose your input mode:
   - **Write Mode** — Describe your character concept in free-form text
   - **Tags Mode** — Select from curated tags across 6 categories
3. Click **Generate Character** (or **🎲 Feeling Lucky** for random tags).
4. Review and edit the generated fields in the preview panel.
5. Click **Save to Vault** when ready.

The AI generates a name, description, first message, and example dialogue automatically.

[Learn more about AI Creation Studio →](/features/ai-creation-studio)

### Option 2: Manual Creation

Build a character from scratch in the editor:

1. Click the **New** button in the top right of the character library.
2. Enter a name for your character.
3. Click **Create**.

Your new character opens in the workspace immediately, ready for editing.

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

## Name, Creator, and Tags

The **Name** and **Creator** tabs use simple text boxes. Type directly into the field and your change is saved automatically.

The **Tags** tab is built for quick editing:

- Type a tag and press **Enter** to add it.
- Type several tags separated by commas to add them at once.
- Paste a comma-separated list to add many tags quickly.
- Click the **x** on a tag to remove it.
- Duplicate tags are skipped automatically.

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
