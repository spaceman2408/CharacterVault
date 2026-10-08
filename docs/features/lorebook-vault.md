# Lorebook Vault

Standalone **SillyTavern-compatible lorebooks** (World Info) live in their own library, separate from character cards. Create, edit, import, export, and snapshot books without opening a character. You can **link** a library book to one or more characters so they share the same entries.

::: tip
The entry editor is the same one you see on a character’s **Lorebook** tab. Field details, recursion map, and AI key generation are covered in [Lorebook Editor](/features/lorebook-editor).
:::

## Characters vs Lorebooks

On the home vault screen, switch between:

| Tab | What it is |
| :--- | :--- |
| **Characters** | Portrait grid of character cards (existing library) |
| **Lorebooks** | Standalone world-info books |

Your last tab choice is remembered in the browser.

## Library

From the **Lorebooks** tab you can:

| Action | Description |
| :--- | :--- |
| **Search** | Filter by name, description, or linked character name |
| **Create** | New empty book; opens in the lorebook workspace |
| **Import** | One or more SillyTavern / CharacterVault lorebook JSON files |
| **Open** | Click a row to edit the book |
| **Export** | Download that book as JSON |
| **Duplicate** | Copy the book in the vault (no confirmation) |
| **Delete** | Remove the book after confirmation. Its snapshots, chats, and links go too. Linked characters keep their current entries. |

Each card shows the name, description (if any), entry count, total tokens, **Updated …** time, and avatars of linked characters. Click an avatar to open that character. The list is sorted by most recently updated.

## Workspace

Opening a book shows a full workspace:

- **Header** – Back to vault, editable title, entry/token summary, **Snapshots**, **Linked**, **Settings**, export, optional chat panel
- **Main** – Shared [Lorebook Editor](/features/lorebook-editor) (entry list + detail)
- **Chat** – Optional side panel: **Orion** to talk about the book, or **Agent** to add and revise entries in this book ([AI Agent](/features/ai-agent))

Data stays in **IndexedDB** on this device. No account is required. Library header **Backup** includes standalone lorebooks in the vault ZIP. Restore by importing that ZIP; books are added as copies. See [Import & Export → Vault backup](/features/import-export#vault-backup).

## Snapshots

Standalone books have their own snapshot history (similar to character snapshots):

| Source | When |
| :--- | :--- |
| **Opened** | Baseline when the book is first opened. You can update it in place; you cannot delete it. It stays last in the list. |
| **Manual** | **Save snapshot** in the Snapshots modal (only if something changed) |
| **Auto** | Taken before an Agent run, and before **Open in vault** on a character replaces the book's contents |
| **Rollback** | After restoring a previous snapshot |

Open **Snapshots** in the workspace header to list, preview, restore, or delete snapshots. See also [Snapshots & Rollback](/features/snapshots-history#standalone-lorebook-snapshots).

## Linking a book to a character {#attach-to-a-character-vault-local}

A character can have **one** linked library book. Several characters can share that same book.

Manage the link from a **character** → **Lorebook** tab → **Attach** in the entry header (next to **Options**). On a phone, **Attach** is also next to book settings on the entry list.

### First link

1. Click **Attach** and pick a book (or **Replace** if one is already linked).
2. CharacterVault asks if you want to copy that book’s entries onto the character. If the character has no entries yet, **Copy** fills them in. If it already has entries, pick **Replace** to swap them out, or **Merge** to keep them (see below). If you skip the copy, the character keeps its own entries and does not sync its edits to the library book yet (see below).
3. You can copy again later from the panel without changing the link.

If nothing is linked yet, **Open in vault** can create a library book from the character’s current lorebook, link it, and open it.

### Merge into existing entries {#merge-into-existing-entries}

**Merge** keeps the character's entries and lorebook settings and adds the book's entries after them.

Merging also **unlinks** the book, so the merged lorebook never syncs back into the library book or its other characters. To share the merged result, click **Open in vault**: it makes a new library book from the merged entries and links it.

### How they stay in sync

Once linked, the library book and the lorebook on the character are kept together:

| You do this | What happens |
| :--- | :--- |
| Edit the lorebook on the character (by hand or with the Agent) | The library book and every other linked character update as the edit saves |
| Restore a snapshot of the character | The restored lorebook goes to the library book and every other linked character |
| Click **Open in vault** on the character | The library book updates to match the character, then opens |
| Edit the book in the Lorebooks workspace | Every linked character’s lorebook updates |
| Restore a snapshot of the library book | Linked characters get that restored version too |

Leaving a character or the lorebook workspace (back to the library, **Open in vault**, or opening a linked character) finishes any pending update first.

::: warning A character that does not match the library book
Edits on the character sync only while its lorebook matches the library book. If you linked a book but skipped the copy, edits stay on that character, and later library edits still replace them. To make this character's lorebook the shared one, click **Open in vault**: it puts the character's lorebook over the library book and every other linked character. An **Auto** snapshot of the library book is saved first, so you can restore it from **Snapshots**. Agent edits on the character always sync.
:::

### Export, detach, and sharing

- **Exporting a character** (PNG or JSON) includes the lorebook **on that character**, not the link itself. After a sync, those entries are on the card, so they go with the export.
- **Detach** breaks the link. The character keeps whatever was last on the card. The library book stays in **Lorebooks**.
- Linking another book replaces the previous link (you’ll be asked first).
- If you do **not** want a character to follow later library edits, **Detach** it first.

### Linked characters (from the book)

In the lorebook workspace, **Linked** lists characters that use this book. Opening one of them saves the book first so the character already has your latest edits.

## Import & export formats

Import accepts SillyTavern World Info JSON, or a bare V2 `character_book` object (an `entries` array). Full character cards, or wrappers with a top-level `character_book` key, are not accepted. Books with zero entries fail to import. Export produces ST-oriented JSON suitable for SillyTavern and re-import into the vault.

See [Import & Export](/features/import-export#lorebook-import-export) and [Lorebook Editor → Import & Export](/features/lorebook-editor#import-export).

## Next steps

- [Lorebook Editor](/features/lorebook-editor) (fields, recursion map, AI keys)
- [AI Context](/features/ai-context)
- [AI Agent](/features/ai-agent)
- [Vault Organization](/features/vault-organization)
- [Snapshots & Rollback](/features/snapshots-history)
