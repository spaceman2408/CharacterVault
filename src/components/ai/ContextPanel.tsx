/**
 * @fileoverview Context Panel — user-driven AI context section selection.
 * @module components/ai/ContextPanel
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Search,
  BookOpen,
  Sparkles,
  X,
  AlertCircle,
  Info,
  Check,
  Plus,
} from 'lucide-react';
import { useCharacterEditorContext } from '../../context';
import { CHARACTER_SECTIONS } from '../../db/characterTypes';
import type { CharacterSection, SectionMeta } from '../../db/characterTypes';
import { estimateTokens, BYTES_PER_TOKEN } from '../../services/AIService';
import { estimateCustomContextTokensFromCharLength } from '../../services/CustomContextService';
import { CustomContextBlock } from './CustomContextBlock';

const EXCLUDED_CONTEXT_SECTIONS = new Set([
  'image',
  'extensions',
  'avatar',
  'character_version',
  'tags',
]);

export interface ContextPanelProps {
  /** Callback to close panel (for mobile) */
  onClose?: () => void;
  /** Whether this is mobile view (shows close button) */
  isMobile?: boolean;
  /** Agent reads the card via tools; hide section pins and keep custom context. */
  agentMode?: boolean;
}

/**
 * Context Panel — docked left panel for choosing which card sections go to AI.
 */
export function ContextPanel({
  onClose,
  isMobile = false,
  agentMode = false,
}: ContextPanelProps): React.ReactElement {
  const {
    currentCharacter,
    activeSection,
    contextSectionIds,
    setContextSectionIds,
    addContextSection,
    removeContextSection,
    customContextMeta,
    setCustomContextEnabled,
    saveCustomContext,
    clearCustomContext,
    samplerSettings,
    visibleSections,
    sectionOrder,
  } = useCharacterEditorContext();

  const currentCharacterData = currentCharacter?.data ?? null;
  const hasCurrentCharacter = currentCharacterData !== null;
  const currentCharacterId = currentCharacter?.id ?? null;
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const clearSearch = useCallback(() => setSearchQuery(''), []);

  const contextLimit = samplerSettings.contextLength;
  const hasLorebook = !!currentCharacterData?.characterBook;

  const isSectionEligible = useCallback(
    (section: SectionMeta): boolean => {
      if (EXCLUDED_CONTEXT_SECTIONS.has(section.id)) return false;
      if (section.id === 'lorebook' && !hasLorebook) return false;
      return true;
    },
    [hasLorebook]
  );

  /** All sections the user can pin (respects visibility + exclusions) */
  const eligibleSections = useMemo(() => {
    return visibleSections.filter(isSectionEligible);
  }, [visibleSections, isSectionEligible]);

  /** Selected sections ordered by sectionOrder */
  const contextSections = useMemo(() => {
    const selected = new Set(contextSectionIds);
    const ordered = sectionOrder
      .filter(id => selected.has(id))
      .map(id => CHARACTER_SECTIONS.find(s => s.id === id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined);
    ordered.forEach(s => selected.delete(s.id));
    selected.forEach(id => {
      const meta = CHARACTER_SECTIONS.find(s => s.id === id);
      if (meta) ordered.push(meta);
    });
    return ordered;
  }, [contextSectionIds, sectionOrder]);

  const selectedIdSet = useMemo(() => new Set(contextSectionIds), [contextSectionIds]);

  /** Searchable list: all eligible sections (selected stay visible for toggle-off) */
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return eligibleSections;
    const query = searchQuery.toLowerCase();
    return eligibleSections.filter(
      section =>
        section.label.toLowerCase().includes(query) ||
        section.description.toLowerCase().includes(query)
    );
  }, [eligibleSections, searchQuery]);

  const activeSectionMeta = useMemo(
    () => CHARACTER_SECTIONS.find(s => s.id === activeSection),
    [activeSection]
  );

  const canIncludeActive =
    !!activeSectionMeta &&
    isSectionEligible(activeSectionMeta) &&
    !selectedIdSet.has(activeSection) &&
    eligibleSections.some(s => s.id === activeSection);

  const hasCustomContext = customContextMeta.charLength > 0;
  const customContextEnabled = customContextMeta.enabled && hasCustomContext;
  const customContextTokens = useMemo(() => {
    if (!customContextEnabled) return 0;
    return estimateCustomContextTokensFromCharLength(customContextMeta.charLength);
  }, [customContextEnabled, customContextMeta.charLength]);

  const calculateTokenCount = useCallback((): number => {
    if (!currentCharacterData) return 0;

    let totalTokens = customContextTokens;
    if (agentMode) return totalTokens;

    contextSectionIds.forEach(sectionId => {
      const spec = currentCharacterData.spec;
      switch (sectionId) {
        case 'name':
          totalTokens += estimateTokens(spec.name);
          break;
        case 'description':
          totalTokens += estimateTokens(spec.description);
          break;
        case 'personality':
          totalTokens += estimateTokens(spec.personality);
          break;
        case 'scenario':
          totalTokens += estimateTokens(spec.scenario);
          break;
        case 'first_mes':
          totalTokens += estimateTokens(spec.first_mes);
          break;
        case 'mes_example':
          totalTokens += estimateTokens(spec.mes_example);
          break;
        case 'system_prompt':
          totalTokens += estimateTokens(spec.system_prompt);
          break;
        case 'post_history_instructions':
          totalTokens += estimateTokens(spec.post_history_instructions);
          break;
        case 'alternate_greetings':
          totalTokens += estimateTokens(spec.alternate_greetings.join('\n---\n'));
          break;
        case 'physical_description':
          totalTokens += estimateTokens(spec.physical_description);
          break;
        case 'creator':
          if (spec.creator) totalTokens += estimateTokens(spec.creator);
          break;
        case 'creator_notes':
          if (spec.creator_notes) totalTokens += estimateTokens(spec.creator_notes);
          break;
        case 'lorebook': {
          const book = currentCharacterData.characterBook;
          if (book) {
            if (book.name) totalTokens += estimateTokens(book.name);
            if (book.description) totalTokens += estimateTokens(book.description);
            book.entries.forEach(entry => {
              if (entry.enabled && entry.extensions?.context_enabled !== false) {
                totalTokens += estimateTokens(entry.content);
                totalTokens += estimateTokens(entry.keys.join(','));
                if (entry.name) totalTokens += estimateTokens(entry.name);
                if (entry.comment) totalTokens += estimateTokens(entry.comment);
              }
            });
          }
          break;
        }
      }
    });

    return totalTokens;
  }, [agentMode, currentCharacterData, contextSectionIds, customContextTokens]);

  const usageData = useMemo(() => {
    const tokenCount = calculateTokenCount();
    const percentage = Math.min(100, (tokenCount / contextLimit) * 100);

    let status: 'good' | 'warning' | 'danger' = 'good';
    if (percentage > 80) {
      status = 'danger';
    } else if (percentage > 50) {
      status = 'warning';
    }

    return { tokenCount, percentage, status };
  }, [calculateTokenCount, contextLimit]);

  const toggleSection = useCallback(
    (sectionId: CharacterSection) => {
      if (selectedIdSet.has(sectionId)) {
        removeContextSection(sectionId);
      } else {
        addContextSection(sectionId);
      }
    },
    [selectedIdSet, addContextSection, removeContextSection]
  );

  const handleClearAll = useCallback(() => {
    setContextSectionIds([]);
  }, [setContextSectionIds]);

  if (!hasCurrentCharacter) return <></>;

  const usageColorClass =
    usageData.status === 'good'
      ? 'text-success'
      : usageData.status === 'warning'
        ? 'text-warning'
        : 'text-danger';

  const usageBarClass =
    usageData.status === 'good'
      ? 'bg-success'
      : usageData.status === 'warning'
        ? 'bg-yellow-500'
        : 'bg-danger';

  return (
    <div className="h-full flex flex-col bg-bg border-r border-border animate-fade-in-slow">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-fg-muted shrink-0" />
          <h2 className="font-semibold text-fg truncate">AI Context</h2>
          {((!agentMode && contextSections.length > 0) || customContextEnabled) && (
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-accent-soft text-accent shrink-0">
              {(agentMode ? 0 : contextSections.length) + (customContextEnabled ? 1 : 0)}
            </span>
          )}
        </div>
        {isMobile && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-fg-muted hover:text-accent hover:bg-accent-soft rounded-lg transition-colors shrink-0"
            title="Close Context Panel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Compact usage meter */}
      <div className="px-4 py-2.5 border-b border-border shrink-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-fg-muted">{agentMode ? 'Custom' : 'Usage'}</span>
          <div className="flex items-center gap-1.5">
            <span className={`font-medium tabular-nums ${usageColorClass}`}>
              {usageData.tokenCount.toLocaleString()} / {contextLimit.toLocaleString()}
            </span>
            <div className="group relative">
              <Info className="w-3.5 h-3.5 text-fg-subtle cursor-help" />
              <div className="absolute top-full right-0 mt-2 w-56 p-2 bg-surface text-fg text-xs rounded-lg border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-lg">
                <p className="font-medium mb-1">Token estimate</p>
                <p>Text size in bytes ÷ {BYTES_PER_TOKEN} (rounded up).</p>
                <p className="text-fg-subtle mt-1">Actual counts vary by model.</p>
              </div>
            </div>
            {usageData.status === 'danger' && (
              <span className="flex items-center gap-0.5 text-danger" title="Over limit">
                <AlertCircle className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </div>
        <div className="h-1.5 bg-hover rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${usageBarClass}`}
            style={{ width: `${usageData.percentage}%` }}
          />
        </div>
      </div>

      {/* Custom context (vault-local, per character) */}
      {currentCharacterId && (
        <div className="px-4 py-3 border-b border-border shrink-0">
          <CustomContextBlock
            key={currentCharacterId}
            ownerId={currentCharacterId}
            owner="character"
            meta={customContextMeta}
            contextLength={contextLimit}
            onSetEnabled={setCustomContextEnabled}
            onSave={saveCustomContext}
            onClear={clearCustomContext}
          />
        </div>
      )}

      {agentMode ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-3 text-xs leading-relaxed text-fg-muted">
            The agent reads this card itself. Section pins are for Orion and the
            AI toolbar. They come back when you switch off Agent.
          </div>
        </div>
      ) : (
        <>
      <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-fg-muted uppercase tracking-wide">
            Selected
          </span>
          {contextSections.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-fg-subtle hover:text-accent transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {contextSections.length === 0 && !canIncludeActive ? (
          <p className="text-xs text-fg-subtle italic">
            Nothing selected. Pick sections below for Orion and the AI toolbar.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {contextSections.map(section => (
              <span
                key={section.id}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg text-xs font-medium bg-accent-soft text-accent border border-accent/30"
              >
                {section.label}
                <button
                  type="button"
                  onClick={() => removeContextSection(section.id)}
                  className="p-0.5 rounded hover:bg-accent/20 transition-colors"
                  title={`Remove ${section.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {canIncludeActive && activeSectionMeta && (
              <button
                type="button"
                onClick={() => addContextSection(activeSection)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border border-dashed border-border-strong text-fg-muted hover:border-accent hover:text-accent hover:bg-accent-soft transition-colors"
                title={`Include current section: ${activeSectionMeta.label}`}
              >
                <Plus className="w-3 h-3" />
                {activeSectionMeta.label}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchQueryChange}
            placeholder="Filter sections…"
            className="w-full pl-9 pr-9 py-2 text-sm border border-border-strong rounded-xl bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Toggle list */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3">
        {filteredSections.length === 0 ? (
          <div className="text-center py-10 text-fg-subtle px-2">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {searchQuery.trim()
                ? 'No matching sections'
                : 'No sections available for context'}
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {filteredSections.map(section => {
              const isSelected = selectedIdSet.has(section.id);
              const isActive = section.id === activeSection;
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className={`
                      w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-xl border transition-colors
                      ${
                        isSelected
                          ? 'border-accent/40 bg-accent-soft shadow-sm'
                          : 'border-transparent hover:bg-hover/60 hover:border-border'
                      }
                    `}
                  >
                    <span
                      className={`
                        mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors
                        ${
                          isSelected
                            ? 'border-accent bg-accent text-accent-fg'
                            : 'border-border-strong bg-surface'
                        }
                      `}
                      aria-hidden
                    >
                      {isSelected && <Check className="w-3 h-3" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`text-sm font-medium truncate ${
                            isSelected ? 'text-accent' : 'text-fg'
                          }`}
                        >
                          {section.label}
                        </span>
                        {isActive && (
                          <span className="text-[10px] uppercase tracking-wide text-fg-subtle shrink-0">
                            editing
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-fg-muted mt-0.5 line-clamp-2">
                        {section.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
        </>
      )}

    </div>
  );
}

export default ContextPanel;
