# Lorebook Vault

Standalone **SillyTavern-compatible lorebooks** (World Info) live in their own library, separate from character cards. Create, edit, import, export, and snapshot books without opening a character. Optionally **attach** a book to a character for vault-local AI context, or **copy** it into the card’s embedded lorebook for export.

::: tip
The entry editor is shared with character-embedded lorebooks. Field details, recursion map, and AI key generation are covered in [Lorebook Editor](/features/lorebook-editor).
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

## Attach to a character (vault-local)

Attachments are **one-way**: character → **one** standalone book ID. They exist only inside CharacterVault.

- Only **one** vault lorebook per character (linking another replaces the previous attach)
- After you link, CharacterVault **asks to copy entries** into the character’s **embedded** lorebook (this **replaces** existing embedded entries if you confirm)
- The vault link is **not** written into PNG/JSON card export by itself; the embedded book is what exports with the card
- You can also re-copy later from the attach panel without changing the link

### Where to manage attachments

Open a **character**, go to the **Lorebook** section, and use the **Attached lorebook** panel:

- **Open in vault** – opens the attached vault book if present; otherwise creates a vault copy from the character’s embedded lorebook, attaches it, and opens the full lorebook workspace
- Attach or **Replace** the single vault book
- Confirm copy into embedded (overwrite) when linking
- Detach or re-copy into the embedded book as needed

## Import & export formats

Import accepts SillyTavern world-info JSON and CharacterVault lorebook shapes (including `character_book` / `entries` layouts used by the shared converter). Export produces ST-oriented JSON suitable for SillyTavern and re-import into the vault or a character’s lorebook editor.

See [Import & Export](/features/import-export#lorebook-import--export) and [Lorebook Editor → Import & Export](/features/lorebook-editor#import--export).

## Next steps

- [Lorebook Editor](/features/lorebook-editor) (fields, recursion map, AI keys)
- [AI Context](/features/ai-context)
- [Vault Organization](/features/vault-organization)
- [Snapshots & Rollback](/features/snapshots-history)
