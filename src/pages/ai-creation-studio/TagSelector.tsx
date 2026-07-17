/**
 * @fileoverview Tag browsing and selection component for AI Creation Studio
 * @module @pages/ai-creation-studio/TagSelector
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  Sparkles,
  ChevronDown,
  ChevronRight,
  X,
  Shuffle,
  AlertCircle,
  Settings2,
  Loader2,
} from 'lucide-react';
import {
  TAG_CATEGORIES,
  formatTag,
  getExcludedTagsForUI,
  hasRequiredGenerationTags,
  toggleGenerationTagSelection,
} from './tags/tagData';

interface TagSelectorProps {
  selections: Record<string, string[]>;
  onSelectionsChange: (s: Record<string, string[]>) => void;
  onFeelingLucky: () => void;
  onGenerate: () => void;
  onAbort: () => void;
  isGenerating: boolean;
  isConfigured: boolean;
  onOpenSettings: () => void;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  selections,
  onSelectionsChange,
  onFeelingLucky,
  onGenerate,
  onAbort,
  isGenerating,
  isConfigured,
  onOpenSettings,
}) => {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(['generation'])
  );

  const toggleCategory = useCallback((key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleTag = useCallback(
    (categoryKey: string, tag: string) => {
      const current = selections[categoryKey] ?? [];
      const exists = current.includes(tag);

      if (categoryKey === 'generation') {
        const updated = toggleGenerationTagSelection(current, tag);
        onSelectionsChange({ ...selections, [categoryKey]: updated });
      } else {
        // Existing logic for other categories
        const updated = exists
          ? current.filter((t) => t !== tag)
          : [...current, tag];
        onSelectionsChange({ ...selections, [categoryKey]: updated });
      }
    },
    [selections, onSelectionsChange]
  );

  const removeTag = useCallback(
    (categoryKey: string, tag: string) => {
      const current = selections[categoryKey] ?? [];
      onSelectionsChange({ ...selections, [categoryKey]: current.filter((t) => t !== tag) });
    },
    [selections, onSelectionsChange]
  );

  const hasSelection = useMemo(
    () => Object.values(selections).some((arr) => arr.length > 0),
    [selections]
  );

  const hasConceptSelection = useMemo(
    () => Object.entries(selections).some(([key, arr]) => key !== 'generation' && arr.length > 0),
    [selections]
  );

  const hasGenerationTags = useMemo(
    () => hasRequiredGenerationTags(selections),
    [selections]
  );

  const selectedCount = useMemo(
    () => Object.values(selections).reduce((sum, arr) => sum + arr.length, 0),
    [selections]
  );

  const searchLower = search.trim().toLowerCase();

  // Get excluded tags based on current selections
  const excludedTags = useMemo(
    () => getExcludedTagsForUI(selections),
    [selections]
  );

  const canGenerate = isConfigured && hasConceptSelection && hasGenerationTags && !isGenerating;

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tags..."
          disabled={isGenerating}
          className="w-full pl-9 pr-4 py-2 bg-bg/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-all placeholder:text-fg-subtle"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Not Configured State */}
      {!isConfigured && (
        <div className="flex flex-col items-center text-center gap-3 p-5 bg-warning-soft/60 border border-warning/30 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-warning-soft flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-sm font-medium text-warning-soft-fg">
              AI Provider Not Configured
            </p>
            <p className="text-xs text-warning-soft-fg mt-0.5">
              Configure your AI provider and choose a model to start generating characters.
            </p>
          </div>
          <button
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-warning-soft-fg bg-warning-soft hover:opacity-90 rounded-lg transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            Configure AI
          </button>
        </div>
      )}

      {/* Selected summary */}
      <div className="space-y-3 p-4 bg-bg/50 border border-border rounded-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
            Selected {hasSelection && `(${selectedCount})`}
          </span>
          {hasSelection && (
            <button
              onClick={() => onSelectionsChange({})}
              className="text-xs text-fg-muted hover:text-danger transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
        {hasSelection ? (
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {TAG_CATEGORIES.flatMap((cat) =>
              (selections[cat.key] ?? []).map((tag) => (
                <span
                  key={`${cat.key}-${tag}`}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border bg-muted text-fg border-border"
                >
                  {formatTag(tag)}
                  <button
                    onClick={() => removeTag(cat.key, tag)}
                    disabled={isGenerating}
                    className="ml-0.5 hover:opacity-75 transition-opacity disabled:opacity-40"
                    aria-label={`Remove ${formatTag(tag)}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        ) : (
          <p className="text-xs text-fg-subtle italic transition-opacity duration-200">
            Select a tag for it to appear here.
          </p>
        )}
      </div>

      {/* Category sections */}
      <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
        {TAG_CATEGORIES.map((category) => {
          const isExpanded = expandedCategories.has(category.key);
          const selectedInCat = selections[category.key] ?? [];

          const filteredTags = searchLower
            ? category.tags.filter((t) =>
                t.toLowerCase().includes(searchLower)
              )
            : category.tags;

          if (searchLower && filteredTags.length === 0) return null;

          return (
            <div
              key={category.key}
              className="border border-border rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleCategory(category.key)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/50 bg-surface/30 hover:bg-hover/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-fg">
                    {category.label}
                  </span>
                  {category.key === 'generation' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warning-soft text-warning-soft-fg">
                      Required
                    </span>
                  )}
                  {selectedInCat.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-hover text-fg-muted">
                      {selectedInCat.length}
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-fg-subtle" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-fg-subtle" />
                )}
              </button>

              {isExpanded && (
                <div className="px-3 py-3 flex flex-wrap gap-1.5 bg-surface">
                  {filteredTags.map((tag) => {
                    const isSelected = selectedInCat.includes(tag);
                    const isExcluded = !isSelected && excludedTags.has(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(category.key, tag)}
                        disabled={isGenerating || isExcluded}
                        title={isExcluded ? 'This tag conflicts with your current selection' : undefined}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all disabled:cursor-not-allowed ${
                          isSelected
                            ? 'bg-muted text-fg border-border'
                            : isExcluded
                            ? 'opacity-30 border-border text-fg-subtle line-through'
                            : 'border-border text-fg-muted hover:border-border-strong hover:bg-hover/50'
                        }`}
                      >
                        {formatTag(tag)}
                      </button>
                    );
                  })}
                  {filteredTags.length === 0 && searchLower && (
                    <span className="text-xs text-fg-subtle italic">
                      No matching tags
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* API call cost notice */}
      <p className="text-xs text-fg-subtle text-center">
        Generation uses a minimum of 4 API calls. At least one per field.
      </p>

      {isConfigured && !isGenerating && !hasGenerationTags && (
        <p className="text-xs text-warning text-center">
          Choose one perspective and one tense before generating.
        </p>
      )}

      {isConfigured && !isGenerating && hasGenerationTags && !hasConceptSelection && (
        <p className="text-xs text-warning text-center">
          Select at least one character tag before generating, or press I'm Feeling Lucky.
        </p>
      )}

      {/* Action Bar */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-inverse text-fg-inverse font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {isGenerating ? 'Generating Character...' : 'Generate Character'}
        </button>
        {isGenerating && (
          <button
            onClick={onAbort}
            className="flex items-center gap-2 px-4 py-2.5 border border-border-strong text-fg-muted font-medium rounded-xl hover:bg-hover active:scale-[0.98] transition-all"
          >
            <X className="w-4 h-4" />
            Stop
          </button>
        )}
      </div>

      {/* I'm Feeling Lucky */}
      <div className="space-y-1.5">
        <button
          onClick={onFeelingLucky}
          disabled={isGenerating || !hasGenerationTags}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-linear-to-r from-violet-600 to-fuchsia-600 text-white font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm"
        >
          <Shuffle className="w-4 h-4" />
          I'm Feeling Lucky
        </button>
        <p className="text-xs text-center text-fg-muted">
          {hasGenerationTags ? 'Let fate decide. This can get wild.' : 'Choose generation style first.'}
        </p>
      </div>
    </div>
  );
};
