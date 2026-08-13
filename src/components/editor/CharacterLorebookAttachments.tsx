/**
 * One-way attach panel: link a single standalone vault lorebook to a character.
 * Linking replaces any previous attach and prompts to copy entries into the
 * embedded character book (overwriting existing embedded entries).
 * "Open in vault" writes the current embedded book onto the attached vault
 * copy (or creates one from embedded) and opens the lorebook workspace.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Book, ExternalLink, Link2, Trash2, Copy } from 'lucide-react';
import type { CharacterBook, LorebookListItem, VaultLorebook } from '../../db/characterTypes';
import {
  cloneBookForEmbed,
  cloneEmbeddedBook,
  lorebookAttachmentService,
  type ResolvedLorebookAttachment,
} from '../../services/LorebookAttachmentService';
import { useCharacterEditorContext, useLorebookContext } from '../../context';
import { flushLorebookDraft } from './lorebook/draftFlush';

function promptCopyIntoEmbedded(
  lorebook: VaultLorebook,
  embeddedBook: CharacterBook | undefined,
): boolean {
  const entryCount = lorebook.book.entries?.length ?? 0;
  const existing = embeddedBook?.entries?.length ?? 0;
  const message =
    existing > 0
      ? `Copy ${entryCount} entries from "${lorebook.name}" into this character's embedded lorebook? This replaces the current ${existing} embedded entries.`
      : `Copy ${entryCount} entries from "${lorebook.name}" into this character's embedded lorebook?`;
  return window.confirm(message);
}

export function CharacterLorebookAttachments({
  characterId,
  embeddedBook,
  characterName,
  onCopyIntoEmbedded,
}: {
  characterId: string;
  embeddedBook: CharacterBook | undefined;
  characterName?: string;
  onCopyIntoEmbedded: (book: CharacterBook) => void;
}): React.ReactElement {
  const { lorebookListItems, openLorebook, createLorebook } = useLorebookContext();
  const { flushPendingSaves } = useCharacterEditorContext();
  const [resolved, setResolved] = useState<ResolvedLorebookAttachment[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const next = await lorebookAttachmentService.resolve(characterId);
    setResolved(next);
  }, [characterId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const attached = resolved[0] ?? null;
  const attachedId = attached?.lorebookId ?? null;

  // Picker lists every vault book except the one already attached (replace flow).
  const available: LorebookListItem[] = lorebookListItems.filter(
    (item) => item.id !== attachedId,
  );

  const handleAttach = async (lorebookId: string) => {
    if (busy) return;

    if (attachedId && attachedId !== lorebookId) {
      const currentName = attached?.missing
        ? 'the current attachment'
        : `"${attached?.lorebook?.name || 'Untitled'}"`;
      const replaceOk = window.confirm(
        `Only one lorebook can be attached. Replace ${currentName} with this book?`,
      );
      if (!replaceOk) return;
    }

    setBusy(true);
    try {
      await lorebookAttachmentService.attach(characterId, lorebookId);
      const next = await lorebookAttachmentService.resolve(characterId);
      setResolved(next);
      setPickerOpen(false);

      const linked = next.find((item) => item.lorebookId === lorebookId)?.lorebook;
      if (linked && promptCopyIntoEmbedded(linked, embeddedBook)) {
        onCopyIntoEmbedded(cloneBookForEmbed(linked));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDetach = async () => {
    if (!attachedId || busy) return;
    setBusy(true);
    try {
      await lorebookAttachmentService.detach(characterId, attachedId);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const fallbackVaultName = (book?: CharacterBook) =>
    (book?.name || '').trim() ||
    (characterName ? `${characterName}'s Lorebook` : 'Character Lorebook');

  /**
   * Commit in-editor lorebook draft + queued character save, then write that
   * book onto the attached vault copy. openLorebook drops the character.
   */
  const pushEmbeddedAndOpen = async (lorebookId: string) => {
    flushLorebookDraft();
    const latest = await flushPendingSaves();
    const book = latest?.data.characterBook ?? embeddedBook;
    if (book) {
      await lorebookAttachmentService.writeEmbeddedToVault(
        lorebookId,
        book,
        fallbackVaultName(book),
      );
    }
    await openLorebook(lorebookId);
  };

  const handleOpen = async (lorebookId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await pushEmbeddedAndOpen(lorebookId);
    } catch (err) {
      console.error('Failed to open lorebook in vault:', err);
      window.alert(
        err instanceof Error ? err.message : 'Could not open the vault lorebook.',
      );
    } finally {
      setBusy(false);
    }
  };

  /**
   * Open the full vault lorebook workspace.
   * Prefer the existing attachment (push current embedded first); otherwise
   * create a vault book from the embedded character book, attach it, and open.
   * createLorebook / openLorebook drop character memory automatically.
   */
  const handleOpenInVault = async () => {
    if (busy) return;

    if (attached && !attached.missing && attached.lorebookId) {
      setBusy(true);
      try {
        await pushEmbeddedAndOpen(attached.lorebookId);
      } catch (err) {
        console.error('Failed to open lorebook in vault:', err);
        window.alert(
          err instanceof Error ? err.message : 'Could not open the vault lorebook.',
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    const fallbackName = fallbackVaultName(embeddedBook);
    const entryCount = embeddedBook?.entries?.length ?? 0;
    const createOk = window.confirm(
      entryCount > 0
        ? `Open in the lorebook vault editor? A vault copy will be created from this character's embedded lorebook (${entryCount} entries), attached to the character, and opened.`
        : `Open in the lorebook vault editor? An empty vault lorebook will be created, attached to this character, and opened.`,
    );
    if (!createOk) return;

    setBusy(true);
    try {
      flushLorebookDraft();
      const latest = await flushPendingSaves();
      // Snapshot embedded book before createLorebook drops the open character.
      const book = cloneEmbeddedBook(latest?.data.characterBook ?? embeddedBook, fallbackName);
      const created = await createLorebook({
        name: book.name || fallbackName,
        description: book.description || '',
        book,
      });
      await lorebookAttachmentService.attach(characterId, created.id);
      // createLorebook already opened the book and dropped character payload
    } catch (err) {
      console.error('Failed to open lorebook in vault:', err);
      window.alert(
        err instanceof Error ? err.message : 'Could not create or open the vault lorebook.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = (lorebook: VaultLorebook) => {
    if (!promptCopyIntoEmbedded(lorebook, embeddedBook)) return;
    onCopyIntoEmbedded(cloneBookForEmbed(lorebook));
  };

  return (
    <div className="shrink-0 border-b border-border bg-muted/30 px-3 py-3 sm:px-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
            Attached lorebook
          </p>
          <p className="text-[11px] text-fg-muted">
            One vault book per character. Open in vault writes the current embedded book to the
            attachment (or creates one), then opens it. Vault edits write back to every linked
            character's embedded book. Linking asks to copy entries into the embedded book
            (overwrites).
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleOpenInVault()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
            title={
              attached && !attached.missing
                ? 'Write current lorebook to the attached vault book and open it'
                : 'Create vault lorebook from embedded book and open it'
            }
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in vault
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            disabled={busy || available.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Link2 className="h-3.5 w-3.5" />
            {attachedId ? 'Replace' : 'Attach'}
          </button>
        </div>
      </div>

      {pickerOpen && (
        <div className="mb-2 max-h-40 overflow-y-auto rounded-xl border border-border bg-surface p-1">
          {available.length === 0 ? (
            <p className="px-2 py-2 text-xs text-fg-muted">
              {lorebookListItems.length === 0
                ? 'No lorebooks in the vault yet.'
                : 'No other lorebooks to switch to.'}
            </p>
          ) : (
            available.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void handleAttach(item.id)}
                disabled={busy}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-fg hover:bg-hover disabled:opacity-50"
              >
                <Book className="h-3.5 w-3.5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                <span className="shrink-0 text-fg-subtle">{item.entryCount} entries</span>
              </button>
            ))
          )}
        </div>
      )}

      {!attached ? (
        <p className="text-xs text-fg-subtle">None attached.</p>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-2">
          <Book
            className={`h-3.5 w-3.5 shrink-0 ${attached.missing ? 'text-danger' : 'text-accent'}`}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-fg">
              {attached.missing
                ? 'Missing lorebook'
                : attached.lorebook?.name || 'Untitled'}
            </p>
            <p className="text-[11px] text-fg-muted">
              {attached.missing
                ? 'Book was deleted from the vault'
                : `${attached.lorebook?.book.entries?.length ?? 0} entries · vault link`}
            </p>
          </div>
          {!attached.missing && attached.lorebook && (
            <>
              <button
                type="button"
                onClick={() => handleCopy(attached.lorebook!)}
                disabled={busy}
                className="rounded-lg p-1.5 text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-50"
                title="Copy into embedded character lorebook (replaces entries)"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void handleOpen(attached.lorebookId)}
                disabled={busy}
                className="rounded-lg p-1.5 text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-50"
                title="Open in lorebook vault"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => void handleDetach()}
            disabled={busy}
            className="rounded-lg p-1.5 text-fg-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50"
            title="Detach"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
