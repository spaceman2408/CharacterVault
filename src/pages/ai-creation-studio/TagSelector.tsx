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
  Loader2,
  Star,
  Plus,
  Clock,
} from 'lucide-react';
import {
  formatTag,
  getExcludedTagsForUI,
  hasRequiredGenerationTags,
  isCustomTag,
  type TagCategory,
  type TaggedRef,
} from './tags/tagData';
import { isImeComposing } from '../../utils/imeComposing';
import { TagChip } from './TagChip';
import { GenerationStyleOptions, RequiredBadge } from './GenerationStyle';

interface TagSelectorProps {
  selections: Record<string, string[]>;
  onSelectionsChange: (s: Record<string, string[]>) => void;
  onFeelingLucky: () => void;
  onGenerate: () => void;
  onAbort: () => void;
  isGenerating: boolean;
  isConfigured: boolean;
  minApiCalls?: number;
  onOpenSettings: () => void;
  categories: TagCategory[];
  allCategories: TagCategory[];
  hiddenCategoryCount: number;
  favorites: TaggedRef[];
  recent: TaggedRef[];
  onToggleFavorite: (category: string, tag: string) => void;
  onAddCustomTag: (categoryKey: string, raw: string) => Promise<{ ok: boolean; slug?: string; error?: string }>;
  onRemoveCustomTag: (categoryKey: string, tag: string) => void;
}

const AddCustomTagForm: React.FC<{
  categoryKey: string;
  isGenerating: boolean;
  onAdd: (categoryKey: string, raw: string) => Promise<{ ok: boolean; slug?: string; error?: string }>;
  onAdded: (slug: string) => void;
}> = ({ categoryKey, isGenerating, onAdd, onAdded }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const submit = async () => {
    if (!value.trim() || isAdding) return;
    setIsAdding(true);
    setError(null);
    const result = await onAdd(categoryKey, value);
    setIsAdding(false);
    if (result.ok) {
      setValue('');
      if (result.slug) onAdded(result.slug);
    } else {
      setError(result.error ?? 'Could not add tag.');
    }
  };

  return (
    <div className="w-full pt-2 mt-1 border-t border-border">
      <div className="flex gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isImeComposing(e)) void submit();
          }}
          placeholder="Add your own tag..."
          disabled={isGenerating || isAdding}
          maxLength={40}
          className="flex-1 min-w-0 px-2.5 py-1 bg-bg/50 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/50 focus:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-all placeholder:text-fg-subtle"
        />
        <button
          onClick={() => void submit()}
          disabled={isGenerating || isAdding || !value.trim()}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-border text-fg-muted hover:border-accent/40 hover:bg-accent-soft hover:text-accent transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
};

export const TagSelector: React.FC<TagSelectorProps> = ({
  selections,
  onSelectionsChange,
  onFeelingLucky,
  onGenerate,
  onAbort,
  isGenerating,
  isConfigured,
  minApiCalls = 4,
  onOpenSettings,
  categories,
  allCategories,
  hiddenCategoryCount,
  favorites,
  recent,
  onToggleFavorite,
  onAddCustomTag,
  onRemoveCustomTag,
}) => {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(hasRequiredGenerationTags(selections) ? [] : ['generation'])
  );

  const categoryByKey = useMemo(() => {
    const map = new Map<string, TagCategory>();
    for (const cat of allCategories) map.set(cat.key, cat);
    return map;
  }, [allCategories]);

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
      const updated = current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag];
      onSelectionsChange({ ...selections, [categoryKey]: updated });
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

  const conceptSelections = useMemo(
    () => Object.entries(selections).filter(([key]) => key !== 'generation'),
    [selections]
  );

  const hasConceptSelection = useMemo(
    () => conceptSelections.some(([, arr]) => arr.length > 0),
    [conceptSelections]
  );

  const hasGenerationTags = useMemo(
    () => hasRequiredGenerationTags(selections),
    [selections]
  );

  const selectedCount = useMemo(
    () => conceptSelections.reduce((sum, [, arr]) => sum + arr.length, 0),
    [conceptSelections]
  );

  const tagCategories = useMemo(
    () => categories.filter((category) => category.key !== 'generation'),
    [categories]
  );

  const isFavorite = (category: string, tag: string) =>
    favorites.some((f) => f.category === category && f.tag === tag);

  const searchLower = search.trim().toLowerCase();

  // Get excluded tags based on current selections. Every rendered tag is
  // passed as a candidate so custom tags get gender-opposition gray-outs too.
  const excludedTags = useMemo(
    () => getExcludedTagsForUI(selections, tagCategories.flatMap((category) => category.tags)),
    [selections, tagCategories]
  );

  const favoriteTags = useMemo(
    () =>
      favorites.filter(
        (f) => f.category !== 'generation' && categoryByKey.get(f.category)?.tags.includes(f.tag)
      ),
    [favorites, categoryByKey]
  );

  const recentTags = useMemo(
    () =>
      recent.filter(
        (r) =>
          r.category !== 'generation' &&
          categoryByKey.get(r.category)?.tags.includes(r.tag) &&
          !(selections[r.category] ?? []).includes(r.tag)
      ),
    [recent, categoryByKey, selections]
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

      {/* Selected summary */}
      <div className="space-y-3 p-4 bg-bg/50 border border-border rounded-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
            Selected {hasConceptSelection && `(${selectedCount})`}
          </span>
          {hasConceptSelection && (
            <button
              onClick={() => onSelectionsChange({ generation: selections.generation ?? [] })}
              className="text-xs text-fg-muted hover:text-danger transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
        {hasConceptSelection ? (
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {conceptSelections.flatMap(([key, tags]) =>
              tags.map((tag) => {
                return (
                  <span
                    key={`${key}-${tag}`}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border bg-accent-soft text-accent border-accent"
                  >
                    {formatTag(tag)}
                    <button
                      onClick={() => removeTag(key, tag)}
                      disabled={isGenerating}
                      className="ml-0.5 hover:opacity-75 transition-opacity disabled:opacity-40"
                      aria-label={`Remove ${formatTag(tag)}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })
            )}
          </div>
        ) : (
          <p className="text-xs text-fg-subtle italic transition-opacity duration-200">
            Select a tag for it to appear here.
          </p>
        )}
      </div>

      {/* Favorites */}
      {favoriteTags.length > 0 && (
        <div className="space-y-2 p-4 bg-bg/50 border border-border rounded-xl">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted uppercase tracking-wider">
            <Star className="w-3.5 h-3.5" />
            Favorites
          </span>
          <div className="flex flex-wrap gap-1.5">
            {favoriteTags.map(({ category, tag }) => (
              <TagChip
                key={`fav-${category}-${tag}`}
                label={formatTag(tag)}
                selected={(selections[category] ?? []).includes(tag)}
                favorite
                onToggle={() => toggleTag(category, tag)}
                onToggleFavorite={() => onToggleFavorite(category, tag)}
                disabled={isGenerating}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent */}
      {recentTags.length > 0 && (
        <div className="space-y-2 p-4 bg-bg/50 border border-border rounded-xl">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5" />
            Recent
          </span>
          <div className="flex flex-wrap gap-1.5">
            {recentTags.map(({ category, tag }) => (
              <button
                key={`recent-${category}-${tag}`}
                onClick={() => toggleTag(category, tag)}
                disabled={isGenerating}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-border text-fg-muted hover:border-accent/40 hover:bg-accent-soft hover:text-accent transition-all disabled:cursor-not-allowed disabled:opacity-50"
              >
                {formatTag(tag)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category sections */}
      <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => toggleCategory('generation')}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-surface/30 hover:bg-hover/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-fg">Generation Style</span>
              {(selections.generation ?? []).length > 0 && (
                <span className="font-bold px-1.5 py-0.5 rounded-full bg-accent-soft text-accent">
                  {(selections.generation ?? []).length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <RequiredBadge />
              {expandedCategories.has('generation') ? (
                <ChevronDown className="w-4 h-4 text-fg-subtle" />
              ) : (
                <ChevronRight className="w-4 h-4 text-fg-subtle" />
              )}
            </div>
          </button>
          {expandedCategories.has('generation') && (
            <div className="px-3 py-3 bg-surface">
              <GenerationStyleOptions
                selections={selections}
                onSelectionsChange={onSelectionsChange}
                isGenerating={isGenerating}
                favorites={favorites}
                onToggleFavorite={onToggleFavorite}
              />
            </div>
          )}
        </div>
        {tagCategories.map((category) => {
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
                className="w-full flex items-center justify-between px-3 py-2.5 bg-surface/30 hover:bg-hover/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-fg">
                    {category.label}
                  </span>
                  {category.nsfw && (
                    <span className="font-bold px-1.5 py-0.5 rounded-full bg-danger-soft text-danger-soft-fg">
                      NSFW
                    </span>
                  )}
                  {selectedInCat.length > 0 && (
                    <span className="font-bold px-1.5 py-0.5 rounded-full bg-accent-soft text-accent">
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
                    const custom = isCustomTag(category.key, tag);
                    return (
                      <TagChip
                        key={tag}
                        label={formatTag(tag)}
                        selected={isSelected}
                        favorite={isFavorite(category.key, tag)}
                        onToggle={() => toggleTag(category.key, tag)}
                        onToggleFavorite={() => onToggleFavorite(category.key, tag)}
                        onDelete={custom ? () => onRemoveCustomTag(category.key, tag) : undefined}
                        disabled={isGenerating}
                        excluded={isExcluded}
                        custom={custom}
                      />
                    );
                  })}
                  {filteredTags.length === 0 && searchLower && (
                    <span className="text-xs text-fg-subtle italic">
                      No matching tags
                    </span>
                  )}
                  {category.key !== 'generation' && !searchLower && (
                    <AddCustomTagForm
                      categoryKey={category.key}
                      isGenerating={isGenerating}
                      onAdd={onAddCustomTag}
                      onAdded={(slug) => toggleTag(category.key, slug)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hiddenCategoryCount > 0 && (
        <p className="text-xs text-fg-subtle text-center">
          {hiddenCategoryCount} {hiddenCategoryCount === 1 ? 'category' : 'categories'} hidden.{' '}
          <button onClick={onOpenSettings} className="text-accent hover:underline">
            Manage in Settings
          </button>
        </p>
      )}

      {/* API call cost notice */}
      <p className="text-xs text-fg-subtle text-center">
        Generation uses a minimum of {minApiCalls} API call{minApiCalls === 1 ? '' : 's'}. At least one per field.
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
          className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-accent text-accent-fg font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm"
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
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-accent-soft text-accent border border-accent font-semibold rounded-xl hover:bg-accent hover:text-accent-fg active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm"
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
