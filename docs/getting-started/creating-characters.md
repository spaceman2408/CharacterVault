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

The **Lorebook** tab edits the character’s **embedded** world info (`character_book`), which exports with the card. Each entry can include:

| Field | Description |
| :--- | :--- |
| **Entry title** | Display memo (not injected as content) |
| **Primary keys** | Keywords or `/regex/` that can activate the entry |
| **Secondary keys / selective** | Optional filters and ST selective logic |
| **Content** | Text injected when the entry activates |
| **Insertion order** | Order among activated entries |
| **Position** | Before/after char or examples, or at chat depth |
| **Enabled / Constant** | Off entirely, or always-on without keys |
| **Case sensitive / whole words** | Key matching options |
| **Probability** | Optional chance after a match |
| **Recursion flags** | Non-recursable, prevent further, delay until recursion |

Also available: AI context eye toggles, AI key generation, book-level scan depth / token budget / recursive scanning, and a **recursion map** for who unlocks whom.

For the full two-panel editor, see [Lorebook Editor](/features/lorebook-editor).

### Standalone books and attachments

A separate **Lorebooks** library on the home vault holds books that are **not** on the card by default. You can attach them to a character for vault-local AI context, or copy entries into the embedded book for SillyTavern export. See [Lorebook Vault](/features/lorebook-vault).

## Creator Notes

The Creator Notes tab supports **HTML and CSS** with a sandboxed live preview — useful for sharing styled notes, credits, or usage instructions with other users who import your card. See [Creator Notes Preview](/features/creator-notes) for details.

## Next Steps

- [Lorebook editor deep dive](/features/lorebook-editor)
- [Lorebook Vault](/features/lorebook-vault)
- [Creator Notes preview](/features/creator-notes)
- [Use the AI assistant to brainstorm content](/features/ai-assistant)
- [Import existing character cards](/features/import-export)
- [Learn about snapshot history and rollback](/features/snapshots-history)
