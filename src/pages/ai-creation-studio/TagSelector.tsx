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
    () => new Set(TAG_CATEGORIES.map((c) => c.key))
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
        const perspectiveTags = ['first_person', 'second_person', 'third_person', 'first_person_you'];
        const tenseTags = ['present_tense', 'past_tense'];

        let updated: string[];

        if (perspectiveTags.includes(tag)) {
          // Remove any existing perspective tag, then add/remove this one
          updated = current.filter((t) => !perspectiveTags.includes(t));
          if (!exists) {
            updated.push(tag);
          }
        } else if (tenseTags.includes(tag)) {
          // Remove any existing tense tag, then add/remove this one
          updated = current.filter((t) => !tenseTags.includes(t));
          if (!exists) {
            updated.push(tag);
          }
        } else {
          updated = current;
        }

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

  const canGenerate = isConfigured && hasSelection && !isGenerating;

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vault-400 dark:text-vault-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tags..."
          disabled={isGenerating}
          className="w-full pl-9 pr-4 py-2 bg-vault-50 dark:bg-vault-950/50 border border-vault-200 dark:border-vault-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-vault-500/50 dark:focus:ring-vault-400/50 focus:bg-white dark:focus:bg-vault-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all placeholder:text-vault-400 dark:placeholder:text-vault-600"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-vault-400 hover:text-vault-600 dark:hover:text-vault-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Not Configured State */}
      {!isConfigured && (
        <div className="flex flex-col items-center text-center gap-3 p-5 bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/40 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              AI Provider Not Configured
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Configure your AI provider and choose a model to start generating characters.
            </p>
          </div>
          <button
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-800/40 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-lg transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            Configure AI
          </button>
        </div>
      )}

      {/* Selected summary */}
      <div className="space-y-3 p-4 bg-vault-50 dark:bg-vault-900/50 border border-vault-200 dark:border-vault-800 rounded-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-vault-600 dark:text-vault-400 uppercase tracking-wider">
            Selected {hasSelection && `(${selectedCount})`}
          </span>
          {hasSelection && (
            <button
              onClick={() => onSelectionsChange({})}
              className="text-xs text-vault-500 dark:text-vault-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
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
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800"
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
          <p className="text-xs text-vault-400 dark:text-vault-600 italic transition-opacity duration-200">
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
              className="border border-vault-200 dark:border-vault-800 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleCategory(category.key)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-vault-50/50 dark:bg-vault-900/30 hover:bg-vault-100 dark:hover:bg-vault-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-vault-800 dark:text-vault-200">
                    {category.label}
                  </span>
                  {selectedInCat.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-vault-200 dark:bg-vault-700 text-vault-700 dark:text-vault-300">
                      {selectedInCat.length}
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-vault-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-vault-400" />
                )}
              </button>

              {isExpanded && (
                <div className="px-3 py-3 flex flex-wrap gap-1.5 bg-white dark:bg-vault-900">
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
                            ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800'
                            : isExcluded
                            ? 'opacity-30 border-vault-200 dark:border-vault-700 text-vault-400 dark:text-vault-600 line-through'
                            : 'border-vault-200 dark:border-vault-700 text-vault-600 dark:text-vault-400 hover:border-vault-400 dark:hover:border-vault-500 hover:bg-vault-50 dark:hover:bg-vault-800/50'
                        }`}
                      >
                        {formatTag(tag)}
                      </button>
                    );
                  })}
                  {filteredTags.length === 0 && searchLower && (
                    <span className="text-xs text-vault-400 dark:text-vault-500 italic">
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
      <p className="text-xs text-vault-400 dark:text-vault-500 text-center">
        Generation uses a minimum of 4 API calls. At least one per field.
      </p>

      {/* Action Bar */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-vault-900 dark:bg-vault-50 text-white dark:text-vault-900 font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm"
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
            className="flex items-center gap-2 px-4 py-2.5 border border-vault-300 dark:border-vault-700 text-vault-700 dark:text-vault-300 font-medium rounded-xl hover:bg-vault-50 dark:hover:bg-vault-900 active:scale-[0.98] transition-all"
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
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-linear-to-r from-violet-600 to-fuchsia-600 text-white font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm"
        >
          <Shuffle className="w-4 h-4" />
          I'm Feeling Lucky
        </button>
        <p className="text-xs text-center text-vault-500 dark:text-vault-400">
          Let fate decide. This can get wild.
        </p>
      </div>
    </div>
  );
};
