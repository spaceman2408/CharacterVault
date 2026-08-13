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
| **Search** | Filter by name, description, or tags |
| **Create** | New empty book; opens in the lorebook workspace |
| **Import** | One or more SillyTavern / CharacterVault lorebook JSON files |
| **Open** | Click a row to edit the book |
| **Export** | Download that book as JSON |
| **Duplicate** | Copy the book in the vault |
| **Delete** | Remove the book after confirmation |

Each row shows name, description (if any), entry count, and last opened / updated time.

## Workspace

Opening a book shows a full workspace:

- **Header** – Back to vault, editable title, entry/token summary, **History** (snapshots), export, optional **Orion** chat panel (same AI assistant as characters)
- **Main** – Shared [Lorebook Editor](/features/lorebook-editor) (entry list + detail)
- **Orion** – Optional side chat about the book (desktop resizable; mobile can open/close)

Data stays in **IndexedDB** on this device. No account is required.

### Deep links

You can open a book with a query parameter:

`?lorebook=<lorebook-id>`

## Snapshots

Standalone books have their own snapshot history (similar to character snapshots):

| Source | When |
| :--- | :--- |
| **Open** | Baseline when first opened (as applicable) |
| **Auto** | Periodic save while the book stays open |
| **Manual** | **Snapshot now** in the History modal |
| **Rollback** | After restoring a previous snapshot |

Open **History** in the workspace header to list, preview, restore, or delete snapshots. See also [Snapshots & Rollback](/features/snapshots-history#standalone-lorebook-snapshots).

## Linking a book to a character {#attach-to-a-character-vault-local}

A character can have **one** linked library book. Several characters can share that same book.

Manage the link from a **character** → **Lorebook** tab → **Attached lorebook**.

### First link

1. Click **Attach** and pick a book (or **Replace** if one is already linked).
2. CharacterVault asks if you want to copy that book’s entries onto the character. Confirming **replaces** the lorebook already on the character.
3. You can copy again later from the panel without changing the link.

If nothing is linked yet, **Open in vault** can create a library book from the character’s current lorebook, link it, and open it.

### How they stay in sync

Once linked, the library book and the lorebook on the character are kept together:

| You do this | What happens |
| :--- | :--- |
| Edit the lorebook on the character, then **Open in vault** | The library book updates to match, then opens |
| Edit the book in the Lorebooks workspace | Every linked character’s lorebook updates |
| Restore a snapshot of the library book | Linked characters get that restored version too |

Leaving the lorebook workspace (back to the library, or opening a linked character) finishes any pending update first.

### Export, detach, and sharing

- **Exporting a character** (PNG or JSON) includes the lorebook **on that character**, not the link itself. After a sync, those entries are on the card, so they go with the export.
- **Detach** breaks the link. The character keeps whatever was last on the card. The library book stays in **Lorebooks**.
- Linking another book replaces the previous link (you’ll be asked first).
- If you do **not** want a character to follow later library edits, **Detach** it first.

### Linked characters (from the book)

In the lorebook workspace, **Linked** lists characters that use this book. Opening one of them saves the book first so the character already has your latest edits.

## Import & export formats

Import accepts SillyTavern world-info JSON and CharacterVault lorebook shapes (including `character_book` / `entries` layouts used by the shared converter). Export produces ST-oriented JSON suitable for SillyTavern and re-import into the vault or a character’s lorebook editor.

See [Import & Export](/features/import-export#lorebook-import--export) and [Lorebook Editor → Import & Export](/features/lorebook-editor#import--export).

## Next steps

- [Lorebook Editor](/features/lorebook-editor) (fields, recursion map, AI keys)
- [AI Context](/features/ai-context)
- [Vault Organization](/features/vault-organization)
- [Snapshots & Rollback](/features/snapshots-history)
