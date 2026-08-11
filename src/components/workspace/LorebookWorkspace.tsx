/**
 * Full-screen workspace for a standalone vault lorebook.
 * Layout: entry list (includes AI context toggles) | editor | optional Orion.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Book,
  Download,
  History,
  Loader2,
  MessageSquare,
  PanelRight,
  Settings,
} from 'lucide-react';
import { useCharacterContext, useLorebookContext } from '../../context';
import { LorebookEditor } from '../editor/LorebookEditor';
import { LorebookHistoryModal } from '../history/LorebookHistoryModal';
import { CharacterSettingsPanel } from '../settings/CharacterSettingsPanel';
import { AIChatPanel } from '../ai/AIChatPanel';
import { usePersistedPanelWidth } from '../ai/hooks/usePersistedPanelWidth';
import { LinkedCharactersMenu } from './LinkedCharactersMenu';
import type { CharacterBook, CharacterSection } from '../../db/characterTypes';
import { DEFAULT_SETTINGS } from '../../db/characterTypes';
import { estimateTokens } from '../../services/AIService';
import { lorebookSnapshotService } from '../../services/LorebookSnapshotService';

const DESKTOP_MIN_WIDTH_PX = 1024;

function getIsMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(max-width: ${DESKTOP_MIN_WIDTH_PX - 1}px)`).matches;
}

export function LorebookWorkspace(): React.ReactElement {
  const {
    currentLorebook,
    closeLorebook,
    updateLorebookBook,
    updateLorebook,
    exportLorebook,
  } = useLorebookContext();
  const { settings, refreshSettings, openCharacter } = useCharacterContext();

  const [selectedText, setSelectedText] = useState('');
  const [fontSize, setFontSize] = useState(settings?.ui?.editorFontSize ?? 14);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [titleDraft, setTitleDraft] = useState(currentLorebook?.name ?? '');
  const [isMobile, setIsMobile] = useState(getIsMobileViewport);
  const [isChatOpen, setIsChatOpen] = useState(() => !getIsMobileViewport());

  const {
    width: chatPanelWidth,
    isDragging: isChatResizing,
    onResizePointerDown: onChatResizePointerDown,
  } = usePersistedPanelWidth({
    storageKey: 'lorebookChatPanelWidth',
    enabled: !isMobile,
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${DESKTOP_MIN_WIDTH_PX - 1}px)`);
    let lastMobile: boolean | null = null;

    const apply = (mobile: boolean) => {
      if (lastMobile === mobile) return;
      lastMobile = mobile;
      setIsMobile(mobile);
      // Close on mobile enter; open Orion on desktop enter (user can still hide it)
      setIsChatOpen(!mobile);
    };

    apply(mql.matches);
    const onChange = (event: MediaQueryListEvent) => apply(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    setTitleDraft(currentLorebook?.name ?? '');
  }, [currentLorebook?.id, currentLorebook?.name]);

  useEffect(() => {
    if (!currentLorebook) return;
    const timer = window.setTimeout(() => {
      void lorebookSnapshotService.createFromLorebook(currentLorebook, 'auto');
    }, 30_000);
    return () => window.clearTimeout(timer);
  }, [currentLorebook]);

  const aiConfig = settings?.ai ?? DEFAULT_SETTINGS.ai;
  const samplerSettings = settings?.sampler ?? DEFAULT_SETTINGS.sampler;
  const promptSettings = settings?.prompts ?? DEFAULT_SETTINGS.prompts;
  const promptModels = settings?.promptModels;
  const spellcheck = settings?.ui?.spellcheck;
  const markdownImageOpenLinks = settings?.ui?.markdownImageOpenLinks;

  const entryCount = currentLorebook?.book?.entries?.length ?? 0;
  const totalTokens = useMemo(() => {
    const entries = currentLorebook?.book?.entries ?? [];
    return entries.reduce((sum, entry) => sum + estimateTokens(entry.content || ''), 0);
  }, [currentLorebook?.book?.entries]);

  const buildBookContextChunks = useCallback((): string[] => {
    const book = currentLorebook?.book;
    if (!book) return [];
    const chunks: string[] = [];
    const header = `Standalone Lorebook: ${book.name || currentLorebook?.name || 'World Info'}`;
    chunks.push(book.description ? `${header}\n${book.description}` : header);
    for (const entry of book.entries || []) {
      if (entry.extensions?.context_enabled === false) continue;
      if (!entry.enabled) continue;
      const title = entry.comment || entry.name || `Entry ${entry.id}`;
      const keys = entry.keys?.length ? `Keys: ${entry.keys.join(', ')}\n` : '';
      const secondary =
        entry.selective && entry.secondary_keys?.length
          ? `Secondary keys: ${entry.secondary_keys.join(', ')}\n`
          : '';
      chunks.push(`### ${title}\n${keys}${secondary}${entry.content || ''}`);
    }
    return chunks;
  }, [currentLorebook]);

  const getContextContent = useCallback(
    (sectionIds: CharacterSection[]): string[] => {
      void sectionIds;
      return buildBookContextChunks();
    },
    [buildBookContextChunks],
  );

  const getChatContextContent = useCallback(
    async (entryIds: string[]): Promise<string[]> => {
      void entryIds;
      return buildBookContextChunks();
    },
    [buildBookContextChunks],
  );

  const handleBookChange = useCallback(
    async (book: CharacterBook) => {
      if (!currentLorebook) return;
      setIsSaving(true);
      try {
        await updateLorebookBook(currentLorebook.id, book);
        if (book.name && book.name.trim() && book.name.trim() !== currentLorebook.name) {
          await updateLorebook(currentLorebook.id, { name: book.name.trim() });
        }
      } finally {
        setIsSaving(false);
      }
    },
    [currentLorebook, updateLorebookBook, updateLorebook],
  );

  const handleTitleBlur = useCallback(async () => {
    if (!currentLorebook) return;
    const next = titleDraft.trim();
    if (!next || next === currentLorebook.name) return;
    await updateLorebook(currentLorebook.id, {
      name: next,
      book: {
        ...currentLorebook.book,
        name: next,
      },
    });
  }, [currentLorebook, titleDraft, updateLorebook]);

  const toggleChat = () => setIsChatOpen((open) => !open);

  if (!currentLorebook) {
    return (
      <div className="flex h-dvh items-center justify-center bg-bg text-fg-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-bg text-fg">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur-md sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={closeLorebook}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg touch-manipulation"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Vault</span>
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
            <Book className="h-4 w-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => void handleTitleBlur()}
              className="w-full truncate bg-transparent text-sm font-semibold text-fg outline-none focus:ring-0"
              aria-label="Lorebook name"
            />
            <p className="truncate text-[11px] text-fg-muted">
              {entryCount} entr{entryCount === 1 ? 'y' : 'ies'}
              {totalTokens > 0 ? ` · ${totalTokens.toLocaleString()} tokens` : ''}
              {isSaving ? ' · Saving…' : ''}
            </p>
          </div>
        </div>

        <LinkedCharactersMenu
          lorebookId={currentLorebook.id}
          onOpenCharacter={(characterId) => openCharacter(characterId)}
        />

        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg touch-manipulation"
          title="History"
        >
          <History className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">History</span>
        </button>
        <button
          type="button"
          onClick={() => void exportLorebook(currentLorebook.id)}
          disabled={entryCount === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
          title="Export SillyTavern JSON"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg touch-manipulation"
          title="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Settings</span>
        </button>

        <button
          type="button"
          onClick={toggleChat}
          className={`rounded-lg p-2 transition-colors ${
            isChatOpen
              ? 'bg-accent text-accent-fg'
              : 'text-fg-muted hover:bg-accent-soft hover:text-accent'
          }`}
          title={isChatOpen ? 'Hide Orion' : 'Show Orion'}
          aria-pressed={isChatOpen}
        >
          {isMobile ? <MessageSquare className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
        </button>
      </header>

      {isMobile && isChatOpen && (
        <button
          type="button"
          aria-label="Close Orion"
          className="fixed inset-0 z-30 bg-overlay/50 backdrop-blur-[1px]"
          onClick={() => setIsChatOpen(false)}
        />
      )}

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <LorebookEditor
            lorebook={currentLorebook.book}
            onChange={(book) => void handleBookChange(book)}
            setSelectedText={setSelectedText}
            contextSectionIds={['lorebook']}
            aiConfig={aiConfig}
            samplerSettings={samplerSettings}
            promptSettings={promptSettings}
            promptModels={promptModels}
            getContextContent={getContextContent}
            activeSection="lorebook"
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            characterName={currentLorebook.name}
            spellcheck={spellcheck}
            markdownImageOpenLinks={markdownImageOpenLinks}
          />
        </main>

        <aside
          className={`
            relative z-40 flex shrink-0 flex-col bg-bg
            max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:h-dvh max-lg:max-w-[min(24rem,90vw)] max-lg:shadow-2xl
            ${isChatOpen ? 'max-lg:translate-x-0' : 'max-lg:translate-x-full'}
            ${isChatOpen && !isMobile ? 'border-l border-border' : ''}
            ${!isChatOpen && !isMobile ? 'w-0 overflow-hidden opacity-0' : ''}
            ${isChatResizing ? '' : 'transition-all duration-300 ease-in-out'}
          `}
          style={
            !isMobile
              ? { width: isChatOpen ? chatPanelWidth : 0 }
              : isChatOpen
                ? { width: 'min(24rem, 90vw)' }
                : undefined
          }
        >
          {isChatOpen && !isMobile && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize Orion panel"
              title="Drag to resize"
              onPointerDown={onChatResizePointerDown}
              className="absolute bottom-0 left-0 top-0 z-10 -ml-0.5 w-1.5 cursor-col-resize touch-none group max-lg:hidden"
            >
              <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-transparent transition-colors group-hover:bg-accent/60 group-active:bg-accent" />
            </div>
          )}

          {isChatOpen && (
            <div className="flex h-full min-h-0 w-full flex-col">
              <AIChatPanel
                selectedText={selectedText}
                contextEntryIds={['lorebook']}
                aiConfig={aiConfig}
                samplerSettings={samplerSettings}
                promptSettings={promptSettings}
                getContextContent={getChatContextContent}
                onComplete={() => {}}
                activeSection="lorebook"
                onClose={() => setIsChatOpen(false)}
                isMobile={isMobile}
              />
            </div>
          )}
        </aside>
      </div>

      {historyOpen && (
        <LorebookHistoryModal
          lorebookId={currentLorebook.id}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      <CharacterSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        reloadSettings={refreshSettings}
      />

      <span className="sr-only" aria-hidden>
        {selectedText}
      </span>
    </div>
  );
}
