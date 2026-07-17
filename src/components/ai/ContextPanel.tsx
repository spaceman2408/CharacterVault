/**
 * @fileoverview Context Panel component for adding character sections as AI context.
 * Updated for CharacterVault - Docked side panel version with collapsible sections.
 * @module components/ai/ContextPanel
 */

import React, { useState, useCallback } from 'react';
import {
  Plus,
  Search,
  BookOpen,
  Trash2,
  Sparkles,
  X,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  BrushCleaning,
} from 'lucide-react';
import { useCharacterEditorContext } from '../../context';
import { CHARACTER_SECTIONS } from '../../db/characterTypes';
import { estimateTokens, BYTES_PER_TOKEN } from '../../services/AIService';

export interface ContextPanelProps {
  /** Callback to close panel (for mobile) */
  onClose?: () => void;
  /** Whether this is mobile view (shows close button) */
  isMobile?: boolean;
}

/**
 * Context Panel component - Docked side panel with collapsible sections
 * 
 * Features:
 * - Docked to the left side of the workspace
 * - Collapsible sections for Selected Context and Add Context
 * - Mobile responsive with close button
 */
export function ContextPanel({
  onClose,
  isMobile = false,
}: ContextPanelProps): React.ReactElement {
  const { 
    currentCharacter, 
    contextSectionIds, 
    setContextSectionIds, 
    addContextSection, 
    removeContextSection,
    samplerSettings,
    visibleSections,
    sectionOrder,
  } = useCharacterEditorContext();

  const currentCharacterData = currentCharacter?.data ?? null;
  const hasCurrentCharacter = currentCharacterData !== null;
  const [searchQuery, setSearchQuery] = useState('');
  const handleSearchQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);
  
  // Collapsible section states
  const [isSelectedContextExpanded, setIsSelectedContextExpanded] = useState(true);
  const [isAddContextExpanded, setIsAddContextExpanded] = useState(true);
  
  // Context limit from sampler settings
  const contextLimit = samplerSettings.contextLength;
  const hasLorebook = !!currentCharacterData?.characterBook;

  // Sections usable as context: exclude non-text sections and those hidden from the tab strip.
  // Hidden sections are intentionally excluded so they don't clutter the context picker.
  // Build the pool of addable sections, respecting the user's section order and visibility.
  const addableSections = React.useMemo(() => {
    const excludedSections = ['image', 'extensions', 'avatar', 'character_version', 'tags'];
    return visibleSections.filter(section => {
      if (excludedSections.includes(section.id)) return false;
      if (contextSectionIds.includes(section.id)) return false;
      if (section.id === 'lorebook' && !hasLorebook) return false;
      return true;
    });
  }, [visibleSections, contextSectionIds, hasLorebook]);

  // Filter the addable pool by search query
  const filteredSections = React.useMemo(() => {
    if (!searchQuery.trim()) return addableSections;
    const query = searchQuery.toLowerCase();
    return addableSections.filter(section =>
      section.label.toLowerCase().includes(query) ||
      section.description.toLowerCase().includes(query)
    );
  }, [addableSections, searchQuery]);

  // Get selected context sections, ordered by the user's sectionOrder (hidden sections still
  // appear here if they were added before being hidden, since they're actively in context).
  const contextSections = React.useMemo(() => {
    const selected = new Set(contextSectionIds);
    const ordered = sectionOrder
      .filter(id => selected.has(id))
      .map(id => CHARACTER_SECTIONS.find(s => s.id === id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined);
    // Append any selected sections not present in sectionOrder (e.g. newly added types)
    ordered.forEach(s => selected.delete(s.id));
    selected.forEach(id => {
      const meta = CHARACTER_SECTIONS.find(s => s.id === id);
      if (meta) ordered.push(meta);
    });
    return ordered;
  }, [contextSectionIds, sectionOrder]);

  // Calculate token count using estimator
  const calculateTokenCount = useCallback((): number => {
    if (!currentCharacterData) return 0;

    let totalTokens = 0;

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
  }, [currentCharacterData, contextSectionIds]);

  // Get usage data for the progress bar
  const usageData = React.useMemo(() => {
    const tokenCount = calculateTokenCount();
    const percentage = Math.min(100, (tokenCount / contextLimit) * 100);
    
    let status: 'good' | 'warning' | 'danger' = 'good';
    if (percentage > 80) {
      status = 'danger';
    } else if (percentage > 50) {
      status = 'warning';
    }
    
    return {
      tokenCount,
      percentage,
      status,
    };
  }, [calculateTokenCount, contextLimit]);

  if (!hasCurrentCharacter) return <></>;

  return (
    <div className="h-full flex flex-col bg-bg border-r border-border animate-fade-in-slow">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-fg-muted" />
          <h2 className="font-semibold text-fg">
            AI Context
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setContextSectionIds([])}
            className="p-1.5 text-fg-muted hover:text-accent hover:bg-accent-soft rounded-lg transition-colors disabled:opacity-50"
            title="Clear all context"
            disabled={contextSectionIds.length === 0}
          >
            <BrushCleaning className="w-4 h-4" />
          </button>
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-fg-muted hover:text-accent hover:bg-accent-soft rounded-lg transition-colors"
              title="Close Context Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Selected Context Section - Collapsible */}
      <div className="border-b border-border shrink-0">
        <button
          onClick={() => setIsSelectedContextExpanded(!isSelectedContextExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-hover/50 transition-colors"
        >
          <h3 className="text-xs font-medium text-fg-muted uppercase tracking-wide">
            Selected Context ({contextSections.length})
          </h3>
          {isSelectedContextExpanded ? (
            <ChevronUp className="w-4 h-4 text-fg-subtle" />
          ) : (
            <ChevronDown className="w-4 h-4 text-fg-subtle" />
          )}
        </button>
        
        {isSelectedContextExpanded && (
          <div className="px-4 pb-4 space-y-3">
            {/* Context Usage Indicator */}
            {contextSections.length > 0 && (
              <div className="p-3 bg-surface rounded-lg border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-fg-muted">
                    Context Usage
                  </span>
                  <span className={`text-xs font-medium ${
                    usageData.status === 'good' 
                      ? 'text-success' 
                      : usageData.status === 'warning'
                      ? 'text-warning'
                      : 'text-danger'
                  }`}>
                    {usageData.percentage.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 bg-hover rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full transition-all duration-300 ${
                      usageData.status === 'good'
                        ? 'bg-success'
                        : usageData.status === 'warning'
                        ? 'bg-yellow-500'
                        : 'bg-danger'
                    }`}
                    style={{ width: `${usageData.percentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-fg-muted">
                    {usageData.tokenCount.toLocaleString()} / {contextLimit.toLocaleString()} tokens
                  </span>
                  {usageData.status === 'danger' && (
                    <span className="flex items-center gap-1 text-danger">
                      <AlertCircle className="w-3 h-3" />
                      Over limit
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {/* Info about auto-included section */}
            <div className="p-2 bg-info-soft border border-info/30 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-info-soft-fg">
                <div className="group relative">
                  <Info className="w-4 h-4 shrink-0 cursor-help" />
                  <div className="absolute top-full left-0 mt-2 w-64 p-2 bg-surface text-fg text-xs rounded-lg border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-lg">
                    <p className="font-medium mb-1">How tokens are estimated:</p>
                    <p>Text size in bytes ÷ {BYTES_PER_TOKEN} (rounded up)</p>
                    <p className="text-fg-subtle mt-1">Actual token counts may vary by model.</p>
                    <div className="absolute bottom-full left-4 -mb-px border-4 border-b-vault-800"></div>
                  </div>
                </div>
                <span>Token counts are an estimation only.</span>
              </div>
            </div>

            {contextSections.length === 0 ? (
              <div className="text-center py-4 text-fg-subtle">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No context selected</p>
                <p className="text-xs mt-1">Add sections to provide context for AI</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {contextSections.map((section) => (
                  <div
                    key={section.id}
                    className="flex items-center justify-between p-2 rounded-lg border bg-surface border-border"
                  >
                    <span className="text-sm font-medium text-fg">
                      {section.label}
                    </span>
                    <button
                      onClick={() => removeContextSection(section.id)}
                      className="p-1.5 text-fg-subtle hover:text-danger hover:bg-danger-soft rounded transition-colors ml-2"
                      title="Remove from context"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Context Section - Collapsible */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <button
          onClick={() => setIsAddContextExpanded(!isAddContextExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 border-b border-border hover:bg-hover/50 transition-colors shrink-0"
        >
          <h3 className="text-xs font-medium text-fg-muted uppercase tracking-wide">
            Add Context
          </h3>
          {isAddContextExpanded ? (
            <ChevronUp className="w-4 h-4 text-fg-subtle" />
          ) : (
            <ChevronDown className="w-4 h-4 text-fg-subtle" />
          )}
        </button>

        {isAddContextExpanded && (
          <>
            {/* Search Input */}
            <div className="p-4 border-b border-border shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchQueryChange}
                  placeholder="Search sections..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-border-strong rounded-lg bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {/* Available Sections List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredSections.length === 0 ? (
                <div className="text-center py-8 text-fg-subtle">
                  <p className="text-sm">
                    {searchQuery.trim() ? 'No matching sections found' : 'All sections are in context'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => {
                        addContextSection(section.id);
                        setSearchQuery('');
                      }}
                      className="w-full text-left p-3 bg-surface hover:bg-hover border border-border rounded-lg transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-fg truncate group-hover:text-fg">
                            {section.label}
                          </p>
                          <p className="text-xs text-fg-muted mt-1">
                            {section.description}
                          </p>
                        </div>
                        <Plus className="w-4 h-4 text-fg-subtle group-hover:text-fg shrink-0 mt-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ContextPanel;
