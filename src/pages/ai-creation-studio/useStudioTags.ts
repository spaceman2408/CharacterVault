/**
 * @fileoverview Studio tag preferences: custom tags (persisted in settings),
 * favorites + recents (localStorage), and resolved/visible categories.
 * @module @pages/ai-creation-studio/useStudioTags
 */

import { useCallback, useEffect, useState } from 'react';
import { characterSettingsService } from '../../services/CharacterSettingsService';
import {
  TAG_CATEGORIES,
  getFavoriteTags,
  getRecentTags,
  getVisibleCategories,
  isCustomTag,
  mergeCustomTags,
  pushRecentTags,
  resolveNewCustomTag,
  toggleFavoriteTag,
  type TagCategory,
  type TaggedRef,
} from './tags/tagData';

export interface UseStudioTagsResult {
  allCategories: TagCategory[];
  visibleCategories: TagCategory[];
  hideNsfw: boolean;
  hiddenCategories: string[];
  favorites: TaggedRef[];
  recent: TaggedRef[];
  addCustomTag: (categoryKey: string, raw: string) => Promise<{ ok: boolean; slug?: string; error?: string }>;
  removeCustomTag: (categoryKey: string, tag: string) => Promise<void>;
  toggleFavorite: (category: string, tag: string) => void;
  trackUsed: (selections: Record<string, string[]>) => void;
  reload: () => Promise<void>;
}

export function useStudioTags(): UseStudioTagsResult {
  const [customTags, setCustomTags] = useState<Record<string, string[]>>({});
  const [hideNsfw, setHideNsfw] = useState(false);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<TaggedRef[]>(() => getFavoriteTags());
  const [recent, setRecent] = useState<TaggedRef[]>(() => getRecentTags());

  const applyPrefs = useCallback(
    (prefs: {
      customTags: Record<string, string[]>;
      hideNsfw: boolean;
      hiddenCategories: string[];
    }) => {
      setCustomTags(prefs.customTags);
      setHideNsfw(prefs.hideNsfw);
      setHiddenCategories(prefs.hiddenCategories);
      setFavorites(getFavoriteTags());
      setRecent(getRecentTags());
    },
    []
  );

  const reload = useCallback(async () => {
    try {
      const studio = await characterSettingsService.getStudioSettings();
      applyPrefs({
        customTags: studio.tags.customTags ?? {},
        hideNsfw: studio.tags.hideNsfw ?? false,
        hiddenCategories: studio.tags.hiddenCategories ?? [],
      });
    } catch {
      // Best-effort: keep previous prefs when settings are unreadable.
    }
  }, [applyPrefs]);

  useEffect(() => {
    let cancelled = false;
    characterSettingsService
      .getStudioSettings()
      .then((studio) => {
        if (cancelled) return;
        applyPrefs({
          customTags: studio.tags.customTags ?? {},
          hideNsfw: studio.tags.hideNsfw ?? false,
          hiddenCategories: studio.tags.hiddenCategories ?? [],
        });
      })
      .catch(() => {
        // Best-effort: keep defaults when settings are unreadable.
      });
    return () => {
      cancelled = true;
    };
  }, [applyPrefs]);

  const addCustomTag = useCallback(async (categoryKey: string, raw: string) => {
    const early = resolveNewCustomTag(categoryKey, raw);
    if (!early.ok) return early;
    // Merge against a fresh read so concurrent adds cannot clobber each other.
    const studio = await characterSettingsService.getStudioSettings();
    const current = studio.tags.customTags ?? {};
    const resolved = resolveNewCustomTag(categoryKey, raw, current);
    if (!resolved.ok) {
      setCustomTags(current);
      return resolved;
    }
    const next = {
      ...current,
      [categoryKey]: [...(current[categoryKey] ?? []), resolved.slug],
    };
    await characterSettingsService.saveStudioSettings({
      ...studio,
      tags: { ...studio.tags, customTags: next },
    });
    setCustomTags(next);
    return { ok: true, slug: resolved.slug };
  }, []);

  const removeCustomTag = useCallback(async (categoryKey: string, tag: string) => {
    if (!isCustomTag(categoryKey, tag)) return;
    // Merge against a fresh read so concurrent edits cannot clobber each other.
    const studio = await characterSettingsService.getStudioSettings();
    const current = studio.tags.customTags ?? {};
    const next = { ...current };
    next[categoryKey] = (next[categoryKey] ?? []).filter((t) => t !== tag);
    if (next[categoryKey].length === 0) delete next[categoryKey];
    await characterSettingsService.saveStudioSettings({
      ...studio,
      tags: { ...studio.tags, customTags: next },
    });
    setCustomTags(next);
  }, []);

  const toggleFavorite = useCallback((category: string, tag: string) => {
    setFavorites(toggleFavoriteTag(category, tag));
  }, []);

  const trackUsed = useCallback((selections: Record<string, string[]>) => {
    const refs: TaggedRef[] = [];
    for (const [category, tags] of Object.entries(selections)) {
      if (category === 'generation') continue;
      for (const tag of tags) refs.push({ category, tag });
    }
    if (refs.length > 0) setRecent(pushRecentTags(refs));
  }, []);

  const allCategories = mergeCustomTags(TAG_CATEGORIES, customTags);
  const visibleCategories = getVisibleCategories(allCategories, { hideNsfw, hiddenCategories });

  return {
    allCategories,
    visibleCategories,
    hideNsfw,
    hiddenCategories,
    favorites,
    recent,
    addCustomTag,
    removeCustomTag,
    toggleFavorite,
    trackUsed,
    reload,
  };
}
