/**
 * @fileoverview Tag data, types, and utilities for AI Creation Studio tag builder
 * @module @pages/ai-creation-studio/tags/tagData
 */

import identityTags from './identity.json';
import personalityTags from './personality.json';
import roleTags from './role.json';
import genreTags from './genre.json';
import toneTags from './tone.json';
import appearanceTags from './appearance.json';

export type TagCategoryKey = 'identity' | 'personality' | 'role' | 'genre' | 'tone' | 'appearance';

export interface TagCategory {
  key: TagCategoryKey;
  label: string;
  tags: string[];
}

export type TagSelections = Record<TagCategoryKey, string[]>;

export const TAG_CATEGORIES: readonly TagCategory[] = [
  { key: 'identity', label: 'Identity', tags: identityTags },
  { key: 'personality', label: 'Personality', tags: personalityTags },
  { key: 'role', label: 'Role', tags: roleTags },
  { key: 'genre', label: 'Genre', tags: genreTags },
  { key: 'tone', label: 'Tone', tags: toneTags },
  { key: 'appearance', label: 'Appearance', tags: appearanceTags },
] as const;

const TAG_CATEGORY_MAP: Record<TagCategoryKey, string[]> = {
  identity: identityTags,
  personality: personalityTags,
  role: roleTags,
  genre: genreTags,
  tone: toneTags,
  appearance: appearanceTags,
};

/**
 * Format a snake_case tag to human-readable Title Case
 */
export function formatTag(tag: string): string {
  return tag
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * All tags flattened across all categories
 */
export function getAllTags(): string[] {
  return Object.values(TAG_CATEGORY_MAP).flat();
}

/**
 * Build a concept string from tag selections.
 * Tags are comma-separated, snake_case converted to readable text.
 */
export function buildConceptFromTags(selections: Record<string, string[]>): string {
  const parts: string[] = [];
  const order: TagCategoryKey[] = ['identity', 'role', 'personality', 'genre', 'appearance', 'tone'];

  for (const key of order) {
    const tags = selections[key] ?? [];
    for (const tag of tags) {
      if (tag) {
        parts.push(formatTag(tag));
      }
    }
  }

  return parts.join(', ');
}

/**
 * Shuffle an array in-place (Fisher-Yates)
 */
function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Draw a random number of tags from a pool, respecting min/max constraints.
 */
function drawTags(pool: readonly string[], min: number, max: number): string[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  if (count <= 0) return [];
  const shuffled = shuffle(pool);
  return shuffled.slice(0, count);
}

/**
 * Randomly select tags across categories.
 *
 * Core categories (identity, role, personality): always 1–2 tags each
 * Supporting categories (genre, appearance, tone): 0–2 tags each
 *
 * `lockedKeys` prevent overwriting existing selections in those categories.
 */
export function randomizeTags(
  currentSelections: Record<string, string[]>,
  lockedKeys: readonly string[] = []
): Record<string, string[]> {
  const next: Record<string, string[]> = { ...currentSelections };

  const coreCategoryKeys: TagCategoryKey[] = ['identity', 'role', 'personality'];
  const supportingKeys: TagCategoryKey[] = ['genre', 'appearance', 'tone'];

  for (const key of coreCategoryKeys) {
    if (lockedKeys.includes(key)) continue;
    next[key] = drawTags(TAG_CATEGORY_MAP[key], 1, 2);
  }

  for (const key of supportingKeys) {
    if (lockedKeys.includes(key)) continue;
    next[key] = drawTags(TAG_CATEGORY_MAP[key], 0, 2);
  }

  return next;
}
