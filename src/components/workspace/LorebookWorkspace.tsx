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

const HEADER_ACTION_CLASS =
  'flex items-center gap-2 px-2 md:px-3 py-2 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-xl transition-colors duration-200';

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
    <div className="h-dvh w-full flex flex-col bg-bg overflow-hidden">
      <header className="h-16 flex items-center justify-between px-4 md:px-6 bg-surface/60 backdrop-blur-xl border-b border-border/60 shrink-0">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <button
            type="button"
            onClick={closeLorebook}
            className="p-2 text-fg-muted hover:text-accent hover:bg-accent-soft rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent active:scale-95 shrink-0"
            title="Back to vault"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-hover flex items-center justify-center shrink-0">
              <Book className="w-4 h-4 md:w-5 md:h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => void handleTitleBlur()}
                className="w-full max-w-64 truncate bg-transparent font-semibold text-fg text-sm md:text-base outline-none focus:ring-0"
                aria-label="Lorebook name"
              />
              <p className="text-xs text-fg-muted hidden sm:block truncate">
                {entryCount} entr{entryCount === 1 ? 'y' : 'ies'}
                {totalTokens > 0 ? ` · ${totalTokens.toLocaleString()} tokens` : ''}
                {isSaving ? ' · Saving…' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {isMobile ? (
            <button
              type="button"
              onClick={toggleChat}
              className={`p-2 rounded-lg transition-colors ${
                isChatOpen
                  ? 'bg-accent text-accent-fg'
                  : 'text-fg-muted hover:text-accent hover:bg-accent-soft'
              }`}
              title={isChatOpen ? 'Hide Ask AI Panel' : 'Show Ask AI Panel'}
              aria-pressed={isChatOpen}
            >
              <MessageSquare className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleChat}
              className={`hidden lg:flex p-2 rounded-lg transition-colors ${
                isChatOpen
                  ? 'bg-accent text-accent-fg'
                  : 'text-fg-muted hover:text-accent hover:bg-accent-soft'
              }`}
              title={isChatOpen ? 'Hide Ask AI Panel' : 'Show Ask AI Panel'}
              aria-pressed={isChatOpen}
            >
              <PanelRight className="w-4 h-4" />
            </button>
          )}

          <div className="h-6 w-px bg-hover mx-1 hidden sm:block" />

          <LinkedCharactersMenu
            lorebookId={currentLorebook.id}
            onOpenCharacter={(characterId) => openCharacter(characterId)}
          />

          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className={HEADER_ACTION_CLASS}
            title="Open revisions"
          >
            <History className="w-4 h-4" />
            <span className="hidden md:inline">Snapshots</span>
          </button>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className={HEADER_ACTION_CLASS}
            title="AI Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden md:inline">Settings</span>
          </button>
          <button
            type="button"
            onClick={() => void exportLorebook(currentLorebook.id)}
            disabled={entryCount === 0}
            className={`${HEADER_ACTION_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
            title="Export SillyTavern JSON"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">Export</span>
          </button>
        </div>
      </header>

      {isMobile && isChatOpen && (
        <button
          type="button"
          aria-label="Close Orion"
          className="fixed inset-0 z-30 bg-overlay backdrop-blur-sm lg:hidden"
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
