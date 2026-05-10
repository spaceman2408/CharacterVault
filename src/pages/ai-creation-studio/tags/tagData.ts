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

/**
 * Tag exclusion rules - if a tag is selected, these tags should be excluded from random selection
 */
const TAG_EXCLUSIONS: Record<string, string[]> = {
  // Female-related tags exclude male-related tags
  'female': ['male', 'boy', 'man', 'father', 'son', 'brother', 'big_brother', 'daddy', 'dilf', 'husband', 'boyfriend', 'femboy', 'catboy', 'monster_boy', 'twink', 'trap', 'incubus', 'old_man'],
  'woman': ['male', 'boy', 'man', 'father', 'son', 'brother', 'big_brother', 'daddy', 'dilf', 'husband', 'boyfriend', 'femboy', 'catboy', 'monster_boy', 'twink', 'trap', 'incubus', 'old_man'],
  'girl': ['male', 'boy', 'man', 'father', 'son', 'brother', 'big_brother', 'daddy', 'dilf', 'husband', 'boyfriend', 'femboy', 'catboy', 'monster_boy', 'twink', 'trap', 'incubus', 'old_man'],
  'strong_woman': ['male', 'boy', 'man', 'father', 'son', 'brother', 'big_brother', 'daddy', 'dilf', 'husband', 'boyfriend', 'femboy', 'catboy', 'monster_boy', 'twink', 'trap', 'incubus', 'old_man'],
  'grown_woman': ['male', 'boy', 'man', 'father', 'son', 'brother', 'big_brother', 'daddy', 'dilf', 'husband', 'boyfriend', 'femboy', 'catboy', 'monster_boy', 'twink', 'trap', 'incubus', 'old_man'],
  
  // Male-related tags exclude female-related tags
  'male': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman'],
  'boy': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman'],
  'man': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman'],
  'femboy': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman'],
  'catboy': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman'],
  'monster_boy': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman'],
  'twink': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman'],
  'trap': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman'],
  'incubus': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman'],
  'old_man': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman'],
  
  // Family role exclusions
  'mother': ['father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend'],
  'father': ['mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy'],
  'daughter': ['father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend'],
  'son': ['mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'wife', 'girlfriend', 'aunt', 'stepmother'],
  'sister': ['father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend'],
  'brother': ['mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'wife', 'girlfriend', 'aunt', 'stepmother'],
  'big_sister': ['father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend'],
  'big_brother': ['mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'wife', 'girlfriend', 'aunt', 'stepmother'],
  'aunt': ['father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend'],
  'stepmother': ['father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend'],
  'stepsister': ['father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend'],
  
  // Relationship exclusions
  'wife': ['husband', 'boyfriend', 'father', 'son', 'brother', 'big_brother', 'daddy'],
  'loving_wife': ['husband', 'boyfriend', 'father', 'son', 'brother', 'big_brother', 'daddy'],
  'husband': ['wife', 'girlfriend', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'aunt', 'stepmother', 'loving_wife'],
  'girlfriend': ['boyfriend', 'husband', 'father', 'son', 'brother', 'big_brother', 'daddy'],
  'boyfriend': ['girlfriend', 'wife', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'aunt', 'stepmother', 'loving_wife'],
  
  // Specific gendered roles
  'mommy_dom': ['daddy', 'father', 'son', 'brother', 'big_brother', 'husband', 'boyfriend'],
  'dommy_mommy': ['daddy', 'father', 'son', 'brother', 'big_brother', 'husband', 'boyfriend'],
  'daddy': ['mother', 'mommy_dom', 'dommy_mommy', 'daughter', 'sister', 'big_sister', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'loving_wife'],
  'muscle_mommy': ['daddy', 'father', 'son', 'brother', 'big_brother', 'husband', 'boyfriend'],
  'sugar_mommy': ['daddy', 'father', 'son', 'brother', 'big_brother', 'husband', 'boyfriend'],
  'milf': ['dilf', 'father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend', 'old_man'],
  'dilf': ['milf', 'gilf', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'loving_wife'],
  'gilf': ['dilf', 'father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend', 'old_man'],
  'widow': ['husband', 'boyfriend', 'father', 'son', 'brother', 'big_brother', 'daddy'],
  
  // Sexual orientation exclusions
  'lesbian': ['gay', 'mlm'],
  'wlw': ['gay', 'mlm'],
  'gay': ['lesbian', 'wlw'],
  'mlm': ['lesbian', 'wlw'],
};

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
 * Get all tags that should be excluded based on currently selected tags
 */
function getExcludedTags(currentSelections: Record<string, string[]>): Set<string> {
  const excluded = new Set<string>();
  
  // Collect all currently selected tags across all categories
  const allSelected = Object.values(currentSelections).flat();
  
  // For each selected tag, add its exclusions to the set
  for (const tag of allSelected) {
    const exclusions = TAG_EXCLUSIONS[tag];
    if (exclusions) {
      exclusions.forEach(excludedTag => excluded.add(excludedTag));
    }
  }
  
  return excluded;
}

/**
 * Get all tags that should be excluded based on currently selected tags (exported for UI)
 */
export function getExcludedTagsForUI(currentSelections: Record<string, string[]>): Set<string> {
  return getExcludedTags(currentSelections);
}

/**
 * Draw a random number of tags from a pool, respecting min/max constraints and exclusions.
 */
function drawTags(
  pool: readonly string[], 
  min: number, 
  max: number, 
  excludedTags: Set<string>
): string[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  if (count <= 0) return [];
  
  // Filter out excluded tags
  const availablePool = pool.filter(tag => !excludedTags.has(tag));
  
  if (availablePool.length === 0) return [];
  
  const shuffled = shuffle(availablePool);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Randomly select tags across categories.
 *
 * Core categories (identity, role, personality): always 1–2 tags each
 * Supporting categories (genre, appearance, tone): 0–2 tags each
 *
 * `lockedKeys` prevent overwriting existing selections in those categories.
 * 
 * Tags are selected with exclusion rules to prevent conflicting tags (e.g., male/female, mother/father).
 */
export function randomizeTags(
  currentSelections: Record<string, string[]>,
  lockedKeys: readonly string[] = []
): Record<string, string[]> {
  const next: Record<string, string[]> = { ...currentSelections };

  const coreCategoryKeys: TagCategoryKey[] = ['identity', 'role', 'personality'];
  const supportingKeys: TagCategoryKey[] = ['genre', 'appearance', 'tone'];

  // Build exclusion set incrementally as we select tags
  let excludedTags = getExcludedTags(next);

  for (const key of coreCategoryKeys) {
    if (lockedKeys.includes(key)) continue;
    next[key] = drawTags(TAG_CATEGORY_MAP[key], 1, 2, excludedTags);
    // Update exclusions after each selection
    excludedTags = getExcludedTags(next);
  }

  for (const key of supportingKeys) {
    if (lockedKeys.includes(key)) continue;
    next[key] = drawTags(TAG_CATEGORY_MAP[key], 0, 2, excludedTags);
    // Update exclusions after each selection
    excludedTags = getExcludedTags(next);
  }

  return next;
}
