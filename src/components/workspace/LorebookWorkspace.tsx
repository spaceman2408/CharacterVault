/**
 * Full-screen workspace for a standalone vault lorebook.
 * Layout: entry list (includes AI context toggles) | editor | optional Orion.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Book,
  Bot,
  Download,
  History,
  Loader2,
  MessageSquare,
  PanelRight,
  Settings,
} from 'lucide-react';
import { LorebookAgentChat, type AgentToolTarget } from '../../agent';
import { useCharacterContext, useLorebookContext } from '../../context';
import { LorebookEditor } from '../editor/LorebookEditor';
import { LorebookHistoryModal } from '../history/LorebookHistoryModal';
import { CharacterSettingsPanel } from '../settings/CharacterSettingsPanel';
import { AIChatPanel } from '../ai/AIChatPanel';
import { usePersistedPanelWidth } from '../ai/hooks/usePersistedPanelWidth';
import { LinkedCharactersMenu } from './LinkedCharactersMenu';
import { flushChatSessions } from '../../utils/chatSessionFlush';
import { flushLorebookDraft } from '../editor/lorebook/draftFlush';
import type {
  CharacterBook,
  CharacterSection,
  CustomContextMeta,
  VaultLorebook,
} from '../../db/characterTypes';
import {
  createEmptyCharacterBook,
  DEFAULT_SETTINGS,
  EMPTY_CUSTOM_CONTEXT_META,
  normalizeDefaultChatPanel,
} from '../../db/characterTypes';
import { useChatPanelMode } from '../../hooks/useChatPanelMode';
import { estimateTokens } from '../../services/AIService';
import { applyModelBinding } from '../../services/resolveOperationConfig';
import {
  customContextService,
  formatCustomContextChunk,
} from '../../services/CustomContextService';
import { lorebookAttachmentService } from '../../services/LorebookAttachmentService';
import { lorebookSnapshotService } from '../../services/LorebookSnapshotService';
import { showEphemeralToast } from '../../utils/ephemeralToast';

const LINKED_CHARACTER_SYNC_MS = 400;

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
  const defaultChatPanel = normalizeDefaultChatPanel(settings?.ui?.defaultChatPanel);
  const [agentMode, setAgentMode] = useChatPanelMode(
    defaultChatPanel,
    currentLorebook?.id ?? null,
  );
  const [agentRunning, setAgentRunning] = useState(false);
  const [lorebookFocusEntry, setLorebookFocusEntry] = useState<{ id: number; nonce: number } | null>(
    null,
  );
  const openAgentTarget = useCallback((target: AgentToolTarget) => {
    if (target.type !== 'entry') return;
    setLorebookFocusEntry({ id: target.id, nonce: Date.now() });
  }, []);
  const [customContextMeta, setCustomContextMeta] = useState<CustomContextMeta>({
    ...EMPTY_CUSTOM_CONTEXT_META,
  });
  const openedLorebookIdRef = useRef<string | null>(null);
  const currentLorebookIdRef = useRef<string | null>(currentLorebook?.id ?? null);
  const currentLorebookRef = useRef<VaultLorebook | null>(currentLorebook);
  const titleDraftRef = useRef(titleDraft);
  const pendingSaveRef = useRef<Promise<VaultLorebook | null>>(Promise.resolve(null));
  const linkedSyncTimerRef = useRef<number | null>(null);
  const linkedSyncPromiseRef = useRef<Promise<void>>(Promise.resolve());
  currentLorebookIdRef.current = currentLorebook?.id ?? null;
  currentLorebookRef.current = currentLorebook;
  titleDraftRef.current = titleDraft;

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
    const lorebookId = currentLorebook?.id ?? null;
    if (!lorebookId) {
      openedLorebookIdRef.current = null;
      setCustomContextMeta({ ...EMPTY_CUSTOM_CONTEXT_META });
      return;
    }
    if (openedLorebookIdRef.current === lorebookId) return;
    openedLorebookIdRef.current = lorebookId;
    setCustomContextMeta({ ...EMPTY_CUSTOM_CONTEXT_META });
    void customContextService.getMeta(lorebookId, 'lorebook').then((meta) => {
      if (openedLorebookIdRef.current === lorebookId) {
        setCustomContextMeta(meta);
      }
    });
  }, [currentLorebook?.id]);

  const aiConfig = settings?.ai ?? DEFAULT_SETTINGS.ai;
  const samplerSettings = settings?.sampler ?? DEFAULT_SETTINGS.sampler;
  const promptSettings = settings?.prompts ?? DEFAULT_SETTINGS.prompts;
  const promptModels = settings?.promptModels;
  const agentAiConfig = useMemo(
    () => applyModelBinding(aiConfig, settings?.agentModel),
    [aiConfig, settings?.agentModel],
  );
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

  const resolveBookContextForAI = useCallback(
    async (): Promise<string[]> => {
      const chunks = buildBookContextChunks();
      const lorebookId = currentLorebookIdRef.current;
      if (!lorebookId) return chunks;
      try {
        const customBody = await customContextService.getEnabledContent(lorebookId, 'lorebook');
        if (customBody) {
          chunks.push(formatCustomContextChunk(customBody));
        }
      } catch (error) {
        console.error('Failed to load custom context for AI:', error);
      }
      return chunks;
    },
    [buildBookContextChunks],
  );

  const getContextContent = useCallback(
    (sectionIds: CharacterSection[]): Promise<string[]> => {
      void sectionIds;
      return resolveBookContextForAI();
    },
    [resolveBookContextForAI],
  );

  const getChatContextContent = useCallback(
    async (entryIds: string[]): Promise<string[]> => {
      void entryIds;
      return resolveBookContextForAI();
    },
    [resolveBookContextForAI],
  );

  const setCustomContextEnabled = useCallback(async (enabled: boolean): Promise<void> => {
    const lorebookId = currentLorebookIdRef.current;
    if (!lorebookId) return;

    setCustomContextMeta((prev) => {
      if (prev.charLength === 0) return prev;
      return {
        ...prev,
        enabled,
        updatedAt: new Date().toISOString(),
      };
    });

    try {
      const updated = await customContextService.setEnabled(lorebookId, enabled, 'lorebook');
      if (!updated && openedLorebookIdRef.current === lorebookId) {
        setCustomContextMeta({ ...EMPTY_CUSTOM_CONTEXT_META });
      }
    } catch (error) {
      console.error('Failed to update custom context enabled flag:', error);
      if (openedLorebookIdRef.current === lorebookId) {
        setCustomContextMeta((prev) => {
          if (prev.charLength === 0) return prev;
          return { ...prev, enabled: !enabled };
        });
      }
      throw error;
    }
  }, []);

  const saveCustomContext = useCallback(async (input: {
    content: string;
    enabled: boolean;
  }): Promise<void> => {
    const lorebookId = currentLorebookIdRef.current;
    if (!lorebookId) return;
    try {
      const meta = await customContextService.save(lorebookId, input, 'lorebook');
      if (openedLorebookIdRef.current === lorebookId) {
        setCustomContextMeta(meta);
      }
    } catch (error) {
      console.error('Failed to save custom context:', error);
      throw error;
    }
  }, []);

  const clearCustomContext = useCallback(async (): Promise<void> => {
    const lorebookId = currentLorebookIdRef.current;
    if (!lorebookId) return;
    try {
      await customContextService.clear(lorebookId, 'lorebook');
      if (openedLorebookIdRef.current === lorebookId) {
        setCustomContextMeta({ ...EMPTY_CUSTOM_CONTEXT_META });
      }
    } catch (error) {
      console.error('Failed to clear custom context:', error);
      throw error;
    }
  }, []);

  const syncLinkedCharacters = useCallback(async (lorebook: VaultLorebook) => {
    try {
      await lorebookAttachmentService.writeVaultToLinkedCharacters(lorebook.id, lorebook);
    } catch (error) {
      console.error('Failed to sync lorebook to linked characters:', error);
    }
  }, []);

  const scheduleLinkedSync = useCallback(
    (lorebook: VaultLorebook) => {
      if (linkedSyncTimerRef.current !== null) {
        window.clearTimeout(linkedSyncTimerRef.current);
      }
      linkedSyncTimerRef.current = window.setTimeout(() => {
        linkedSyncTimerRef.current = null;
        const run = syncLinkedCharacters(lorebook);
        linkedSyncPromiseRef.current = run;
      }, LINKED_CHARACTER_SYNC_MS);
    },
    [syncLinkedCharacters],
  );

  const flushLinkedSync = useCallback(
    async (lorebook: VaultLorebook | null) => {
      if (linkedSyncTimerRef.current !== null) {
        window.clearTimeout(linkedSyncTimerRef.current);
        linkedSyncTimerRef.current = null;
        if (lorebook) {
          await syncLinkedCharacters(lorebook);
          return;
        }
      }
      await linkedSyncPromiseRef.current;
    },
    [syncLinkedCharacters],
  );

  useEffect(() => {
    return () => {
      // Leave paths already flushed. Only write here if a debounce is still pending
      // (workspace dropped without handleClose / handleOpenLinkedCharacter).
      if (linkedSyncTimerRef.current === null) return;
      window.clearTimeout(linkedSyncTimerRef.current);
      linkedSyncTimerRef.current = null;
      const lorebook = currentLorebookRef.current;
      if (lorebook) {
        void lorebookAttachmentService.writeVaultToLinkedCharacters(lorebook.id, lorebook);
      }
    };
  }, []);

  const handleBookChange = useCallback(
    async (book: CharacterBook) => {
      const lorebook = currentLorebookRef.current;
      if (!lorebook) return;
      setIsSaving(true);
      const save = (async () => {
        try {
          let updated = await updateLorebookBook(lorebook.id, book);
          const nextName = book.name?.trim();
          if (nextName && nextName !== lorebook.name) {
            updated = await updateLorebook(lorebook.id, { name: nextName });
          }
          if (updated) {
            scheduleLinkedSync(updated);
          }
          return updated;
        } finally {
          setIsSaving(false);
        }
      })();
      pendingSaveRef.current = save.then(
        (updated) => updated,
        () => currentLorebookRef.current,
      );
      await save;
    },
    [updateLorebookBook, updateLorebook, scheduleLinkedSync],
  );

  const getAgentBook = useCallback((): CharacterBook => {
    return currentLorebookRef.current?.book ?? createEmptyCharacterBook();
  }, []);

  const setAgentBook = useCallback(async (book: CharacterBook) => {
    await pendingSaveRef.current;
    await handleBookChange(book);
  }, [handleBookChange]);

  const getAgentCustomContext = useCallback(async (): Promise<string | null> => {
    const lorebookId = currentLorebookIdRef.current;
    if (!lorebookId) return null;
    return customContextService.getEnabledContent(lorebookId, 'lorebook');
  }, []);

  const flushAgentDraft = useCallback(() => {
    flushLorebookDraft();
  }, []);

  const takeAgentSnapshot = useCallback(async () => {
    await pendingSaveRef.current;
    const lorebook = currentLorebookRef.current;
    if (!lorebook) return;
    await lorebookSnapshotService.createFromLorebook(lorebook, 'auto');
  }, []);

  const handleTitleBlur = useCallback(async () => {
    const lorebook = currentLorebookRef.current;
    if (!lorebook) return;
    const next = titleDraftRef.current.trim();
    if (!next || next === lorebook.name) return;
    const updated = await updateLorebook(lorebook.id, {
      name: next,
      book: {
        ...lorebook.book,
        name: next,
      },
    });
    currentLorebookRef.current = updated;
    scheduleLinkedSync(updated);
  }, [updateLorebook, scheduleLinkedSync]);

  const flushPendingLorebook = useCallback(async (): Promise<VaultLorebook | null> => {
    flushLorebookDraft();
    const saved = await pendingSaveRef.current;
    const lorebook = saved ?? currentLorebookRef.current;
    if (!lorebook) return null;
    const nextName = titleDraftRef.current.trim();
    let latest = lorebook;
    if (nextName && nextName !== lorebook.name) {
      latest = await updateLorebook(lorebook.id, {
        name: nextName,
        book: {
          ...lorebook.book,
          name: nextName,
        },
      });
    }
    currentLorebookRef.current = latest;
    await flushLinkedSync(latest);
    return latest;
  }, [updateLorebook, flushLinkedSync]);

  const handleClose = useCallback(async () => {
    try {
      await flushChatSessions();
      await flushPendingLorebook();
    } finally {
      closeLorebook();
    }
  }, [flushPendingLorebook, closeLorebook]);

  const handleOpenLinkedCharacter = useCallback(
    async (characterId: string) => {
      try {
        await flushChatSessions();
        await flushPendingLorebook();
      } finally {
        await openCharacter(characterId);
      }
    },
    [flushPendingLorebook, openCharacter],
  );

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
      <header className="h-16 flex items-center justify-between px-2 sm:px-4 md:px-6 bg-surface/60 backdrop-blur-xl border-b border-border/60 shrink-0">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3 md:gap-4">
          <button
            type="button"
            onClick={() => void handleClose()}
            className="p-2 text-fg-muted hover:text-accent hover:bg-accent-soft rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent active:scale-95 shrink-0"
            title="Back to vault"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hover sm:flex md:h-10 md:w-10">
              <Book className="h-4 w-4 text-accent md:h-5 md:w-5" />
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
              <p className={`text-xs truncate ${agentRunning ? 'block' : 'hidden sm:block'}`}>
                <span className={`text-fg-muted ${agentRunning ? 'hidden sm:inline' : ''}`}>
                  {entryCount} entr{entryCount === 1 ? 'y' : 'ies'}
                  {totalTokens > 0 ? ` · ${totalTokens.toLocaleString()} tokens` : ''}
                  {isSaving ? ' · Saving…' : ''}
                </span>
                {agentRunning ? (
                  <span
                    role="status"
                    aria-live="polite"
                    title="New entries appear when the run finishes. Use Snapshots to roll back."
                    className="text-accent animate-pulse sm:ml-2"
                  >
                    Agent writing
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1 md:gap-2">
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
            onOpenCharacter={handleOpenLinkedCharacter}
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
            focusEntry={lorebookFocusEntry}
            customContext={{
              ownerId: currentLorebook.id,
              meta: customContextMeta,
              onSetEnabled: setCustomContextEnabled,
              onSave: saveCustomContext,
              onClear: clearCustomContext,
            }}
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
            <div key={currentLorebook.id} className="flex h-full min-h-0 w-full flex-col">
              {agentMode ? (
                <LorebookAgentChat
                  aiConfig={agentAiConfig}
                  samplerSettings={samplerSettings}
                  promptSettings={promptSettings}
                  getBook={getAgentBook}
                  setBook={setAgentBook}
                  getCustomContext={getAgentCustomContext}
                  flushDraft={flushAgentDraft}
                  takeSnapshot={takeAgentSnapshot}
                  chatOwnerType="lorebook"
                  chatOwnerId={currentLorebook.id}
                  customContextIncluded={
                    customContextMeta.enabled && customContextMeta.charLength > 0
                  }
                  customContextCharLength={
                    customContextMeta.enabled ? customContextMeta.charLength : 0
                  }
                  headerActions={
                    <button
                      type="button"
                      onClick={() => setAgentMode(false)}
                      className="inline-flex items-center gap-1 text-xs text-accent px-2 py-1 rounded-lg bg-accent-soft"
                      title="Switch to Orion chat"
                      aria-pressed
                    >
                      <Bot className="w-3.5 h-3.5" />
                      Agent
                    </button>
                  }
                  onClose={() => setIsChatOpen(false)}
                  onRunningChange={setAgentRunning}
                  onOpenTarget={openAgentTarget}
                />
              ) : (
                <AIChatPanel
                  selectedText={selectedText}
                  contextEntryIds={['lorebook']}
                  customContextIncluded={
                    customContextMeta.enabled && customContextMeta.charLength > 0
                  }
                  aiConfig={aiConfig}
                  samplerSettings={samplerSettings}
                  promptSettings={promptSettings}
                  getContextContent={getChatContextContent}
                  onComplete={() => {}}
                  activeSection="lorebook"
                  onClose={() => setIsChatOpen(false)}
                  isMobile={isMobile}
                  chatOwnerType="lorebook"
                  chatOwnerId={currentLorebook.id}
                  headerActions={
                    <button
                      type="button"
                      onClick={() => setAgentMode(true)}
                      className="inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-accent px-2 py-1 rounded-lg hover:bg-accent-soft transition-colors"
                      title="Switch to Agent mode"
                      aria-pressed={false}
                    >
                      <Bot className="w-3.5 h-3.5" />
                      Agent
                    </button>
                  }
                />
              )}
            </div>
          )}
        </aside>
      </div>

      {historyOpen && (
        <LorebookHistoryModal
          lorebookId={currentLorebook.id}
          onClose={() => setHistoryOpen(false)}
          onFlushPending={flushPendingLorebook}
          onToast={(type, title, message) => {
            showEphemeralToast({ type, title, message, durationMs: 3500 });
          }}
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
