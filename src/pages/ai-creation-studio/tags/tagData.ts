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
import dynamicTags from './dynamic.json';
import kinkTags from './kink_fetish.json';
import generationTags from './generation.json';

export type TagCategoryKey = 'identity' | 'personality' | 'role' | 'genre' | 'tone' | 'appearance' | 'dynamic' | 'kink_fetish' | 'generation';

export type GenerationTagKey = 
  | 'first_person'
  | 'second_person'
  | 'third_person'
  | 'first_person_you'
  | 'present_tense'
  | 'past_tense';

export interface TagCategory {
  key: TagCategoryKey;
  label: string;
  tags: string[];
  nsfw?: boolean;
  custom?: boolean;
}

export type TagSelections = Record<TagCategoryKey, string[]>;

export const PERSPECTIVE_TAGS = [
  'first_person',
  'second_person',
  'third_person',
  'first_person_you',
] as const satisfies readonly GenerationTagKey[];

export const TENSE_TAGS = [
  'present_tense',
  'past_tense',
] as const satisfies readonly GenerationTagKey[];

export type PerspectiveTag = typeof PERSPECTIVE_TAGS[number];
export type TenseTag = typeof TENSE_TAGS[number];

export interface GenerationStyleTags {
  perspective: PerspectiveTag | null;
  tense: TenseTag | null;
}

function isPerspectiveTag(tag: string): tag is PerspectiveTag {
  return PERSPECTIVE_TAGS.includes(tag as PerspectiveTag);
}

function isTenseTag(tag: string): tag is TenseTag {
  return TENSE_TAGS.includes(tag as TenseTag);
}

/**
 * Tag exclusion rules - if a tag is selected, these tags should be excluded from random selection
 *
 * Appendage logic:
 *   - Female-coded tags exclude penis/balls appearance tags (large_penis, small_penis, huge_balls)
 *   - Male-coded tags exclude breast appearance tags (huge_breasts, small_breasts)
 *   - futanari / futasub are intentionally exempt — they have both
 *   - femboy / trap / twink / catboy are male but keep breast exclusion removed (crossdressing context)
 */

const FEMALE_APPENDAGE_EXCLUSIONS = ['large_penis', 'small_penis', 'huge_balls'] as const;
const MALE_APPENDAGE_EXCLUSIONS = ['huge_breasts', 'small_breasts'] as const;

const FEMALE_IDENTITY_TAGS = [
  'female',
  'woman',
  'girl',
  'strong_woman',
  'grown_woman',
] as const;

const FEMALE_ROLE_TAGS = [
  'mother',
  'daughter',
  'sister',
  'big_sister',
  'mommy_dom',
  'dommy_mommy',
  'milf',
  'gilf',
  'wife',
  'loving_wife',
  'girlfriend',
  'aunt',
  'stepmother',
  'stepsister',
  'muscle_mommy',
  'sugar_mommy',
  'widow',
] as const;

const MALE_IDENTITY_TAGS = [
  'male',
  'boy',
  'man',
  'monster_boy',
  'incubus',
  'old_man',
] as const;

const MALE_CROSSDRESSING_TAGS = ['femboy', 'catboy', 'twink', 'trap', 'sissy'] as const;

const MALE_ROLE_TAGS = [
  'father',
  'son',
  'brother',
  'big_brother',
  'daddy',
  'dilf',
  'husband',
  'boyfriend',
] as const;

const FEMALE_CODED_TAGS = [...FEMALE_IDENTITY_TAGS, ...FEMALE_ROLE_TAGS] as const;
const MALE_CODED_TAGS = [...MALE_IDENTITY_TAGS, ...MALE_CROSSDRESSING_TAGS, ...MALE_ROLE_TAGS] as const;

const MALE_BREAST_ALLOWED_TAGS = MALE_CROSSDRESSING_TAGS;

type TagExclusionRule = {
  when: readonly string[];
  exclude: readonly string[];
};

const exclusionRules: readonly TagExclusionRule[] = [
  {
    when: FEMALE_CODED_TAGS,
    exclude: [...MALE_CODED_TAGS, ...FEMALE_APPENDAGE_EXCLUSIONS],
  },
  {
    when: [...FEMALE_APPENDAGE_EXCLUSIONS],
    exclude: FEMALE_CODED_TAGS,
  },
  {
    when: [...MALE_IDENTITY_TAGS, ...MALE_ROLE_TAGS],
    exclude: [...FEMALE_CODED_TAGS, ...MALE_APPENDAGE_EXCLUSIONS],
  },
  {
    when: MALE_BREAST_ALLOWED_TAGS,
    exclude: FEMALE_CODED_TAGS,
  },
  {
    when: MALE_APPENDAGE_EXCLUSIONS,
    exclude: [...MALE_IDENTITY_TAGS, ...MALE_ROLE_TAGS],
  },
  { when: ['large_penis'], exclude: ['small_penis'] },
  { when: ['small_penis'], exclude: ['large_penis'] },
  { when: ['huge_breasts'], exclude: ['small_breasts'] },
  { when: ['small_breasts'], exclude: ['huge_breasts'] },
  { when: ['lesbian', 'wlw'], exclude: ['gay', 'mlm'] },
  { when: ['gay', 'mlm'], exclude: ['lesbian', 'wlw'] },
];

function buildTagExclusions(rules: readonly TagExclusionRule[]): Record<string, string[]> {
  const map: Record<string, Set<string>> = {};

  for (const { when, exclude } of rules) {
    for (const tag of when) {
      map[tag] ??= new Set<string>();
      for (const excludedTag of exclude) {
        if (excludedTag !== tag) {
          map[tag].add(excludedTag);
        }
      }
    }
  }

  return Object.fromEntries(
    Object.entries(map).map(([tag, exclusions]) => [tag, [...exclusions]])
  );
}

const TAG_EXCLUSIONS = buildTagExclusions(exclusionRules);

export const TAG_CATEGORIES: readonly TagCategory[] = [
  { key: 'generation', label: 'Generation', tags: generationTags },
  { key: 'identity', label: 'Identity', tags: identityTags },
  { key: 'personality', label: 'Personality', tags: personalityTags },
  { key: 'role', label: 'Role', tags: roleTags },
  { key: 'genre', label: 'Genre', tags: genreTags },
  { key: 'tone', label: 'Tone', tags: toneTags },
  { key: 'appearance', label: 'Appearance', tags: appearanceTags },
  { key: 'dynamic', label: 'Dynamic', tags: dynamicTags },
  { key: 'kink_fetish', label: 'Kink & Fetish', tags: kinkTags, nsfw: true },
] as const;

const TAG_CATEGORY_MAP: Record<TagCategoryKey, string[]> = {
  identity: identityTags,
  personality: personalityTags,
  role: roleTags,
  genre: genreTags,
  tone: toneTags,
  appearance: appearanceTags,
  dynamic: dynamicTags,
  kink_fetish: kinkTags,
  generation: generationTags,
};

/** Category keys treated as NSFW (hidden when the NSFW filter is on). */
export const NSFW_TAG_CATEGORIES: readonly string[] = TAG_CATEGORIES.filter((c) => c.nsfw).map(
  (c) => c.key
);

/**
 * Format a snake_case tag to human-readable Title Case.
 * Handles special cases for generation tags.
 */
export function formatTag(tag: string): string {
  // Special case for first_person_you generation tag
  if (tag === 'first_person_you') {
    return "1st person (refer to {{user}} as 'you')";
  }

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
  const order: TagCategoryKey[] = ['identity', 'role', 'personality', 'genre', 'appearance', 'tone', 'dynamic', 'kink_fetish'];

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

function addExclusionsForTag(excludedTags: Set<string>, tag: string): void {
  const exclusions = TAG_EXCLUSIONS[tag];
  if (!exclusions) return;

  for (const excludedTag of exclusions) {
    excludedTags.add(excludedTag);
  }
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

  const selected: string[] = [];

  for (const tag of shuffle(pool)) {
    if (selected.length >= count) break;
    if (excludedTags.has(tag)) continue;

    selected.push(tag);
    addExclusionsForTag(excludedTags, tag);
  }

  return selected;
}

/**
 * Randomly select tags across categories.
 *
 * Core categories (identity, role, personality): always 1–2 tags each
 * Supporting categories (genre, appearance, tone): 0–2 tags each
 * Flavor categories (dynamic, kink_fetish): 0–1 tags each (kink skipped when NSFW is off)
 *
 * `lockedKeys` prevent overwriting existing selections in those categories.
 *
 * Tags are selected with exclusion rules to prevent conflicting tags (e.g., male/female, mother/father).
 */
export function randomizeTags(
  currentSelections: Record<string, string[]>,
  lockedKeys: readonly string[] = [],
  options: { includeNsfw?: boolean } = {}
): Record<string, string[]> {
  const includeNsfw = options.includeNsfw ?? true;
  const next: Record<string, string[]> = { ...currentSelections };

  const coreCategoryKeys: TagCategoryKey[] = ['identity', 'role', 'personality'];
  const supportingKeys: TagCategoryKey[] = ['genre', 'appearance', 'tone'];
  const flavorKeys: TagCategoryKey[] = ['dynamic', 'kink_fetish'];
  const randomizedKeys: TagCategoryKey[] = [...coreCategoryKeys, ...supportingKeys, ...flavorKeys];

  for (const key of randomizedKeys) {
    if (!lockedKeys.includes(key)) {
      next[key] = [];
    }
  }

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

  for (const key of flavorKeys) {
    if (lockedKeys.includes(key)) continue;
    if (key === 'kink_fetish' && !includeNsfw) continue;
    next[key] = drawTags(TAG_CATEGORY_MAP[key], 0, 1, excludedTags);
    // Update exclusions after each selection
    excludedTags = getExcludedTags(next);
  }

  return next;
}

/**
 * Extract perspective and tense generation tags from tag selections.
 * Returns null for each if no matching tag is selected.
 */
export function getGenerationTags(selections: Record<string, string[]>): {
  perspective: PerspectiveTag | null;
  tense: TenseTag | null;
} {
  const generationTags = selections['generation'] ?? [];
  const perspective = generationTags.find(isPerspectiveTag) ?? null;
  const tense = generationTags.find(isTenseTag) ?? null;
  return { perspective, tense };
}

export function hasRequiredGenerationTags(selections: Record<string, string[]>): boolean {
  const { perspective, tense } = getGenerationTags(selections);
  return Boolean(perspective && tense);
}

export function toggleGenerationTagSelection(
  current: readonly string[],
  tag: string
): string[] {
  const exists = current.includes(tag);

  if (isPerspectiveTag(tag)) {
    const updated = current.filter((t) => !isPerspectiveTag(t));
    return exists ? updated : [...updated, tag];
  }

  if (isTenseTag(tag)) {
    const updated = current.filter((t) => !isTenseTag(t));
    return exists ? updated : [...updated, tag];
  }

  return [...current];
}

/**
 * Return the default generation tag values used when no generation tags are selected.
 */
export function getDefaultGenerationTags(): {
  perspective: string;
  tense: string;
} {
  return {
    perspective: 'third_person',
    tense: 'present_tense',
  };
}

/**
 * Normalize raw user input into a tag slug (lowercase snake_case, max 40 chars).
 * Returns '' when nothing usable remains.
 */
export function normalizeTagSlug(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return slug;
}

/**
 * Find the category that already owns a tag slug, checking built-in tags
 * then custom tags. Returns the first match in TAG_CATEGORIES order.
 */
export function findTagCategory(
  slug: string,
  customTags: Record<string, string[]> = {}
): TagCategory | null {
  if (!slug) return null;
  for (const cat of TAG_CATEGORIES) {
    if (cat.tags.includes(slug)) return cat;
    const extras = customTags[cat.key] ?? [];
    if (extras.includes(slug)) return cat;
  }
  return null;
}

/**
 * Validate and slugify a new custom tag. Rejects empty input, unknown or
 * Generation categories, and slugs that already exist in any category.
 */
export function resolveNewCustomTag(
  categoryKey: string,
  raw: string,
  customTags: Record<string, string[]> = {}
): { ok: true; slug: string } | { ok: false; error: string } {
  if (categoryKey === 'generation') {
    return { ok: false, error: 'Custom tags cannot be added to Generation.' };
  }
  const slug = normalizeTagSlug(raw);
  if (!slug) {
    return { ok: false, error: 'Use letters and numbers — e.g. "space pirate".' };
  }
  const base = TAG_CATEGORIES.find((c) => c.key === categoryKey);
  if (!base) return { ok: false, error: 'Unknown category.' };
  const owner = findTagCategory(slug, customTags);
  if (owner) {
    return { ok: false, error: `This tag already exists in ${owner.label} category.` };
  }
  return { ok: true, slug };
}

/**
 * Merge user custom tags into a copy of the base categories.
 * Unknown category keys and duplicates are ignored.
 */
export function mergeCustomTags(
  base: readonly TagCategory[],
  customTags: Record<string, string[]>
): TagCategory[] {
  return base.map((cat) => {
    const extra = (customTags[cat.key] ?? []).filter(
      (t) => typeof t === 'string' && t && !cat.tags.includes(t)
    );
    if (extra.length === 0) return { ...cat, tags: [...cat.tags] };
    return { ...cat, tags: [...cat.tags, ...extra] };
  });
}

/**
 * Check whether a tag in a category is user-created (not in the built-in set).
 */
export function isCustomTag(categoryKey: string, tag: string): boolean {
  const builtIn = (TAG_CATEGORY_MAP as Record<string, string[]>)[categoryKey];
  if (!builtIn) return true;
  return !builtIn.includes(tag);
}

export interface TagVisibility {
  hideNsfw: boolean;
  hiddenCategories: readonly string[];
}

/**
 * Filter categories for browsing: drop hidden categories and, when
 * hideNsfw is on, NSFW categories.
 */
export function getVisibleCategories(
  categories: readonly TagCategory[],
  visibility: TagVisibility
): TagCategory[] {
  return categories.filter((cat) => {
    if (visibility.hiddenCategories.includes(cat.key)) return false;
    if (visibility.hideNsfw && cat.nsfw) return false;
    return true;
  });
}

const FAVORITE_TAGS_KEY = 'cv-studio-favorite-tags';
const RECENT_TAGS_KEY = 'cv-studio-recent-tags';
const MAX_RECENT_TAGS = 12;

export interface TaggedRef {
  category: string;
  tag: string;
}

function readTagRefList(key: string): TaggedRef[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is TaggedRef =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as TaggedRef).category === 'string' &&
        typeof (e as TaggedRef).tag === 'string'
    );
  } catch {
    return [];
  }
}

function writeTagRefList(key: string, list: TaggedRef[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Storage may be unavailable — favorites/recent are best-effort.
  }
}

export function getFavoriteTags(): TaggedRef[] {
  return readTagRefList(FAVORITE_TAGS_KEY);
}

export function isFavoriteTag(category: string, tag: string): boolean {
  return getFavoriteTags().some((f) => f.category === category && f.tag === tag);
}

export function toggleFavoriteTag(category: string, tag: string): TaggedRef[] {
  const current = getFavoriteTags();
  const exists = current.some((f) => f.category === category && f.tag === tag);
  const next = exists
    ? current.filter((f) => !(f.category === category && f.tag === tag))
    : [...current, { category, tag }];
  writeTagRefList(FAVORITE_TAGS_KEY, next);
  return next;
}

export function getRecentTags(): TaggedRef[] {
  return readTagRefList(RECENT_TAGS_KEY);
}

export function pushRecentTags(refs: TaggedRef[]): TaggedRef[] {
  const merged = [...refs, ...getRecentTags()];
  const seen = new Set<string>();
  const deduped = merged.filter((r) => {
    const k = `${r.category}:${r.tag}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const next = deduped.slice(0, MAX_RECENT_TAGS);
  writeTagRefList(RECENT_TAGS_KEY, next);
  return next;
}
