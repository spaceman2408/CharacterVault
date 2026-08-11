/**
 * One-way attach panel: link a single standalone vault lorebook to a character.
 * Linking replaces any previous attach and prompts to copy entries into the
 * embedded character book (overwriting existing embedded entries).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Book, ExternalLink, Link2, Trash2, Copy } from 'lucide-react';
import type { CharacterBook, LorebookListItem, VaultLorebook } from '../../db/characterTypes';
import {
  lorebookAttachmentService,
  type ResolvedLorebookAttachment,
} from '../../services/LorebookAttachmentService';
import { useCharacterContext, useLorebookContext } from '../../context';

function cloneBookForEmbed(lorebook: VaultLorebook): CharacterBook {
  return {
    ...lorebook.book,
    name: lorebook.book.name || lorebook.name,
    description: lorebook.book.description ?? lorebook.description ?? '',
    entries: (lorebook.book.entries || []).map((entry) => ({
      ...entry,
      extensions: { ...entry.extensions },
      keys: [...entry.keys],
      secondary_keys: entry.secondary_keys ? [...entry.secondary_keys] : undefined,
    })),
    extensions: { ...lorebook.book.extensions },
  };
}

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
  onCopyIntoEmbedded,
}: {
  characterId: string;
  embeddedBook: CharacterBook | undefined;
  onCopyIntoEmbedded: (book: CharacterBook) => void;
}): React.ReactElement {
  const { lorebookListItems, openLorebook } = useLorebookContext();
  const { closeCharacter } = useCharacterContext();
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

  const handleOpen = async (lorebookId: string) => {
    closeCharacter();
    await openLorebook(lorebookId);
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
            One vault book per character. Linking asks to copy entries into the embedded book
            (overwrites embedded entries). Export still uses the embedded book unless you copy.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          disabled={busy || available.length === 0}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Link2 className="h-3.5 w-3.5" />
          {attachedId ? 'Replace' : 'Attach'}
        </button>
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
