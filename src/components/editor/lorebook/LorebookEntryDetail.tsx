import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitFork, Sparkles, Square, X } from 'lucide-react';
import { AIService } from '../../../services/AIService';
import { resolveConfigForOperation } from '../../../services/resolveOperationConfig';
import { useAIEditor } from '../../../hooks';
import type {
  LorebookDepthRole,
  LorebookEntry,
  LorebookPosition,
  LorebookSelectiveLogic,
} from '../../../db/characterTypes';
import {
  DEPTH_ROLE_OPTIONS,
  FIELD_CLASS,
  POSITION_OPTIONS,
  SELECTIVE_LOGIC_OPTIONS,
} from './constants';
import { FIELD_HELP } from './fieldHelp';
import { FieldInfoTip, FieldLabel } from './FieldInfoTip';
import {
  buildRecursionGraph,
  getEgoStats,
  mergeEntryDraft,
} from './recursionGraph';
import type { LorebookEntryDetailProps } from './types';
import { registerLorebookDraftFlush } from './draftFlush';
import { ToggleChip } from './ToggleChip';

export function LorebookEntryDetail({
  entry,
  allEntries,
  onPersistUpdate,
  onOpenRecursionMap,
  aiConfig,
  samplerSettings,
  promptSettings,
  promptModels,
  getContextContent,
  contextSectionIds,
  setSelectedText,
  fontSize,
  onFontSizeChange,
  spellcheck,
  markdownImageOpenLinks,
  isOptionsOpen,
  onOptionsOpenChange,
}: LorebookEntryDetailProps): React.ReactElement {
  const [draftEntry, setDraftEntry] = useState(entry);
  const draftEntryRef = useRef(entry);
  draftEntryRef.current = draftEntry;

  const { editorRef, payloadPreviewModal, flushPendingPersist } = useAIEditor({
    key: String(entry.id),
    value: draftEntry.content,
    onImmediateChange: (value) => {
      setDraftEntry((prev) => {
        const next = { ...prev, content: value };
        draftEntryRef.current = next;
        return next;
      });
    },
    onPersistChange: (value) => {
      const updatedEntry = { ...draftEntryRef.current, content: value };
      draftEntryRef.current = updatedEntry;
      setDraftEntry(updatedEntry);
      onPersistUpdate(updatedEntry);
    },
    saveMode: 'debounced',
    saveDebounceMs: 250,
    setSelectedText,
    aiConfig,
    samplerSettings,
    promptSettings,
    promptModels,
    getContextContent,
    contextSectionIds,
    minHeight: '100%',
    maxHeight: '100%',
    isActive: true,
    fontSize,
    onFontSizeChange,
    spellcheck,
    markdownImageOpenLinks,
  });

  useEffect(() => registerLorebookDraftFlush(flushPendingPersist), [flushPendingPersist]);

  const [keysInput, setKeysInput] = React.useState(entry.keys.join(', '));
  const [secondaryKeysInput, setSecondaryKeysInput] = React.useState(
    (entry.secondary_keys || []).join(', '),
  );
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const aiServiceRef = useRef<AIService | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const keyGenGenerationRef = useRef(0);

  const clearKeyGenTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  /** Abort network work and invalidate in-flight handlers (no setState). */
  const tearDownKeyGeneration = () => {
    keyGenGenerationRef.current += 1;
    clearKeyGenTimeout();
    aiServiceRef.current?.abort();
    aiServiceRef.current = null;
  };

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      tearDownKeyGeneration();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only teardown
  }, []);

  React.useEffect(() => {
    // Only cancel AI when switching entries: prop identity changes on every
    // parent persist (including content debounce) and must not abort mid-gen.
    tearDownKeyGeneration();
    if (isMountedRef.current) {
      setGeneratingKeys(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- id-only abort
  }, [entry.id]);

  React.useEffect(() => {
    draftEntryRef.current = entry;
    setDraftEntry(entry);
    setKeysInput(entry.keys.join(', '));
    setSecondaryKeysInput((entry.secondary_keys || []).join(', '));
  }, [entry]);

  React.useEffect(() => {
    const newKeysString = draftEntry.keys.join(', ');
    setKeysInput((prev) => (prev !== newKeysString ? newKeysString : prev));
  }, [draftEntry.keys]);

  React.useEffect(() => {
    const next = (draftEntry.secondary_keys || []).join(', ');
    setSecondaryKeysInput((prev) => (prev !== next ? next : prev));
  }, [draftEntry.secondary_keys]);

  // Glance stats only while Options is open (avoids O(n²) rebuilds on every
  // keystroke when the panel is collapsed).
  const entriesForGraph = useMemo(
    () => (isOptionsOpen ? mergeEntryDraft(allEntries, draftEntry) : null),
    [allEntries, draftEntry, isOptionsOpen],
  );
  const recursionGraph = useMemo(
    () => (entriesForGraph ? buildRecursionGraph(entriesForGraph) : null),
    [entriesForGraph],
  );
  const egoStats = useMemo(
    () =>
      recursionGraph
        ? getEgoStats(recursionGraph, draftEntry.id)
        : { triggers: 0, triggeredBy: 0 },
    [recursionGraph, draftEntry.id],
  );

  useEffect(() => {
    if (!isOptionsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOptionsOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOptionsOpen, onOptionsOpenChange]);

  const handleAbortGeneration = () => {
    tearDownKeyGeneration();
    if (isMountedRef.current) {
      setGeneratingKeys(false);
    }
  };

  const handleGenerateKeys = async () => {
    if (generatingKeys) {
      handleAbortGeneration();
      return;
    }
    if (!draftEntry.content.trim()) return;

    const generation = ++keyGenGenerationRef.current;
    const isCurrent = () =>
      isMountedRef.current && generation === keyGenGenerationRef.current;

    setGeneratingKeys(true);
    const contentSnapshot = draftEntry.content;
    const effectiveConfig = resolveConfigForOperation(aiConfig, 'instruct', promptModels);
    aiServiceRef.current = new AIService(effectiveConfig, samplerSettings, promptSettings);

    timeoutRef.current = setTimeout(() => {
      if (generation === keyGenGenerationRef.current) {
        handleAbortGeneration();
      }
    }, 15000);

    try {
      let context = await Promise.resolve(getContextContent(contextSectionIds));
      let result;
      try {
        const service = aiServiceRef.current;
        if (!service || !isCurrent()) return;
        result = await service.instructText(
          contentSnapshot,
          'Generate 2-5 comma-separated trigger keywords/keys that would cause this lorebook entry to activate. Output ONLY the comma-separated keywords, nothing else.',
          context,
        );
      } finally {
        context = [];
      }

      if (!isCurrent()) return;

      clearKeyGenTimeout();

      const parsedKeys = result.content
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k);
      if (parsedKeys.length > 0) {
        // Merge into latest draft so concurrent field edits are not clobbered.
        const prev = draftEntryRef.current;
        const mergedKeys = [...prev.keys];
        for (const key of parsedKeys) {
          if (!mergedKeys.some((k) => k.toLowerCase() === key.toLowerCase())) {
            mergedKeys.push(key);
          }
        }
        const updatedEntry = { ...prev, keys: mergedKeys };
        draftEntryRef.current = updatedEntry;
        setKeysInput(mergedKeys.join(', '));
        setDraftEntry(updatedEntry);
        onPersistUpdate(updatedEntry);
      }
    } catch {
      // Silent fail or aborted
    } finally {
      if (generation === keyGenGenerationRef.current) {
        aiServiceRef.current = null;
        clearKeyGenTimeout();
      }
      if (isCurrent()) {
        setGeneratingKeys(false);
      }
    }
  };

  const handleNameChange = (value: string) => {
    const updatedEntry = { ...draftEntry, name: value };
    setDraftEntry(updatedEntry);
    onPersistUpdate(updatedEntry);
  };
  const handleKeysBlur = () => {
    const parsedKeys = keysInput
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k);
    const updatedEntry = { ...draftEntry, keys: parsedKeys };
    setDraftEntry(updatedEntry);
    onPersistUpdate(updatedEntry);
  };
  const handleSecondaryKeysBlur = () => {
    const parsedKeys = secondaryKeysInput
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k);
    const updatedEntry = { ...draftEntry, secondary_keys: parsedKeys };
    setDraftEntry(updatedEntry);
    onPersistUpdate(updatedEntry);
  };
  const handlePriorityChange = (value: string) => {
    const num = parseInt(value, 10);
    const updatedEntry = { ...draftEntry, priority: Number.isNaN(num) ? 0 : num };
    setDraftEntry(updatedEntry);
    onPersistUpdate(updatedEntry);
  };
  const handlePositionChange = (value: LorebookPosition) => {
    const restExt = { ...(draftEntry.extensions || {}) };
    delete restExt._st_position;
    const updatedEntry: LorebookEntry = {
      ...draftEntry,
      position: value,
      extensions: restExt,
      depth: value === 'at_depth' ? (draftEntry.depth ?? 4) : draftEntry.depth,
      role: value === 'at_depth' ? (draftEntry.role ?? 0) : draftEntry.role,
    };
    setDraftEntry(updatedEntry);
    onPersistUpdate(updatedEntry);
  };
  const persistPatch = (patch: Partial<LorebookEntry>) => {
    const updatedEntry = { ...draftEntry, ...patch };
    setDraftEntry(updatedEntry);
    onPersistUpdate(updatedEntry);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <FieldLabel
            help={FIELD_HELP.primaryKeys}
            className="mb-0 hidden shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-wider text-fg-subtle sm:flex"
          >
            Keys
          </FieldLabel>
          <input
            type="text"
            value={keysInput}
            onChange={(e) => setKeysInput(e.target.value)}
            onBlur={handleKeysBlur}
            placeholder="Primary keys, comma separated"
            aria-label="Primary keys"
            className={FIELD_CLASS}
          />
          <button
            type="button"
            onClick={() => void handleGenerateKeys()}
            disabled={!generatingKeys && !draftEntry.content.trim()}
            title={generatingKeys ? 'Stop generation' : 'Generate trigger keys with AI'}
            className={`shrink-0 rounded-lg p-2 transition-colors touch-manipulation ${
              generatingKeys
                ? 'animate-pulse text-danger hover:bg-danger-soft'
                : 'text-fg-subtle hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40'
            }`}
          >
            {generatingKeys ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ToggleChip
            pressed={draftEntry.enabled}
            onPressedChange={(next) => persistPatch({ enabled: next })}
          >
            Enabled
          </ToggleChip>
          <FieldInfoTip text={FIELD_HELP.enabled} label="About Enabled" />
          <ToggleChip
            pressed={draftEntry.constant ?? false}
            onPressedChange={(next) => persistPatch({ constant: next })}
          >
            Constant
          </ToggleChip>
          <FieldInfoTip text={FIELD_HELP.constant} label="About Constant" />
        </div>
      </div>

      <div className="relative mt-2 flex min-h-0 flex-1 flex-col">
        <div
          ref={editorRef}
          className="relative z-0 min-h-0 w-full flex-1 overflow-hidden rounded-xl border border-border bg-bg shadow-inner"
        />

        {isOptionsOpen && (
          <div
            id="lorebook-entry-options"
            role="dialog"
            aria-label="Entry options"
            className="absolute inset-0 z-30 flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
              <p className="text-sm font-semibold text-fg">Entry options</p>
              <button
                type="button"
                onClick={() => onOptionsOpenChange(false)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg touch-manipulation"
              >
                <X className="h-3.5 w-3.5" />
                Done
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 [-webkit-overflow-scrolling:touch]">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <FieldLabel
                help={FIELD_HELP.secondaryKeys}
                className="mb-0 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-fg-subtle"
              >
                Secondary Keys
              </FieldLabel>
              <ToggleChip
                pressed={draftEntry.selective ?? false}
                onPressedChange={(next) => persistPatch({ selective: next })}
              >
                Selective
              </ToggleChip>
              <FieldInfoTip text={FIELD_HELP.selective} label="About Selective" />
              {(draftEntry.selective ?? false) && (
                <>
                  <select
                    value={draftEntry.selectiveLogic ?? 0}
                    onChange={(e) =>
                      persistPatch({
                        selectiveLogic: Number(e.target.value) as LorebookSelectiveLogic,
                      })
                    }
                    className="rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-fg outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    {SELECTIVE_LOGIC_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <FieldInfoTip
                    text={
                      FIELD_HELP.selectiveLogic[
                        (draftEntry.selectiveLogic ?? 0) as 0 | 1 | 2 | 3
                      ]
                    }
                    label="About selective logic"
                  />
                </>
              )}
            </div>
            <input
              type="text"
              value={secondaryKeysInput}
              onChange={(e) => setSecondaryKeysInput(e.target.value)}
              onBlur={handleSecondaryKeysBlur}
              placeholder="optional filter keys"
              disabled={!(draftEntry.selective ?? false)}
              className={`${FIELD_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel help={FIELD_HELP.insertionOrder}>Insertion Order</FieldLabel>
              <input
                type="number"
                value={draftEntry.priority ?? 0}
                onChange={(e) => handlePriorityChange(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <FieldLabel help={FIELD_HELP.position}>Position</FieldLabel>
              <select
                value={draftEntry.position || 'before_char'}
                onChange={(e) => handlePositionChange(e.target.value as LorebookPosition)}
                className={FIELD_CLASS}
              >
                {POSITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(draftEntry.position || 'before_char') === 'at_depth' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel help={FIELD_HELP.depth}>Depth</FieldLabel>
                <input
                  type="number"
                  min={0}
                  value={draftEntry.depth ?? 4}
                  onChange={(e) => {
                    const num = parseInt(e.target.value, 10);
                    persistPatch({ depth: Number.isNaN(num) ? 0 : num });
                  }}
                  className={FIELD_CLASS}
                />
              </div>
              <div>
                <FieldLabel help={FIELD_HELP.role}>Role</FieldLabel>
                <select
                  value={draftEntry.role ?? 0}
                  onChange={(e) =>
                    persistPatch({ role: Number(e.target.value) as LorebookDepthRole })
                  }
                  className={FIELD_CLASS}
                >
                  {DEPTH_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              Matching
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <ToggleChip
                pressed={draftEntry.case_sensitive ?? false}
                onPressedChange={(next) => persistPatch({ case_sensitive: next })}
              >
                Case sensitive
              </ToggleChip>
              <FieldInfoTip text={FIELD_HELP.caseSensitive} label="About Case Sensitive" />
              <ToggleChip
                pressed={draftEntry.matchWholeWords ?? false}
                onPressedChange={(next) => persistPatch({ matchWholeWords: next })}
              >
                Match whole words
              </ToggleChip>
              <FieldInfoTip text={FIELD_HELP.matchWholeWords} label="About Match Whole Words" />
            </div>
          </div>

          <div>
            <FieldLabel help={FIELD_HELP.probability}>Probability %</FieldLabel>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={100}
                value={draftEntry.probability ?? 100}
                onChange={(e) => {
                  const num = parseInt(e.target.value, 10);
                  const probability = Number.isNaN(num)
                    ? 100
                    : Math.min(100, Math.max(0, num));
                  persistPatch({
                    probability,
                    useProbability:
                      probability < 100 ? true : (draftEntry.useProbability ?? false),
                  });
                }}
                className={FIELD_CLASS}
              />
              <ToggleChip
                pressed={draftEntry.useProbability ?? (draftEntry.probability ?? 100) < 100}
                onPressedChange={(next) => persistPatch({ useProbability: next })}
              >
                Use %
              </ToggleChip>
              <FieldInfoTip text={FIELD_HELP.useProbability} label="About Use %" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                Recursion
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] tabular-nums text-fg-muted">
                  {egoStats.triggers === 0 && egoStats.triggeredBy === 0 ? (
                    'No recursion links'
                  ) : (
                    <>
                      Triggers {egoStats.triggers}
                      <span className="text-fg-subtle"> · </span>
                      Triggered by {egoStats.triggeredBy}
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={onOpenRecursionMap}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg touch-manipulation"
                  title="Open recursion map"
                >
                  <GitFork className="h-3.5 w-3.5" />
                  Map
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <ToggleChip
                pressed={draftEntry.excludeRecursion ?? false}
                onPressedChange={(next) => persistPatch({ excludeRecursion: next })}
              >
                Non-recursable
              </ToggleChip>
              <FieldInfoTip text={FIELD_HELP.excludeRecursion} label="About Non-recursable" />
              <ToggleChip
                pressed={draftEntry.preventRecursion ?? false}
                onPressedChange={(next) => persistPatch({ preventRecursion: next })}
              >
                Prevent further
              </ToggleChip>
              <FieldInfoTip
                text={FIELD_HELP.preventRecursion}
                label="About Prevent further recursion"
              />
              <ToggleChip
                pressed={draftEntry.delayUntilRecursion ?? false}
                onPressedChange={(next) => persistPatch({ delayUntilRecursion: next })}
              >
                Delay until recursion
              </ToggleChip>
              <FieldInfoTip
                text={FIELD_HELP.delayUntilRecursion}
                label="About Delay until recursion"
              />
            </div>
          </div>

          <div>
            <FieldLabel help={FIELD_HELP.internalNotes}>Internal notes</FieldLabel>
            <input
              type="text"
              value={draftEntry.name || ''}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Optional notes (not used in output)"
              className={FIELD_CLASS}
            />
          </div>
            </div>
          </div>
        )}
      </div>

      {payloadPreviewModal}
    </div>
  );
}
