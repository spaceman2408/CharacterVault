/**
 * Shared lorebook editor (character section + standalone vault).
 * Two-panel: entry list sidebar + detail editor.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Book,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  GitFork,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { CharacterBook, LorebookEntry } from '../../../db/characterTypes';
import { importLorebook, convertToSTLorebook } from '../../../services/LorebookConverter';
import { estimateTokens, BYTES_PER_TOKEN } from '../../../services/AIService';
import { estimateCustomContextTokensFromCharLength } from '../../../services/CustomContextService';
import { CustomContextBlock } from '../../ai/CustomContextBlock';
import {
  LorebookAttachmentButton,
  LorebookAttachmentProvider,
} from '../CharacterLorebookAttachments';
import { LorebookEntryDetail } from './LorebookEntryDetail';
import { MemoizedLorebookEntryListItem } from './LorebookEntryListItem';
import { RecursionMapModal } from './RecursionMapModal';
import {
  applyEntryFlagPatch,
  buildRecursionGraph,
  type RecursionEntryPatch,
} from './recursionGraph';
import { flushLorebookDraft } from './draftFlush';
import type { LorebookEditorProps } from './types';
import { FIELD_HELP } from './fieldHelp';
import { FieldInfoTip, FieldLabel } from './FieldInfoTip';
import {
  computeContextUsage,
  createBlankLorebookEntry,
  hasNonDefaultOptions,
  isEntryContextEnabled,
  nextAvailableEntryId,
  normalizeCharacterBook,
  sanitizeLorebookFilename,
} from './utils';

export type { LorebookEditorProps } from './types';

export function LorebookEditor(props: LorebookEditorProps): React.ReactElement {
  return <LorebookEditorInner {...props} />;
}

function LorebookEditorInner({
  lorebook,
  onChange,
  onDelete,
  setSelectedText,
  contextSectionIds,
  aiConfig,
  samplerSettings,
  promptSettings,
  promptModels,
  getContextContent,
  fontSize,
  onFontSizeChange,
  characterName,
  spellcheck,
  markdownImageOpenLinks,
  customContext,
  attachment,
}: LorebookEditorProps): React.ReactElement {
  const normalizedPropLorebook = useMemo(
    () => normalizeCharacterBook(lorebook),
    [lorebook],
  );

  const [draftLorebook, setDraftLorebook] = useState<CharacterBook>(normalizedPropLorebook);
  const [selectedEntryIndex, setSelectedEntryIndex] = useState(0);
  const [isBookSettingsOpen, setIsBookSettingsOpen] = useState(false);
  const [isMobileViewOpen, setIsMobileViewOpen] = useState(false);
  const [isRecursionMapOpen, setIsRecursionMapOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDraftLorebook(normalizedPropLorebook);
      setSelectedEntryIndex((prev) =>
        prev >= (normalizedPropLorebook.entries.length || 0) ? 0 : prev,
      );
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [normalizedPropLorebook]);

  const entries = draftLorebook.entries;
  const bookName = draftLorebook.name ?? '';
  const bookDescription = draftLorebook.description ?? '';
  const safeSelectedIndex = selectedEntryIndex < entries.length ? selectedEntryIndex : 0;
  const selectedEntry = entries[safeSelectedIndex];

  useEffect(() => {
    setIsOptionsOpen(false);
  }, [selectedEntry?.id]);

  const handleOpenRecursionMap = useCallback(() => {
    if (entries.length === 0) return;
    flushLorebookDraft();
    setIsRecursionMapOpen(true);
  }, [entries.length]);

  const handleCloseRecursionMap = useCallback(() => {
    setIsRecursionMapOpen(false);
  }, []);

  // If the book is emptied while the map is open, drop the open flag so it
  // does not reappear when the next entry is added.
  useEffect(() => {
    if (entries.length === 0) {
      setIsRecursionMapOpen(false);
    }
  }, [entries.length]);

  const showRecursionMap = isRecursionMapOpen && entries.length > 0;

  const buildUpdatedLorebook = useCallback(
    (
      newEntries: LorebookEntry[],
      newName: string,
      newDesc: string,
      extras?: Partial<Pick<CharacterBook, 'scan_depth' | 'token_budget' | 'recursive_scanning'>>,
    ): CharacterBook => ({
      name: newName,
      description: newDesc,
      scan_depth: extras?.scan_depth !== undefined ? extras.scan_depth : draftLorebook.scan_depth,
      token_budget:
        extras?.token_budget !== undefined ? extras.token_budget : draftLorebook.token_budget,
      recursive_scanning:
        extras?.recursive_scanning !== undefined
          ? extras.recursive_scanning
          : draftLorebook.recursive_scanning,
      entries: newEntries,
      extensions: draftLorebook.extensions || {},
    }),
    [
      draftLorebook.extensions,
      draftLorebook.scan_depth,
      draftLorebook.token_budget,
      draftLorebook.recursive_scanning,
    ],
  );

  const persistLorebook = useCallback(
    (updatedLorebook: CharacterBook) => {
      setDraftLorebook(updatedLorebook);
      onChange(updatedLorebook);
    },
    [onChange],
  );

  const handleEntryPersistUpdate = useCallback(
    (updatedEntry: LorebookEntry) => {
      const newEntries = [...entries];
      newEntries[safeSelectedIndex] = updatedEntry;
      persistLorebook(buildUpdatedLorebook(newEntries, bookName, bookDescription));
    },
    [entries, safeSelectedIndex, bookName, bookDescription, buildUpdatedLorebook, persistLorebook],
  );

  const handleAddEntry = useCallback(() => {
    const newEntry = createBlankLorebookEntry(nextAvailableEntryId(entries));
    const newEntries = [...entries, newEntry];
    persistLorebook(buildUpdatedLorebook(newEntries, bookName, bookDescription));
    setSelectedEntryIndex(newEntries.length - 1);
    setIsMobileViewOpen(true);
  }, [entries, bookName, bookDescription, buildUpdatedLorebook, persistLorebook]);

  const handleDeleteEntry = useCallback(
    (index: number) => {
      const entry = entries[index];
      const shouldDelete = window.confirm(
        `Delete lorebook entry "${entry.comment || entry.name || `Entry ${index}`}"?`,
      );
      if (!shouldDelete) return;

      const newEntries = entries.filter((_, i) => i !== index);
      persistLorebook(buildUpdatedLorebook(newEntries, bookName, bookDescription));

      if (selectedEntryIndex >= newEntries.length) {
        setSelectedEntryIndex(Math.max(0, newEntries.length - 1));
      } else if (selectedEntryIndex > index) {
        setSelectedEntryIndex(selectedEntryIndex - 1);
      }
    },
    [entries, selectedEntryIndex, bookName, bookDescription, buildUpdatedLorebook, persistLorebook],
  );

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const query = searchQuery.toLowerCase();
    return entries.filter(
      (entry) =>
        (entry.name?.toLowerCase() || '').includes(query) ||
        (entry.comment?.toLowerCase() || '').includes(query) ||
        (entry.content?.toLowerCase() || '').includes(query) ||
        entry.keys.some((key) => key.toLowerCase().includes(query)),
    );
  }, [entries, searchQuery]);

  const entryIndexById = useMemo(() => {
    const indexById = new Map<number, number>();
    entries.forEach((entry, index) => {
      indexById.set(entry.id, index);
    });
    return indexById;
  }, [entries]);

  const handleUpdateRecursionFlags = useCallback(
    (
      ids: number[],
      patch: Parameters<typeof applyEntryFlagPatch>[2],
    ) => {
      const newEntries = applyEntryFlagPatch(entries, ids, patch);
      persistLorebook(buildUpdatedLorebook(newEntries, bookName, bookDescription));
    },
        [entries, bookName, bookDescription, buildUpdatedLorebook, persistLorebook],
  );

  const handlePatchRecursionEntry = useCallback(
    (id: number, patch: RecursionEntryPatch) => {
      handleUpdateRecursionFlags([id], patch);
    },
    [handleUpdateRecursionFlags],
  );
  const selectedEntryTokenCount = useMemo(
    () => (selectedEntry ? estimateTokens(selectedEntry.content) : null),
    [selectedEntry],
  );

  const customContextTokens =
    customContext?.meta.enabled && customContext.meta.charLength > 0
      ? estimateCustomContextTokensFromCharLength(customContext.meta.charLength)
      : 0;

  const contextSummary = useMemo(
    () =>
      computeContextUsage(
        entries,
        draftLorebook.token_budget,
        samplerSettings.contextLength,
        customContextTokens,
      ),
    [entries, draftLorebook.token_budget, samplerSettings.contextLength, customContextTokens],
  );

  // Only build the full graph while the map is open; glance stats rebuild in detail.
  const recursionGraph = useMemo(
    () => (showRecursionMap ? buildRecursionGraph(entries) : null),
    [entries, showRecursionMap],
  );

  const handleEnableAllContext = useCallback(() => {
    const newEntries = entries.map((entry) => ({
      ...entry,
      extensions: { ...entry.extensions, context_enabled: true },
    }));
    persistLorebook(buildUpdatedLorebook(newEntries, bookName, bookDescription));
  }, [entries, bookName, bookDescription, buildUpdatedLorebook, persistLorebook]);

  const handleDisableAllContext = useCallback(() => {
    const newEntries = entries.map((entry) => ({
      ...entry,
      extensions: { ...entry.extensions, context_enabled: false },
    }));
    persistLorebook(buildUpdatedLorebook(newEntries, bookName, bookDescription));
  }, [entries, bookName, bookDescription, buildUpdatedLorebook, persistLorebook]);

  const handleDeleteLorebook = useCallback(() => {
    if (!onDelete) return;
    const entryCount = entries.length;
    const message =
      entryCount > 0
        ? `Delete this lorebook and all ${entryCount} entries? This cannot be undone.`
        : 'Delete this lorebook? This cannot be undone.';
    if (!window.confirm(message)) return;
    onDelete();
  }, [onDelete, entries.length]);

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text) as unknown;
        const importedBook = importLorebook(data);

        if (!importedBook) {
          alert(
            'Could not recognize the lorebook format. Please ensure it is a valid SillyTavern or CharacterVault export.',
          );
          return;
        }

        if (entries.length > 0) {
          const confirmed = window.confirm(
            `This will replace all ${entries.length} existing entries with ${importedBook.entries.length} imported entries. Continue?`,
          );
          if (!confirmed) return;
        }

        persistLorebook({
          name: importedBook.name || bookName,
          description: importedBook.description || bookDescription,
          scan_depth: importedBook.scan_depth,
          token_budget: importedBook.token_budget,
          recursive_scanning: importedBook.recursive_scanning,
          entries: importedBook.entries,
          extensions: importedBook.extensions || {},
        });
        setSelectedEntryIndex(0);
        alert(`Successfully imported ${importedBook.entries.length} entries.`);
      } catch (err) {
        console.error('Import error:', err);
        alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        e.target.value = '';
      }
    },
    [entries.length, bookName, bookDescription, persistLorebook],
  );

  const handleExport = useCallback(() => {
    if (entries.length === 0) return;

    const exportData = convertToSTLorebook(draftLorebook);
    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
    let url: string | null = null;

    try {
      url = URL.createObjectURL(blob);
      const name = bookName.trim() || `${characterName || 'character'}'s Lorebook`;
      const filename = sanitizeLorebookFilename(name, '.json');
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }, [draftLorebook, bookName, characterName, entries.length]);

  const usageColorClass =
    contextSummary.status === 'good'
      ? 'text-success'
      : contextSummary.status === 'warning'
        ? 'text-warning'
        : 'text-danger';
  const usageBarClass =
    contextSummary.status === 'good'
      ? 'bg-success'
      : contextSummary.status === 'warning'
        ? 'bg-yellow-500'
        : 'bg-danger';

  const editor = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
      <div
        className={`
          flex min-h-0 w-full flex-col overflow-hidden border-border bg-muted/40
          md:w-72 md:shrink-0 md:border-r
          ${isMobileViewOpen ? 'hidden md:flex' : 'flex flex-1 md:flex-none'}
        `}
      >
        <div className="shrink-0 border-b border-border">
          <div className="flex items-center gap-1.5 px-3 py-2">
            <button
              type="button"
              onClick={() => setIsBookSettingsOpen(!isBookSettingsOpen)}
              className="flex min-w-0 flex-1 items-center justify-between py-1 text-sm font-medium text-fg-muted transition-colors hover:text-fg touch-manipulation"
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface">
                  <Settings className="h-4 w-4" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-sm font-semibold text-fg">Lorebook</p>
                  <p className="text-xs font-normal text-fg-muted">
                    {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
                    {isBookSettingsOpen ? '' : ' · Settings'}
                  </p>
                </div>
              </div>
              {isBookSettingsOpen ? (
                <ChevronUp className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0" />
              )}
            </button>
            {attachment ? (
              <div className="shrink-0 md:hidden">
                <LorebookAttachmentButton />
              </div>
            ) : null}
          </div>

          {isBookSettingsOpen && (
            <div className="max-h-[min(40vh,16rem)] space-y-3 overflow-y-auto overscroll-contain px-3 pb-3 [-webkit-overflow-scrolling:touch]">
              <div>
                <label className="mb-1 block text-xs font-medium text-fg-muted">Book Name</label>
                <input
                  type="text"
                  value={bookName}
                  onChange={(e) =>
                    persistLorebook(buildUpdatedLorebook(entries, e.target.value, bookDescription))
                  }
                  placeholder="Character Lorebook"
                  className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-fg placeholder:text-fg-subtle outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-fg-muted">Description</label>
                <input
                  type="text"
                  value={bookDescription}
                  onChange={(e) =>
                    persistLorebook(buildUpdatedLorebook(entries, bookName, e.target.value))
                  }
                  placeholder="Brief description"
                  className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-fg placeholder:text-fg-subtle outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel
                    help={FIELD_HELP.scanDepth}
                    className="mb-1 flex items-center gap-1 text-xs font-medium normal-case tracking-normal text-fg-muted"
                  >
                    Scan Depth
                  </FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={draftLorebook.scan_depth ?? ''}
                    onChange={(e) => {
                      const num = parseInt(e.target.value, 10);
                      persistLorebook(
                        buildUpdatedLorebook(entries, bookName, bookDescription, {
                          scan_depth: Number.isNaN(num) ? undefined : num,
                        }),
                      );
                    }}
                    placeholder="-"
                    className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-fg placeholder:text-fg-subtle outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <FieldLabel
                    help={FIELD_HELP.tokenBudget}
                    className="mb-1 flex items-center gap-1 text-xs font-medium normal-case tracking-normal text-fg-muted"
                  >
                    Token Budget
                  </FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={draftLorebook.token_budget ?? ''}
                    onChange={(e) => {
                      const num = parseInt(e.target.value, 10);
                      persistLorebook(
                        buildUpdatedLorebook(entries, bookName, bookDescription, {
                          token_budget: Number.isNaN(num) ? undefined : num,
                        }),
                      );
                    }}
                    placeholder="-"
                    className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-fg placeholder:text-fg-subtle outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-fg-muted">
                  <input
                    type="checkbox"
                    checked={draftLorebook.recursive_scanning ?? false}
                    onChange={(e) =>
                      persistLorebook(
                        buildUpdatedLorebook(entries, bookName, bookDescription, {
                          recursive_scanning: e.target.checked,
                        }),
                      )
                    }
                    className="h-3.5 w-3.5 rounded border-border-strong text-accent focus:ring-accent"
                  />
                  Recursive scanning
                  <FieldInfoTip
                    text={FIELD_HELP.recursiveScanning}
                    label="About Recursive scanning"
                  />
                </label>
                {entries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleOpenRecursionMap()}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg touch-manipulation"
                    title="Open whole-book recursion map"
                  >
                    <GitFork className="h-3.5 w-3.5" />
                    Map
                  </button>
                )}
              </div>
              {onDelete && (
                <div className="border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={handleDeleteLorebook}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-danger/30 px-2.5 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger-soft touch-manipulation"
                    title="Delete the entire lorebook"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Lorebook
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {(entries.length > 0 || customContext) && (
          <div className="shrink-0 space-y-1.5 border-b border-border px-3 py-2">
            {entries.length > 0 && (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${entries.length} entries...`}
                    className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-7 text-xs text-fg placeholder:text-fg-subtle outline-none focus:ring-2 focus:ring-accent/20"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {searchQuery && (
                  <p className="text-[11px] text-fg-muted">
                    {filteredEntries.length} of {entries.length} entries
                  </p>
                )}
              </>
            )}
            <div className="space-y-1.5 rounded-lg border border-border/80 bg-surface/80 px-2.5 py-1.5">
              {entries.length > 0 && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                        AI context
                      </p>
                      <FieldInfoTip text={FIELD_HELP.aiContext} label="About AI context" />
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={handleEnableAllContext}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-fg-muted transition-colors hover:bg-hover hover:text-fg touch-manipulation"
                        title="Include all entries in AI context"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        All
                      </button>
                      <button
                        type="button"
                        onClick={handleDisableAllContext}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-fg-muted transition-colors hover:bg-hover hover:text-fg touch-manipulation"
                        title="Exclude all entries from AI context"
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        None
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-fg-muted">
                        {contextSummary.included} of {entries.length} entries
                        {customContextTokens > 0 ? ' + custom' : ''}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-medium tabular-nums ${usageColorClass}`}>
                          {contextSummary.tokens.toLocaleString()} /{' '}
                          {contextSummary.limit.toLocaleString()}
                        </span>
                        <FieldInfoTip
                          side="left"
                          label="About token usage"
                          text={`Token estimate uses bytes ÷ ${BYTES_PER_TOKEN} (rounded up) for included entries${customContext ? ' and custom context' : ''}. Limit uses the book token budget when set, otherwise sampler context length.`}
                        />
                        {contextSummary.status === 'danger' && (
                          <span className="flex items-center text-danger" title="Near or over limit">
                            <AlertCircle className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-hover">
                      <div
                        className={`h-full transition-all duration-300 ${usageBarClass}`}
                        style={{ width: `${contextSummary.percentage}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
              {customContext && (
                <div className={entries.length > 0 ? 'border-t border-border/60 pt-1.5' : ''}>
                  <CustomContextBlock
                    key={customContext.ownerId}
                    ownerId={customContext.ownerId}
                    owner="lorebook"
                    meta={customContext.meta}
                    contextLength={contextSummary.limit}
                    onSetEnabled={customContext.onSetEnabled}
                    onSave={customContext.onSave}
                    onClear={customContext.onClear}
                    density="compact"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2.5">
          {entries.length === 0 ? (
            <div className="flex h-full min-h-40 flex-col items-center justify-center px-4 py-10 text-center text-fg-subtle">
              <Book className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm font-medium text-fg-muted">No entries yet</p>
              <p className="mt-1 text-xs">Add lore entries to build this book.</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex h-full min-h-32 flex-col items-center justify-center px-4 py-10 text-center text-fg-subtle">
              <Search className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm font-medium text-fg-muted">No entries match</p>
              <p className="mt-1 text-xs">Try a different search term.</p>
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const originalIndex = entryIndexById.get(entry.id) ?? 0;
              return (
                <MemoizedLorebookEntryListItem
                  key={entry.id}
                  entry={entry}
                  index={originalIndex}
                  tokenCount={originalIndex === safeSelectedIndex ? selectedEntryTokenCount : null}
                  isSelected={originalIndex === safeSelectedIndex}
                  isContextEnabled={isEntryContextEnabled(entry)}
                  onSelect={() => {
                    setSelectedEntryIndex(originalIndex);
                    setIsMobileViewOpen(true);
                  }}
                  onDelete={() => handleDeleteEntry(originalIndex)}
                  onToggleContext={() => {
                    const updatedEntry = {
                      ...entry,
                      extensions: {
                        ...entry.extensions,
                        context_enabled: !isEntryContextEnabled(entry),
                      },
                    };
                    const newEntries = [...entries];
                    newEntries[originalIndex] = updatedEntry;
                    persistLorebook(buildUpdatedLorebook(newEntries, bookName, bookDescription));
                  }}
                />
              );
            })
          )}
        </div>

        <div className="shrink-0 border-t border-border p-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => void handleImportFile(e)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg touch-manipulation"
              title="Import lorebook from JSON file"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={entries.length === 0}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
              title="Export lorebook to JSON file"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              type="button"
              onClick={handleAddEntry}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-surface px-2.5 py-2 text-sm font-medium text-fg-muted transition-colors hover:border-accent/50 hover:bg-accent-soft hover:text-accent touch-manipulation"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Entry</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        </div>
      </div>

      <div
        className={`
          min-h-0 min-w-0 flex-1 overflow-hidden bg-surface
          ${!isMobileViewOpen ? 'hidden md:flex md:flex-col' : 'flex flex-col'}
        `}
      >
        {selectedEntry ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="mb-0 flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4 md:px-6">
              <button
                type="button"
                onClick={() => setIsMobileViewOpen(false)}
                className="inline-flex items-center justify-center rounded-lg p-2 text-fg-muted transition-colors hover:bg-hover hover:text-fg md:hidden touch-manipulation"
                aria-label="Back to entry list"
                title="Back to entry list"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1 md:block">
                <input
                  type="text"
                  value={selectedEntry.comment || ''}
                  onChange={(e) =>
                    handleEntryPersistUpdate({ ...selectedEntry, comment: e.target.value })
                  }
                  placeholder={selectedEntry.name || `Entry ${safeSelectedIndex}`}
                  aria-label="Entry title"
                  className="w-full min-w-0 truncate bg-transparent text-sm font-semibold text-fg outline-none placeholder:text-fg-subtle focus:ring-0"
                />
                {selectedEntryTokenCount !== null && (
                  <p className="text-xs text-fg-muted">
                    {selectedEntryTokenCount.toLocaleString()} tokens
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1 md:gap-1.5">
                {attachment ? <LorebookAttachmentButton /> : null}
                <button
                  type="button"
                  onClick={() => setIsOptionsOpen((open) => !open)}
                  className={`inline-flex items-center justify-center gap-0 rounded-lg border p-2 text-xs font-medium transition-colors touch-manipulation md:gap-1.5 md:px-2.5 md:py-1.5 ${
                    isOptionsOpen
                      ? 'border-accent bg-accent text-accent-fg'
                      : 'border-border text-fg-muted hover:bg-hover hover:text-fg'
                  }`}
                  aria-expanded={isOptionsOpen}
                  aria-controls="lorebook-entry-options"
                  aria-label="Entry options"
                  title="Entry options"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Options</span>
                  {!isOptionsOpen && hasNonDefaultOptions(selectedEntry) ? (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-accent"
                      aria-label="Non-default options"
                    />
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteEntry(safeSelectedIndex)}
                  className="inline-flex shrink-0 items-center justify-center gap-0 rounded-lg border p-2 text-xs font-medium text-fg-muted transition-colors hover:border-danger/40 hover:bg-danger-soft hover:text-danger touch-manipulation md:gap-1.5 md:px-2.5 md:py-1.5"
                  aria-label="Delete entry"
                  title="Delete entry"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Delete</span>
                </button>
              </div>
            </div>
            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-3 py-2 sm:px-4 md:px-6 md:py-3">
              <LorebookEntryDetail
                key={selectedEntry.id}
                entry={selectedEntry}
                allEntries={entries}
                onPersistUpdate={handleEntryPersistUpdate}
                onOpenRecursionMap={() => handleOpenRecursionMap()}
                aiConfig={aiConfig}
                samplerSettings={samplerSettings}
                promptSettings={promptSettings}
                promptModels={promptModels}
                getContextContent={getContextContent}
                contextSectionIds={contextSectionIds}
                setSelectedText={setSelectedText}
                fontSize={fontSize}
                onFontSizeChange={onFontSizeChange}
                spellcheck={spellcheck}
                markdownImageOpenLinks={markdownImageOpenLinks}
                isOptionsOpen={isOptionsOpen}
                onOptionsOpenChange={setIsOptionsOpen}
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            {attachment ? (
              <div className="flex shrink-0 justify-end border-b border-border px-3 py-2.5 sm:px-4 md:px-6">
                <LorebookAttachmentButton />
              </div>
            ) : null}
            <div className="flex min-h-0 flex-1 items-center justify-center text-fg-subtle">
              <div className="px-6 text-center">
                <Book className="mx-auto mb-3 h-12 w-12 opacity-40" />
                <p className="text-sm font-medium text-fg-muted">Select an entry to edit</p>
                <p className="mt-1 text-xs">Or create a new one to get started</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {showRecursionMap && recursionGraph && (
        <RecursionMapModal
          focusEntry={selectedEntry ?? null}
          entries={entries}
          graph={recursionGraph}
          bookRecursiveScanning={draftLorebook.recursive_scanning}
          onClose={handleCloseRecursionMap}
          onUpdateEntries={handleUpdateRecursionFlags}
          onPatchEntry={handlePatchRecursionEntry}
        />
      )}
    </div>
  );

  if (!attachment) return editor;

  return (
    <LorebookAttachmentProvider
      characterId={attachment.characterId}
      embeddedBook={attachment.embeddedBook}
      characterName={attachment.characterName}
      onCopyIntoEmbedded={attachment.onCopyIntoEmbedded}
      closeSignal={isOptionsOpen}
      onMenuOpen={() => setIsOptionsOpen(false)}
    >
      {editor}
    </LorebookAttachmentProvider>
  );
}

export default LorebookEditor;
