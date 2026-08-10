/**
 * One-way attach panel: link standalone vault lorebooks to a character (vault-local).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Book, ExternalLink, Link2, Trash2, Copy } from 'lucide-react';
import type { CharacterBook, LorebookListItem, VaultLorebook } from '../../db/characterTypes';
import {
  lorebookAttachmentService,
  type ResolvedLorebookAttachment,
} from '../../services/LorebookAttachmentService';
import { useCharacterContext, useLorebookContext } from '../../context';

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

  const attachedIds = new Set(resolved.map((r) => r.lorebookId));
  const available: LorebookListItem[] = lorebookListItems.filter((item) => !attachedIds.has(item.id));

  const handleAttach = async (lorebookId: string) => {
    setBusy(true);
    try {
      await lorebookAttachmentService.attach(characterId, lorebookId);
      await reload();
      setPickerOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleDetach = async (lorebookId: string) => {
    setBusy(true);
    try {
      await lorebookAttachmentService.detach(characterId, lorebookId);
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
    const entryCount = lorebook.book.entries?.length ?? 0;
    const existing = embeddedBook?.entries?.length ?? 0;
    const message =
      existing > 0
        ? `Copy ${entryCount} entries from "${lorebook.name}" into the embedded character lorebook? This replaces the current ${existing} embedded entries.`
        : `Copy ${entryCount} entries from "${lorebook.name}" into the embedded character lorebook?`;
    if (!window.confirm(message)) return;
    onCopyIntoEmbedded({
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
    });
  };

  return (
    <div className="shrink-0 border-b border-border bg-muted/30 px-3 py-3 sm:px-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
            Attached lorebooks
          </p>
          <p className="text-[11px] text-fg-muted">
            Vault-only links. Not exported with the character card unless you copy into the embedded
            book.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          disabled={busy || available.length === 0}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Link2 className="h-3.5 w-3.5" />
          Attach
        </button>
      </div>

      {pickerOpen && (
        <div className="mb-2 max-h-40 overflow-y-auto rounded-xl border border-border bg-surface p-1">
          {available.length === 0 ? (
            <p className="px-2 py-2 text-xs text-fg-muted">No other lorebooks in the vault.</p>
          ) : (
            available.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void handleAttach(item.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-fg hover:bg-hover"
              >
                <Book className="h-3.5 w-3.5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                <span className="shrink-0 text-fg-subtle">{item.entryCount} entries</span>
              </button>
            ))
          )}
        </div>
      )}

      {resolved.length === 0 ? (
        <p className="text-xs text-fg-subtle">None attached.</p>
      ) : (
        <ul className="space-y-1.5">
          {resolved.map((item) => (
            <li
              key={item.lorebookId}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-2"
            >
              <Book className={`h-3.5 w-3.5 shrink-0 ${item.missing ? 'text-danger' : 'text-accent'}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-fg">
                  {item.missing
                    ? 'Missing lorebook'
                    : item.lorebook?.name || 'Untitled'}
                </p>
                <p className="text-[11px] text-fg-muted">
                  {item.missing
                    ? 'Book was deleted from the vault'
                    : `${item.lorebook?.book.entries?.length ?? 0} entries · vault only`}
                </p>
              </div>
              {!item.missing && item.lorebook && (
                <>
                  <button
                    type="button"
                    onClick={() => handleCopy(item.lorebook!)}
                    className="rounded-lg p-1.5 text-fg-muted hover:bg-hover hover:text-fg"
                    title="Copy into embedded character lorebook"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleOpen(item.lorebookId)}
                    className="rounded-lg p-1.5 text-fg-muted hover:bg-hover hover:text-fg"
                    title="Open in lorebook vault"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => void handleDetach(item.lorebookId)}
                className="rounded-lg p-1.5 text-fg-muted hover:bg-danger-soft hover:text-danger"
                title="Detach"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
