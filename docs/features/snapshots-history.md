# Snapshots & Rollback

Character Vault keeps a local snapshot history for every character card you open. Snapshots let you compare changes over time and roll back to previous versions — either the entire card or individual sections.

## Snapshot Types

Each snapshot is labelled with a colour-coded badge in the timeline:

| Badge | When It's Created |
| :--- | :--- |
| **Opened card** | Automatically the first time you open a character card. Only one baseline exists per character; it is protected from deletion. It stays last in the list. |
| **Manual save point** | When you click **Save snapshot** in the Snapshots modal. |
| **Post-restore save point** | Automatically after a restore (full card or section) completes. This records the state right after the rollback is applied. |

::: tip Legacy "Auto" snapshots
You may occasionally see a **"Legacy auto save point"** badge on older snapshots. These were created automatically by an earlier version of the app. No new auto snapshots are created in the current version.
:::

## Opening the Snapshots Panel

1. Open a character in the workspace.
2. Click the **Snapshots** button in the workspace header.
3. A full-screen modal opens with a sidebar timeline and a detail panel.

On mobile, the timeline appears as a horizontal scrolling strip at the top instead of a sidebar.

## Timeline Sidebar

The left sidebar lists every snapshot for the character, ordered newest-first:

- **Badge** — Shows the snapshot type (Opened card, Manual save point, Post-restore save point).
- **Timestamp** — The time the snapshot was created.
- **Changed indicator** — An amber dot appears when the snapshot's content differs from your current draft.
- **Delete button** — Non-baseline snapshots can be deleted individually (the trash icon on the right). Baseline snapshots are protected and cannot be removed.

New snapshots are briefly highlighted with a green ring when they first appear in the timeline.

### Saving a Manual Snapshot

Click **Save snapshot** in the modal header to create a manual snapshot of the current draft. If nothing has changed since the latest snapshot, a toast lets you know no new snapshot was needed.

## Diff Viewer

Select any snapshot in the timeline to load a side-by-side comparison against your current draft:

- The **left pane** shows the snapshot (with changes highlighted in amber).
- The **right pane** shows the current draft (with changes highlighted in green).
- Changed text is highlighted inline so you can see exactly what was added, removed, or modified.

### Section-Specific Diff Views

Different card sections get specialised diff layouts:

| Section | Diff Behaviour |
| :--- | :--- |
| **Text fields** (name, description, personality, etc.) | Side-by-side diff with per-line change highlighting. Added or removed lines stay correctly paired. |
| **Image** | Side-by-side image previews — snapshot on the left, current draft on the right. Shows "No image" if the value is missing. |
| **Lorebook** | Compares entries by ID. Only entries with changes to name, trigger keys, content, or internal notes are shown. Unchanged entries are hidden. |
| **Alternate Greetings** | Only greetings that actually changed are displayed. Unchanged greetings are omitted. |
| **Extensions** | JSON diff of the extensions object. |

### Collapsed Sections

When you select a snapshot, only the section you are currently editing is expanded by default. Other changed sections are collapsed — click a section header to expand it. Sections that match the current draft are not shown at all.

An **Active** badge marks the section you currently have open in the editor.

### Missing Snapshot Data

If a snapshot's data could not be loaded (e.g., due to corruption or a failed save), the diff view shows a warning banner instead. You cannot restore from a corrupted snapshot.

## Rolling Back

You have two rollback options:

- **Restore card** — Replaces the entire character with the selected snapshot's state. A rollback snapshot is automatically created afterwards, so you can undo the restore if needed.
- **Restore section** — Restores only one changed section (e.g., just the Description, or just the First Message) while leaving every other section untouched. After a section restore, the diff refreshes automatically so you can see the updated state.

Both actions require confirmation before they are applied. The dialog explains exactly what will happen:

- **Full card restore**: Your current draft will be replaced with the selected snapshot. A rollback snapshot is still created automatically.
- **Section restore**: Only the selected section is restored from the snapshot. Other sections remain unchanged.

If nothing has changed between the snapshot and your current draft, the **Restore card** button is disabled with the tooltip "No changes to restore."

## Storage & Limits

- **No duplicates** — If nothing has changed since the latest snapshot, a new one won't be created.
- **Baseline protection** — The "Opened card" snapshot cannot be deleted.
- **10 snapshot limit** — Each character is limited to 10 saved snapshots (excluding the baseline "Opened card" snapshot). When the limit is exceeded, the oldest ones are removed automatically.
- **Memory-optimized images** — Snapshots only store image data when the image actually changed. If you edit text fields without changing the character image, the snapshot stores an empty image placeholder to save space. The current character image is used when restoring if the snapshot has no image data.
- **Snapshots are local** — Snapshot data is stored in your browser. Clearing browser data or switching devices removes all snapshot history.

## Best Practices

The [Agent](/features/ai-agent) takes **one snapshot** before it writes the card or book (only if something changed). Use that save point if a run went further than you wanted.

- **Save a snapshot before big changes** – Click **Save snapshot** before overhauling a description or rewriting a greeting.
- **Use section restore for surgical fixes** – If only one field was accidentally changed, restore just that section instead of rolling back the entire card.
- **Export as backup** – For important characters, [export a PNG copy](/features/import-export) as an external backup in addition to relying on local snapshots.

## Standalone lorebook snapshots

Books in the [Lorebook Vault](/features/lorebook-vault) have a separate history modal (workspace **History** button), not the character Snapshots panel.

| Source | Meaning |
| :--- | :--- |
| **Opened** | Baseline when the book is first opened. You can update it in place; you cannot delete it. |
| **Manual** | **Snapshot now** in the History modal (only if something changed) |
| **Rollback** | Created after a restore |

The lorebook [Agent](/features/ai-agent) also snapshots once before it writes the book.

You can list snapshots, preview book metadata and a sample of entries, restore a snapshot over the current book, or delete individual snapshots. Restore asks for confirmation. Restoring a library book also updates every linked character. History is stored locally with the rest of the vault.

## Next Steps

- [Import and export characters](/features/import-export)
- [Lorebook Vault](/features/lorebook-vault)
- [AI Agent](/features/ai-agent)
- [Organize your vault](/features/vault-organization)
