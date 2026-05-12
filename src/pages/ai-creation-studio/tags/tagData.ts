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
 *
 * Appendage logic:
 *   - Female-coded tags exclude penis/balls appearance tags (large_penis, small_penis, huge_balls)
 *   - Male-coded tags exclude breast appearance tags (huge_breasts, small_breasts)
 *   - futanari / futasub are intentionally exempt — they have both
 *   - femboy / trap / twink / catboy are male but keep breast exclusion removed (crossdressing context)
 */

// Shared appendage exclusion lists
const FEMALE_APPENDAGE_EXCLUSIONS = ['large_penis', 'small_penis', 'huge_balls'];
const MALE_APPENDAGE_EXCLUSIONS = ['huge_breasts', 'small_breasts'];

const TAG_EXCLUSIONS: Record<string, string[]> = {
  // Female-related tags exclude male-related tags + male appendages
  'female': ['male', 'boy', 'man', 'father', 'son', 'brother', 'big_brother', 'daddy', 'dilf', 'husband', 'boyfriend', 'femboy', 'catboy', 'monster_boy', 'twink', 'trap', 'incubus', 'old_man', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'woman': ['male', 'boy', 'man', 'father', 'son', 'brother', 'big_brother', 'daddy', 'dilf', 'husband', 'boyfriend', 'femboy', 'catboy', 'monster_boy', 'twink', 'trap', 'incubus', 'old_man', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'girl': ['male', 'boy', 'man', 'father', 'son', 'brother', 'big_brother', 'daddy', 'dilf', 'husband', 'boyfriend', 'femboy', 'catboy', 'monster_boy', 'twink', 'trap', 'incubus', 'old_man', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'strong_woman': ['male', 'boy', 'man', 'father', 'son', 'brother', 'big_brother', 'daddy', 'dilf', 'husband', 'boyfriend', 'femboy', 'catboy', 'monster_boy', 'twink', 'trap', 'incubus', 'old_man', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'grown_woman': ['male', 'boy', 'man', 'father', 'son', 'brother', 'big_brother', 'daddy', 'dilf', 'husband', 'boyfriend', 'femboy', 'catboy', 'monster_boy', 'twink', 'trap', 'incubus', 'old_man', ...FEMALE_APPENDAGE_EXCLUSIONS],
  
  // Male-related tags exclude female-related tags + female appendages
  'male': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman', ...MALE_APPENDAGE_EXCLUSIONS],
  'boy': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman', ...MALE_APPENDAGE_EXCLUSIONS],
  'man': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman', ...MALE_APPENDAGE_EXCLUSIONS],
  // femboy/catboy/twink/trap: male identity but crossdressing context — exclude female identity tags but NOT breast tags
  'femboy': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman'],
  'catboy': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman'],
  'monster_boy': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman', ...MALE_APPENDAGE_EXCLUSIONS],
  'twink': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman'],
  'trap': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman'],
  'incubus': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman', ...MALE_APPENDAGE_EXCLUSIONS],
  'old_man': ['female', 'woman', 'girl', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'milf', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'strong_woman', 'grown_woman', ...MALE_APPENDAGE_EXCLUSIONS],

  // Appendage tags themselves — exclude conflicting appendages and mismatched gender identities
  'large_penis': ['female', 'woman', 'girl', 'strong_woman', 'grown_woman', 'milf', 'gilf', 'mother', 'daughter', 'sister', 'big_sister', 'wife', 'girlfriend', 'widow', 'muscle_mommy', 'sugar_mommy', 'mommy_dom', 'dommy_mommy', 'aunt', 'stepmother', 'small_penis'],
  'small_penis': ['female', 'woman', 'girl', 'strong_woman', 'grown_woman', 'milf', 'gilf', 'mother', 'daughter', 'sister', 'big_sister', 'wife', 'girlfriend', 'widow', 'muscle_mommy', 'sugar_mommy', 'mommy_dom', 'dommy_mommy', 'aunt', 'stepmother', 'large_penis'],
  'huge_balls': ['female', 'woman', 'girl', 'strong_woman', 'grown_woman', 'milf', 'gilf', 'mother', 'daughter', 'sister', 'big_sister', 'wife', 'girlfriend', 'widow', 'muscle_mommy', 'sugar_mommy', 'mommy_dom', 'dommy_mommy', 'aunt', 'stepmother'],
  'huge_breasts': ['male', 'boy', 'man', 'monster_boy', 'incubus', 'old_man', 'small_breasts'],
  'small_breasts': ['male', 'boy', 'man', 'monster_boy', 'incubus', 'old_man', 'huge_breasts'],
  
  // Family role exclusions (female roles also exclude male appendages)
  'mother': ['father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'father': ['mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', ...MALE_APPENDAGE_EXCLUSIONS],
  'daughter': ['father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'son': ['mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'wife', 'girlfriend', 'aunt', 'stepmother', ...MALE_APPENDAGE_EXCLUSIONS],
  'sister': ['father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'brother': ['mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'wife', 'girlfriend', 'aunt', 'stepmother', ...MALE_APPENDAGE_EXCLUSIONS],
  'big_sister': ['father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'big_brother': ['mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'wife', 'girlfriend', 'aunt', 'stepmother', ...MALE_APPENDAGE_EXCLUSIONS],
  'aunt': ['father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'stepmother': ['father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'stepsister': ['father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend', ...FEMALE_APPENDAGE_EXCLUSIONS],
  
  // Relationship exclusions (female roles also exclude male appendages)
  'wife': ['husband', 'boyfriend', 'father', 'son', 'brother', 'big_brother', 'daddy', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'loving_wife': ['husband', 'boyfriend', 'father', 'son', 'brother', 'big_brother', 'daddy', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'husband': ['wife', 'girlfriend', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'aunt', 'stepmother', 'loving_wife', ...MALE_APPENDAGE_EXCLUSIONS],
  'girlfriend': ['boyfriend', 'husband', 'father', 'son', 'brother', 'big_brother', 'daddy', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'boyfriend': ['girlfriend', 'wife', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'aunt', 'stepmother', 'loving_wife', ...MALE_APPENDAGE_EXCLUSIONS],
  
  // Specific gendered roles
  'mommy_dom': ['daddy', 'father', 'son', 'brother', 'big_brother', 'husband', 'boyfriend', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'dommy_mommy': ['daddy', 'father', 'son', 'brother', 'big_brother', 'husband', 'boyfriend', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'daddy': ['mother', 'mommy_dom', 'dommy_mommy', 'daughter', 'sister', 'big_sister', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'loving_wife', ...MALE_APPENDAGE_EXCLUSIONS],
  'muscle_mommy': ['daddy', 'father', 'son', 'brother', 'big_brother', 'husband', 'boyfriend', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'sugar_mommy': ['daddy', 'father', 'son', 'brother', 'big_brother', 'husband', 'boyfriend', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'milf': ['dilf', 'father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend', 'old_man', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'dilf': ['milf', 'gilf', 'mother', 'daughter', 'sister', 'big_sister', 'mommy_dom', 'dommy_mommy', 'wife', 'girlfriend', 'aunt', 'stepmother', 'muscle_mommy', 'sugar_mommy', 'widow', 'loving_wife', ...MALE_APPENDAGE_EXCLUSIONS],
  'gilf': ['dilf', 'father', 'son', 'brother', 'big_brother', 'daddy', 'husband', 'boyfriend', 'old_man', ...FEMALE_APPENDAGE_EXCLUSIONS],
  'widow': ['husband', 'boyfriend', 'father', 'son', 'brother', 'big_brother', 'daddy', ...FEMALE_APPENDAGE_EXCLUSIONS],
  
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
