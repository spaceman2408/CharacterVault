import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Book, Copy, ExternalLink, Link2, Trash2 } from 'lucide-react';
import type { CharacterBook, LorebookListItem, VaultLorebook } from '../../db/characterTypes';
import {
  cloneBookForEmbed,
  cloneEmbeddedBook,
  lorebookAttachmentService,
  type ResolvedLorebookAttachment,
} from '../../services/LorebookAttachmentService';
import { useCharacterEditorContext, useLorebookContext } from '../../context';
import { flushLorebookDraft } from './lorebook/draftFlush';
import { FieldInfoTip } from './lorebook/FieldInfoTip';
import type { LorebookAttachmentControls } from './lorebook/types';

const ATTACH_HELP =
  'One library book per character. Open in vault writes this lorebook to the linked book (or creates one), then opens it. Edits in the library update every linked character. Linking asks to copy entries onto the character (replaces what\'s already there).';

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

interface AttachmentApi {
  attached: ResolvedLorebookAttachment | null;
  available: LorebookListItem[];
  lorebookListItems: LorebookListItem[];
  pickerOpen: boolean;
  setPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  busy: boolean;
  menuOpen: boolean;
  openMenu: (anchor: HTMLElement) => void;
  closeMenu: () => void;
  handleAttach: (lorebookId: string) => void;
  handleDetach: () => void;
  handleOpenInVault: () => void;
  handleCopy: (lorebook: VaultLorebook) => void;
  handleOpen: (lorebookId: string) => void;
}

const AttachmentContext = createContext<AttachmentApi | null>(null);

export function LorebookAttachmentProvider({
  characterId,
  embeddedBook,
  characterName,
  onCopyIntoEmbedded,
  closeSignal,
  onMenuOpen,
  children,
}: LorebookAttachmentControls & {
  closeSignal?: boolean;
  onMenuOpen?: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  const { lorebookListItems, openLorebook, createLorebook } = useLorebookContext();
  const { flushPendingSaves } = useCharacterEditorContext();
  const [resolved, setResolved] = useState<ResolvedLorebookAttachment[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const onMenuOpenRef = useRef(onMenuOpen);
  onMenuOpenRef.current = onMenuOpen;
  const mountedRef = useRef(true);
  const resolveGenRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      resolveGenRef.current += 1;
    };
  }, []);

  const reload = useCallback(async () => {
    const gen = ++resolveGenRef.current;
    const next = await lorebookAttachmentService.resolve(characterId);
    if (!mountedRef.current || gen !== resolveGenRef.current) return;
    setResolved(next);
  }, [characterId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const attached = resolved[0] ?? null;
  const attachedId = attached?.lorebookId ?? null;

  const available: LorebookListItem[] = useMemo(
    () => lorebookListItems.filter((item) => item.id !== attachedId),
    [lorebookListItems, attachedId],
  );

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuPos(null);
    setPickerOpen(false);
  }, []);

  const openMenu = useCallback((anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    setMenuPos({ top: rect.bottom + 4, left });
    setPickerOpen(false);
    onMenuOpenRef.current?.();
    setMenuOpen(true);
  }, []);

  useEffect(() => {
    if (closeSignal) closeMenu();
  }, [closeSignal, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-lorebook-attach-trigger]')) {
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
  }, [menuOpen, closeMenu]);

  const handleAttach = useCallback(
    async (lorebookId: string) => {
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
        if (!mountedRef.current) return;
        const next = await lorebookAttachmentService.resolve(characterId);
        if (!mountedRef.current) return;
        setResolved(next);
        setPickerOpen(false);

        const linked = next.find((item) => item.lorebookId === lorebookId)?.lorebook;
        if (linked && promptCopyIntoEmbedded(linked, embeddedBook)) {
          onCopyIntoEmbedded(cloneBookForEmbed(linked));
        }
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    },
    [busy, attachedId, attached, characterId, embeddedBook, onCopyIntoEmbedded],
  );

  const handleDetach = useCallback(async () => {
    if (!attachedId || busy) return;
    setBusy(true);
    try {
      await lorebookAttachmentService.detach(characterId, attachedId);
      if (!mountedRef.current) return;
      await reload();
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [attachedId, busy, characterId, reload]);

  const fallbackVaultName = useCallback(
    (book?: CharacterBook) =>
      (book?.name || '').trim() ||
      (characterName ? `${characterName}'s Lorebook` : 'Character Lorebook'),
    [characterName],
  );

  const pushEmbeddedAndOpen = useCallback(
    async (lorebookId: string) => {
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
    },
    [embeddedBook, fallbackVaultName, flushPendingSaves, openLorebook],
  );

  const handleOpen = useCallback(
    async (lorebookId: string) => {
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
        if (mountedRef.current) setBusy(false);
      }
    },
    [busy, pushEmbeddedAndOpen],
  );

  const handleOpenInVault = useCallback(async () => {
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
        if (mountedRef.current) setBusy(false);
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
      const book = cloneEmbeddedBook(latest?.data.characterBook ?? embeddedBook, fallbackName);
      const created = await createLorebook({
        name: book.name || fallbackName,
        description: book.description || '',
        book,
      });
      await lorebookAttachmentService.attach(characterId, created.id);
    } catch (err) {
      console.error('Failed to open lorebook in vault:', err);
      window.alert(
        err instanceof Error ? err.message : 'Could not create or open the vault lorebook.',
      );
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [
    busy,
    attached,
    embeddedBook,
    fallbackVaultName,
    pushEmbeddedAndOpen,
    flushPendingSaves,
    createLorebook,
    characterId,
  ]);

  const handleCopy = useCallback(
    (lorebook: VaultLorebook) => {
      if (!promptCopyIntoEmbedded(lorebook, embeddedBook)) return;
      onCopyIntoEmbedded(cloneBookForEmbed(lorebook));
    },
    [embeddedBook, onCopyIntoEmbedded],
  );

  const api = useMemo<AttachmentApi>(
    () => ({
      attached,
      available,
      lorebookListItems,
      pickerOpen,
      setPickerOpen,
      busy,
      menuOpen,
      openMenu,
      closeMenu,
      handleAttach: (id) => void handleAttach(id),
      handleDetach: () => void handleDetach(),
      handleOpenInVault: () => void handleOpenInVault(),
      handleCopy,
      handleOpen: (id) => void handleOpen(id),
    }),
    [
      attached,
      available,
      lorebookListItems,
      pickerOpen,
      busy,
      menuOpen,
      openMenu,
      closeMenu,
      handleAttach,
      handleDetach,
      handleOpenInVault,
      handleCopy,
      handleOpen,
    ],
  );

  return (
    <AttachmentContext.Provider value={api}>
      {children}
      {menuOpen && menuPos && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="dialog"
              aria-label="Attached lorebook"
              className="fixed z-9999 w-80 max-w-[min(20rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <AttachmentPanel />
            </div>,
            document.body,
          )
        : null}
    </AttachmentContext.Provider>
  );
}

export function LorebookAttachmentButton(): React.ReactElement | null {
  const api = useContext(AttachmentContext);
  if (!api) return null;

  const { attached, menuOpen, openMenu, closeMenu, busy } = api;
  const label = !attached
    ? 'Attach'
    : attached.missing
      ? 'Missing'
      : attached.lorebook?.name || 'Attached';

  return (
    <button
      type="button"
      data-lorebook-attach-trigger=""
      disabled={busy}
      onClick={(event) => {
        if (menuOpen) closeMenu();
        else openMenu(event.currentTarget);
      }}
      className={`inline-flex items-center justify-center gap-0 rounded-lg border p-2 text-xs font-medium transition-colors touch-manipulation disabled:cursor-not-allowed disabled:opacity-40 md:max-w-[10rem] md:gap-1.5 md:px-2.5 md:py-1.5 ${
        menuOpen
          ? 'border-accent bg-accent text-accent-fg'
          : attached?.missing
            ? 'border-danger/40 text-danger hover:bg-danger-soft'
            : 'border-border text-fg-muted hover:bg-hover hover:text-fg'
      }`}
      aria-expanded={menuOpen}
      aria-haspopup="dialog"
      aria-label={attached && !attached.missing ? `Attached: ${label}` : attached?.missing ? 'Missing lorebook' : 'Attach lorebook'}
      title={attached && !attached.missing ? `Attached: ${label}` : 'Attached lorebook'}
    >
      <Link2 className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden min-w-0 truncate md:inline">{label}</span>
      {attached && !attached.missing && !menuOpen ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
      ) : null}
    </button>
  );
}

function AttachmentPanel(): React.ReactElement | null {
  const api = useContext(AttachmentContext);
  if (!api) return null;

  const {
    attached,
    available,
    lorebookListItems,
    pickerOpen,
    setPickerOpen,
    busy,
    handleAttach,
    handleDetach,
    handleOpenInVault,
    handleCopy,
    handleOpen,
  } = api;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-1">
          <p className="text-sm font-semibold text-fg">Attached lorebook</p>
          <FieldInfoTip text={ATTACH_HELP} label="About attached lorebooks" />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleOpenInVault}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-40 touch-manipulation"
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
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-40 touch-manipulation"
          >
            <Link2 className="h-3.5 w-3.5" />
            {attached?.lorebookId ? 'Replace' : 'Attach'}
          </button>
        </div>
      </div>

      <div className="space-y-2 p-2">
        {pickerOpen && (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-bg p-1">
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
                  onClick={() => handleAttach(item.id)}
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
          <p className="px-1 py-1 text-xs text-fg-subtle">None attached.</p>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-2.5 py-2">
            <Book
              className={`h-3.5 w-3.5 shrink-0 ${attached.missing ? 'text-danger' : 'text-accent'}`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-fg">
                {attached.missing ? 'Missing lorebook' : attached.lorebook?.name || 'Untitled'}
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
                  onClick={() => handleOpen(attached.lorebookId)}
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
              onClick={handleDetach}
              disabled={busy}
              className="rounded-lg p-1.5 text-fg-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50"
              title="Detach"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
