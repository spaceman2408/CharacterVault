# Lorebook Editor

The **Lorebook** editor manages SillyTavern-style **World Info** entries: text that can activate on keywords (or always, for constants) and inject into the model context during roleplay.

The same editor is used in two places:

1. **Character** workspace → **Lorebook** tab (the lorebook that lives on the card)
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
| **Map** | Opens the [Recursion map](#recursion-map) |
| **Delete lorebook** | Characters only: remove the lorebook from the card (when offered) |

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

A full-screen map of how your entries unlock each other. If entry A's **content** mentions one of entry B's **primary keys**, there's a path from A to B: when A activates, B can activate right after it (as long as flags allow it).

### Open the map

- Entry → **Activation** → **Map** (opens with that entry already inspected)
- Book settings → **Map** (opens the whole book)

Both open the same view; the only difference is whether an entry is pre-selected.

### The web view

By default you get a picture of the whole book. Each box is an entry, each arrow is a path: the entry an arrow starts from mentions the other entry's keys in its content. Entries group into clusters so you can see which ones belong to the same chain. Little dots on a box show its flags (see the legend at the bottom).

| Action | How |
| :--- | :--- |
| Move around | Drag the background |
| Zoom | Scroll wheel, centered on your cursor |
| Inspect an entry | Click it |
| Select for bulk edits | Ctrl (or Cmd) + click; click again to deselect |
| Reset camera | **Reset view** |
| Show entries with no links | **Show standalone** |

Hover an entry to light up just its connections and fade everything else. A legend at the bottom of the map explains the arrows and flag dots.

### The list view

Switch to **List** next to the Web button for a plain table of every entry, with search and All / Linked / Standalone filters. Same actions: click a row to inspect, use the checkbox to select. For very large books the map opens in list mode first, since a wall of boxes is slower to read and slower to draw.

### Inspecting an entry

The right-hand panel shows the clicked entry: its keys, flags, who can unlock it, and what it unlocks, including which key made each connection. From here you can:

- Toggle **Non-recursable**, **Prevent further**, or **Delay until recursion** for just this entry. These apply right away.
- **Select** it to add it to a bulk selection.

Clicking another entry in its "Unlocked by" or "Unlocks" lists inspects that one instead, so you can walk a chain step by step.

### Bulk flag changes

Selecting one or more entries opens a bar at the bottom. Pick On or Off for any of the three recursion flags, or use **Isolate: block both directions** (non-recursable plus prevent further). Nothing is applied yet. The bar shows exactly what is staged and for how many entries. Press **Apply** to commit, or **Discard** to back out. For big selections (more than 25 entries), Apply asks for a second click so a stray tap cannot rewrite half the book.

Quick-select shortcuts in the bar: **All** entries, **Visible** (what search is showing), **Linked** (entries with at least one path), and **Clear**.

### Small print

::: warning Authoring aid, not a full ST simulator
The map reads **primary keys** in content (including simple `/regex/` support, case sensitivity, and whole-word options). It does **not** fully simulate selective secondary logic, probability, token budget, multi-step depth, or chat scan. Treat it as a guide for wiring recursion flags.
:::

If **Recursive scanning** is off on the book, the map still shows potential key hits and warns that SillyTavern will not recurse until scanning is enabled (book or global ST setting).

For a walkthrough with examples, see the [Recursion Map Guide](/features/recursion-map-guide).

## AI key generation

The **sparkle** control next to primary keys asks the AI for 2–5 comma-separated trigger keywords from **Content**, then merges them with existing keys.

- Requires a configured AI provider ([AI Setup](/configuration/ai-setup))
- Uses the **Custom / instruct** prompt model mapping when set; otherwise the global model
- Click again to abort; requests time out after about 15 seconds

## Content editor

Entry **Content** uses the shared CodeMirror stack: AI toolbar, spellcheck, macros, Markdown image highlighting, font size. See [Editor & AI Toolkit](/features/editor).

## Import & export

Works for both the lorebook on a character and a library book.

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

## Linking a library book (characters)

A character can link **one** book from the Lorebooks library. After you link, you’ll be asked whether to copy that book onto the character (this replaces the lorebook already on the card).

Once linked, they stay in sync: **Open in vault** writes the character’s current lorebook to the library book; edits in the library workspace update every linked character. The link itself stays in CharacterVault; exporting a card includes the lorebook on that character.

See [Lorebook Vault → Linking](/features/lorebook-vault#attach-to-a-character-vault-local).

## Next steps

- [Recursion Map Guide](/features/recursion-map-guide)
- [Lorebook Vault](/features/lorebook-vault)
- [AI Context](/features/ai-context)
- [Creating & Editing Characters](/getting-started/creating-characters)
- [Configure AI](/configuration/ai-setup)
