# Lorebook Editor

The **Lorebook** editor manages SillyTavern-style **World Info** entries: text that can activate on keywords (or always, for constants) and inject into the model context during roleplay.

The same editor is used in two places:

1. **Character** workspace → **Lorebook** tab (embedded `character_book` on the card)
2. **Lorebook vault** → open a standalone book ([Lorebook Vault](/features/lorebook-vault))

::: tip
Field help icons (**?**) next to labels summarize SillyTavern World Info behavior. Prefer those for short definitions; this page covers the CharacterVault layout and tools.
:::

## Two-panel layout

- **Left sidebar** – Book settings, search, AI context usage, entry list, import/export, new entry
- **Right panel** – Selected entry’s fields and content editor

On mobile, list and detail switch with a **Back** control.

## Book settings

Expand **Lorebook** at the top of the sidebar:

| Setting | Role |
| :--- | :--- |
| **Book name** | Display name for the book |
| **Description** | Short description |
| **Scan depth** | How many recent chat messages ST scans for keys (book-level) |
| **Token budget** | Max tokens World Info may consume at once (book-level) |
| **Recursive scanning** | When on, activated entries can unlock others by naming their keys in **Content** |
| **Map** | Opens the [Recursion map](#recursion-map) on the **Whole book** tab |
| **Delete lorebook** | Characters only: remove the embedded book (when offered) |

## Entry list

Each row shows a title (entry title / memo, or a fallback), key count, optional token count for the selected row, context eye, and delete.

### Search

Filter by title, internal notes, content, or primary keys. A result count appears when search is active.

### AI context (Character Vault)

A compact **AI context** block shows how many entries are included and a token usage bar (book token budget when set, otherwise sampler context length).

| Control | Meaning |
| :--- | :--- |
| **Eye** on a row | Include or exclude that entry from Orion / AI toolbar context |
| **All** / **None** | Enable or disable context for every entry |

This is **separate** from **Enabled** (SillyTavern activation). See [AI Context → Lorebook](/features/ai-context#lorebook-in-context).

### Import & export

Bottom of the sidebar:

- **Import** – Replace the current book’s entries with a JSON lorebook (confirmation if entries already exist)
- **Export** – Download ST-compatible JSON
- **New Entry** – Append a blank entry and open it

## Entry detail

### Core fields

| Field | Description |
| :--- | :--- |
| **Entry title** | Memo / display label (ST entry title). Not sent as content. |
| **Enabled** | When off, the entry never activates in SillyTavern |
| **Constant** | Always-on; no keyword required |
| **Primary keys** | Keywords or `/regex/` that can activate the entry |
| **Secondary keys** | Optional filter keys when **Selective** is on |
| **Selective** + logic | AND ANY / NOT ALL / NOT ANY / AND ALL (ST selectiveLogic) |
| **Insertion order** | Higher numbers insert later / closer to the end of context |
| **Position** | Where content injects (before/after char, before/after example, or at depth) |
| **Depth / role** | For **at depth**: chat depth and system / user / assistant role |
| **Case sensitive** | Exact letter case for keys |
| **Match whole words** | Whole-word style matching for plain keys |
| **Content** | Text injected when the entry activates (full CodeMirror + AI toolbar) |
| **Internal notes** | Optional notes (stored as the entry name field; not ST memo) |

### Activation (probability & recursion)

Expand **Activation** for:

| Field | Description |
| :--- | :--- |
| **Probability %** / **Use %** | Chance the entry is inserted after it would activate |
| **Non-recursable** | Other entries cannot unlock this one via recursive scanning |
| **Prevent further recursion** | When this activates, it will not unlock further entries |
| **Delay until recursion** | Only activates on recursive passes, not the first chat scan |

At-a-glance counts: **Triggers N · Triggered by M** (or “No recursion links”), plus **Map**.

## Recursion map

An authoring aid for **recursive scanning**: if entry A’s **content** mentions entry B’s **primary keys**, A can unlock B (subject to flags).

### Open the map

- Entry → **Activation** → **Map** (defaults to **This entry**)
- Book settings → **Map** (defaults to **Whole book**)

### This entry

Three columns:

- **Triggered by** – entries that can unlock the current one
- **This entry** – focus card and flags
- **Triggers** – entries this one can unlock

Click a neighbor to select it in the editor (map stays open and re-centers).

### Whole book

Master/detail browser for the entire book:

| Area | Purpose |
| :--- | :--- |
| **Summary cards** | Unlock path count, linked vs standalone entries, flag counts |
| **Entry list** | Search, filter (All / Linked / Standalone), sort by activity |
| **Select all / visible / linked** | Multi-select for bulk flag edits |
| **Inspector** | Unlocked by / Unlocks for the focused entry, with matched keys |
| **Recursion controls** | Set **Non-recursable**, **Prevent further**, **Delay until recursion** On/Off for the selection (or the inspected entry) |
| **Isolate** | Set non-recursable + prevent further (block both directions) |
| **All unlock paths** | Collapsible list of A → B via key |

::: warning Authoring aid, not a full ST simulator
The map uses **primary keys** in content (including simple `/regex/` support, case sensitivity, and whole-word options). It does **not** fully simulate selective secondary logic, probability, token budget, multi-step depth, or chat scan. Treat it as a guide for wiring recursion flags.
:::

If **Recursive scanning** is off on the book, the map still shows potential key hits and warns that SillyTavern will not recurse until scanning is enabled (book or global ST setting).

## AI key generation

The **sparkle** control next to primary keys asks the AI for 2–5 comma-separated trigger keywords from **Content**, then merges them with existing keys.

- Requires a configured AI provider ([AI Setup](/configuration/ai-setup))
- Uses the **Custom / instruct** prompt model mapping when set; otherwise the global model
- Click again to abort; requests time out after about 15 seconds

## Content editor

Entry **Content** uses the shared CodeMirror stack: AI toolbar, spellcheck, macros, Markdown image highlighting, font size. See [Editor & AI Toolkit](/features/editor).

## Import & export

Works for both character-embedded and vault books.

### Export

1. Open the lorebook editor (character tab or vault book).
2. Click **Export**.
3. Save the JSON (SillyTavern-oriented world info).

### Import

1. Click **Import** and choose a JSON file.
2. If the book already has entries, confirm replacement.
3. Supported shapes include CharacterVault / ST lorebook JSON (`character_book`, `entries`, etc.).

::: tip
Standalone library import (multiple files, keep books separate) is on the [Lorebook Vault](/features/lorebook-vault) tab. Character/vault **editor** import replaces the **current** book’s entries.
:::

## Attachments (characters)

Characters can **attach** standalone vault books for vault-local AI use, or **copy** a book into the embedded lorebook for card export. See [Lorebook Vault → Attach](/features/lorebook-vault#attach-to-a-character-vault-local).

## Next steps

- [Lorebook Vault](/features/lorebook-vault)
- [AI Context](/features/ai-context)
- [Creating & Editing Characters](/getting-started/creating-characters)
- [Configure AI](/configuration/ai-setup)
