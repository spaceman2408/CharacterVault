/**
 * Lorebook tab content for the home vault.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Book,
  Copy,
  Download,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  User,
  Users,
} from 'lucide-react';
import type { CharacterListItem, LorebookListItem } from '../../db/characterTypes';
import { useCharacterContext, useLorebookContext } from '../../context';
import { lorebookAttachmentService } from '../../services/LorebookAttachmentService';

function formatRelative(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function LinkedCharactersOnCard({
  characters,
  onOpenCharacter,
}: {
  characters: CharacterListItem[];
  onOpenCharacter: (characterId: string) => void;
}): React.ReactElement | null {
  if (characters.length === 0) return null;

  const preview = characters.slice(0, 3);
  const extra = characters.length - preview.length;
  const names = characters
    .slice(0, 2)
    .map((item) => item.name || 'Untitled')
    .join(', ');

  return (
    <div className="mt-2.5 flex items-center gap-2">
      <Users className="h-3 w-3 shrink-0 text-fg-subtle" />
      <div className="flex shrink-0 -space-x-1.5">
        {preview.map((character) => (
          <button
            key={character.id}
            type="button"
            title={`Open ${character.name || 'character'}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenCharacter(character.id);
            }}
            className="relative h-6 w-6 overflow-hidden rounded-full border border-surface bg-muted ring-1 ring-border transition-transform hover:z-10 hover:scale-110"
          >
            {character.thumbnailData ? (
              <img
                src={character.thumbnailData}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-fg-subtle">
                <User className="h-3 w-3" />
              </span>
            )}
          </button>
        ))}
        {extra > 0 && (
          <span className="relative flex h-6 w-6 items-center justify-center rounded-full border border-surface bg-muted text-[9px] font-semibold text-fg-muted ring-1 ring-border">
            +{extra}
          </span>
        )}
      </div>
      <p className="min-w-0 truncate text-[11px] text-fg-muted">
        {names}
        {characters.length > 2 ? ` +${characters.length - 2}` : ''}
      </p>
    </div>
  );
}

export function LorebookVaultView(): React.ReactElement {
  const {
    lorebookListItems,
    isLoading,
    createLorebook,
    openLorebook,
    deleteLorebook,
    duplicateLorebook,
    importLorebookFile,
    exportLorebook,
  } = useLorebookContext();
  const { characterListItems, openCharacter } = useCharacterContext();

  const [linksByBook, setLinksByBook] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let cancelled = false;
    void lorebookAttachmentService.listLinkedCharacterIdsByLorebook().then((map) => {
      if (!cancelled) setLinksByBook(map);
    }).catch((err) => {
      console.error('Failed to load lorebook links:', err);
      if (!cancelled) setLinksByBook({});
    });
    return () => {
      cancelled = true;
    };
  }, [lorebookListItems]);

  const charactersById = useMemo(() => {
    const map = new Map<string, CharacterListItem>();
    for (const item of characterListItems) {
      map.set(item.id, item);
    }
    return map;
  }, [characterListItems]);

  const linkedByBook = useMemo(() => {
    const result = new Map<string, CharacterListItem[]>();
    for (const [lorebookId, characterIds] of Object.entries(linksByBook)) {
      const linked = characterIds
        .map((id) => charactersById.get(id))
        .filter((item): item is CharacterListItem => item != null)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      if (linked.length > 0) result.set(lorebookId, linked);
    }
    return result;
  }, [linksByBook, charactersById]);

  const handleOpen = async (id: string) => {
    // openLorebook drops any open character payload (exclusive workspace)
    await openLorebook(id);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return lorebookListItems;
    return lorebookListItems.filter((item) => {
      if (
        item.name.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        item.tags.some((tag) => tag.toLowerCase().includes(q))
      ) {
        return true;
      }
      const linked = linkedByBook.get(item.id);
      return Boolean(linked?.some((character) => character.name.toLowerCase().includes(q)));
    });
  }, [lorebookListItems, searchQuery, linkedByBook]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      // createLorebook drops any open character payload (exclusive workspace)
      await createLorebook({ name: newName.trim() });
      setNewName('');
      setIsCreating(false);
    } catch {
      setStatusMessage('Failed to create lorebook');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setIsImporting(true);
    try {
      let count = 0;
      for (const file of Array.from(files)) {
        await importLorebookFile(file);
        count += 1;
      }
      setStatusMessage(`Imported ${count} lorebook${count === 1 ? '' : 's'}`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (item: LorebookListItem) => {
    if (!window.confirm(`Delete lorebook "${item.name}"? This cannot be undone.`)) return;
    await deleteLorebook(item.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lorebooks..."
            className="w-full rounded-full border border-transparent bg-muted py-2 pl-9 pr-4 text-sm outline-none transition-all focus:border-border-strong focus:bg-surface focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            multiple
            onChange={(e) => void handleImport(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-50"
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New Lorebook
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg">
          {statusMessage}
          <button
            type="button"
            className="ml-2 text-fg-subtle hover:text-fg"
            onClick={() => setStatusMessage(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {isCreating && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium text-fg-muted">Name</label>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="World lore, setting bible…"
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewName('');
              }}
              className="rounded-xl border border-border px-3 py-2 text-sm text-fg-muted hover:bg-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newName.trim()}
              className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center justify-between text-sm text-fg-muted">
        <span>
          {filtered.length === lorebookListItems.length
            ? `${lorebookListItems.length} lorebook${lorebookListItems.length === 1 ? '' : 's'}`
            : `${filtered.length} of ${lorebookListItems.length}`}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-fg-subtle" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <Book className="mb-3 h-12 w-12 text-fg-subtle opacity-50" />
          <p className="text-sm font-medium text-fg-muted">
            {searchQuery ? 'No lorebooks match your search' : 'No lorebooks yet'}
          </p>
          <p className="mt-1 max-w-sm text-xs text-fg-subtle">
            Create a standalone world info book or import a SillyTavern lorebook JSON. Books are not
            tied to a character unless you attach them later.
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
            >
              <Plus className="h-4 w-4" />
              New Lorebook
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="group flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent/40"
            >
              <button
                type="button"
                onClick={() => void handleOpen(item.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="mb-2 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
                    <Book className="h-5 w-5 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-fg group-hover:text-accent">
                      {item.name}
                    </h3>
                    <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted">
                      {item.description || 'No description'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-subtle">
                  <span>
                    {item.entryCount} entr{item.entryCount === 1 ? 'y' : 'ies'}
                  </span>
                  <span>{item.totalTokens.toLocaleString()} tokens</span>
                  <span>Updated {formatRelative(item.updatedAt)}</span>
                </div>
              </button>
              <LinkedCharactersOnCard
                characters={linkedByBook.get(item.id) ?? []}
                onOpenCharacter={(characterId) => void openCharacter(characterId)}
              />
              <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => void exportLorebook(item.id)}
                  className="rounded-lg p-2 text-fg-muted hover:bg-hover hover:text-fg"
                  title="Export"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void duplicateLorebook(item.id, `${item.name} (Copy)`)}
                  className="rounded-lg p-2 text-fg-muted hover:bg-hover hover:text-fg"
                  title="Duplicate"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(item)}
                  className="ml-auto rounded-lg p-2 text-fg-muted hover:bg-danger-soft hover:text-danger"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
