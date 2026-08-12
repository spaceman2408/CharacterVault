/**
 * Read-only list of characters that attach the open vault lorebook.
 * Navigate only — attach/detach lives on the character editor.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Loader2, User, Users } from 'lucide-react';
import type { CharacterListItem } from '../../db/characterTypes';
import { lorebookAttachmentService } from '../../services/LorebookAttachmentService';

interface LinkedCharactersMenuProps {
  lorebookId: string;
  onOpenCharacter: (characterId: string) => void | Promise<void>;
}

export function LinkedCharactersMenu({
  lorebookId,
  onOpenCharacter,
}: LinkedCharactersMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [linkedCount, setLinkedCount] = useState(0);
  const [linked, setLinked] = useState<CharacterListItem[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  const mountedRef = useRef(true);
  const countGenRef = useRef(0);
  const listGenRef = useRef(0);
  /** Eager open flag so in-flight list loads do not race React state. */
  const openRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      openRef.current = false;
      countGenRef.current += 1;
      listGenRef.current += 1;
    };
  }, []);

  const closeMenu = useCallback(() => {
    openRef.current = false;
    // Cancel in-flight list loads so late results cannot re-pin thumbnails.
    listGenRef.current += 1;
    setOpen(false);
    setLinked([]);
    setMenuPosition(null);
    setOpeningId(null);
    setLoading(false);
  }, []);

  const loadCount = useCallback(async () => {
    const gen = ++countGenRef.current;
    try {
      const count = await lorebookAttachmentService.countLinkedCharacters(lorebookId);
      if (!mountedRef.current || gen !== countGenRef.current) return;
      setLinkedCount(count);
    } catch (err) {
      if (!mountedRef.current || gen !== countGenRef.current) return;
      console.error('Failed to count linked characters:', err);
      setLinkedCount(0);
    }
  }, [lorebookId]);

  /** Full list items (incl. thumbnails) only while the menu is open. */
  const loadList = useCallback(async () => {
    const gen = ++listGenRef.current;
    setLoading(true);
    try {
      const items = await lorebookAttachmentService.listLinkedCharacters(lorebookId);
      if (!mountedRef.current || gen !== listGenRef.current || !openRef.current) return;
      setLinkedCount(items.length);
      setLinked(items);
    } catch (err) {
      if (!mountedRef.current || gen !== listGenRef.current) return;
      console.error('Failed to load linked characters:', err);
      setLinkedCount(0);
      setLinked([]);
    } finally {
      if (mountedRef.current && gen === listGenRef.current) {
        setLoading(false);
      }
    }
  }, [lorebookId]);

  // Prefetch badge count only (keys, no thumbnail payloads).
  useEffect(() => {
    openRef.current = false;
    listGenRef.current += 1;
    setLinkedCount(0);
    setLinked([]);
    setOpen(false);
    setMenuPosition(null);
    setOpeningId(null);
    setLoading(false);
    void loadCount();
  }, [loadCount]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      closeMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, closeMenu]);

  const handleToggle = () => {
    if (openRef.current) {
      closeMenu();
      return;
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    openRef.current = true;
    setOpen(true);
    void loadList();
  };

  const handleOpenCharacter = async (characterId: string) => {
    if (openingId) return;
    setOpeningId(characterId);
    try {
      // openCharacter drops the lorebook workspace; avoid setState after unmount.
      await onOpenCharacter(characterId);
      if (!mountedRef.current) return;
      closeMenu();
    } catch {
      if (!mountedRef.current) return;
      setOpeningId(null);
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 px-2 md:px-3 py-2 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-xl transition-colors duration-200"
        title="Characters that attach this lorebook"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Users className="w-4 h-4" />
        <span className="hidden md:inline">Linked</span>
        <span
          className={`min-w-4 rounded-full px-1 text-[10px] font-semibold tabular-nums ${
            linkedCount > 0
              ? 'bg-accent-soft text-accent'
              : 'bg-muted text-fg-subtle'
          }`}
        >
          {linkedCount}
        </span>
      </button>

      {open &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Linked characters"
            className="fixed z-9999 w-72 max-w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
            style={{ top: menuPosition.top, right: menuPosition.right }}
          >
            <div className="border-b border-border px-3 py-2">
              <p className="text-xs font-semibold text-fg">Linked characters</p>
              <p className="mt-0.5 text-[11px] text-fg-muted">
                Attach from a character editor. Open a character to edit the card.
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto p-1">
              {loading && linked.length === 0 ? (
                <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-fg-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading…
                </div>
              ) : linked.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-fg-muted">
                  No characters attach this book yet.
                </p>
              ) : (
                linked.map((character) => {
                  const isOpening = openingId === character.id;
                  return (
                    <button
                      key={character.id}
                      type="button"
                      role="menuitem"
                      disabled={openingId !== null}
                      onClick={() => void handleOpenCharacter(character.id)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-hover disabled:cursor-wait disabled:opacity-60"
                    >
                      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                        {character.thumbnailData ? (
                          <img
                            src={character.thumbnailData}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-fg-subtle">
                            <User className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
                        {character.name || 'Untitled'}
                      </span>
                      {isOpening ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-fg-muted" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
