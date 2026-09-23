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

export type GenderCode = 'female' | 'male' | 'neutral';

/**
 * Tags that never take part in gender opposition, either because they carry
 * both anatomies (futanari / futasub) or because they describe a
 * gender-variant or mixed scenario rather than a fixed binary gender.
 * Selecting them neither excludes gendered tags nor gets excluded by them.
 */
const GENDER_NEUTRAL_TAGS: ReadonlySet<string> = new Set([
  'futanari',
  'futasub',
  'futapov',
  'transgender',
  'trans',
  'non-binary',
  'nonbinary',
  'androgynous',
  'gender_bender',
  'genderbender',
  'ftm_trans',
  'ftm',
  'mtf_trans',
  'mtf',
  'intersex',
  'hermaphrodite',
  'bigender',
  'genderfluid',
  'agender',
]);

/**
 * Whole tags that are gendered but carry no recognizable gender token,
 * so the token patterns below would miss them.
 */
const FEMALE_WHOLE_TAGS: ReadonlySet<string> = new Set([
  'milf',
  'gilf',
  'goddess',
  'succubus',
  'mermaid',
  'amazon',
  'princess',
  'queen',
  'witch',
  'nun',
  'actress',
  'hag',
  'giantess',
  'cheerleader',
  'femdom',
  'soft_femdom',
  'gentle_femdom',
  'cuckquean',
  'tomboy',
  'bitch',
  'bitchy',
  'bimbo',
  'yuri',
]);

const MALE_WHOLE_TAGS: ReadonlySet<string> = new Set([
  'incubus',
  'dilf',
  'himbo',
  'prince',
  'maledom',
  'femboydom',
  'trap',
  'twink',
  'sissy',
  'bara',
  'mpreg',
]);

/**
 * Exact snake_case tokens that gender a tag. Matched per token (split on
 * `_`/`-`) so `human` never matches `man` and `woman` never matches `man`.
 * Compounds containing a `girl`/`boy` substring anywhere (cat_girl,
 * foxgirl, monster_boy, girlfriend) are caught by the substring checks
 * in genderCodeOfTag instead.
 */
const FEMALE_TOKENS: ReadonlySet<string> = new Set([
  'female',
  'woman',
  'wife',
  'sister',
  'sisters',
  'daughter',
  'mother',
  'mommy',
  'mom',
  'aunt',
  'niece',
  'widow',
  'lady',
  'maid',
  'mistress',
  'madam',
  'bride',
  'motherly',
  'dominatrix',
  'domme',
]);

const MALE_TOKENS: ReadonlySet<string> = new Set([
  'male',
  'man',
  'husband',
  'son',
  'brother',
  'brothers',
  'father',
  'daddy',
  'uncle',
  'nephew',
  'groom',
  'widower',
]);

/**
 * Classify a tag's gender coding for exclusion purposes. Works on built-in
 * and custom tags alike: explicit whole-tag lists first, then token
 * patterns. Tags signalling both sides at once (father-daughter,
 * mother_and_son) and unrecognized tags are neutral, so mixed scenarios
 * stay selectable and unknown tags fail open instead of over-blocking.
 */
export function genderCodeOfTag(tag: string): GenderCode {
  const normalized = tag.trim().toLowerCase();
  if (GENDER_NEUTRAL_TAGS.has(normalized)) return 'neutral';
  if (FEMALE_WHOLE_TAGS.has(normalized)) return 'female';
  if (MALE_WHOLE_TAGS.has(normalized)) return 'male';
  const tokens = normalized.split(/[_-]+/);
  const female = tokens.some((token) => token.includes('girl') || FEMALE_TOKENS.has(token));
  const male = tokens.some((token) => token.includes('boy') || MALE_TOKENS.has(token));
  if (female && male) return 'neutral';
  if (female) return 'female';
  if (male) return 'male';
  return 'neutral';
}

/**
 * Tag exclusion rules - if a tag is selected, these tags should be excluded from random selection
 *
 * Gender opposition (female-coded vs male-coded, e.g. slime_girl vs
 * catboy) is derived dynamically from genderCodeOfTag in
 * addExclusionsForTag, so every built-in and custom tag is covered.
 * The static rules below only handle non-gender conflicts.
 */

const FEMALE_APPENDAGE_EXCLUSIONS = ['large_penis', 'small_penis', 'huge_balls'] as const;
const MALE_APPENDAGE_EXCLUSIONS = ['huge_breasts', 'small_breasts'] as const;

/**
 * Male-coded tags exempt from the breast exclusion (crossdressing
 * context). Every other male-coded tag excludes breast appearance tags.
 */
const MALE_BREAST_ALLOWED_TAGS: ReadonlySet<string> = new Set([
  'femboy',
  'catboy',
  'twink',
  'trap',
  'sissy',
  'femboydom',
]);

type TagExclusionRule = {
  when: readonly string[];
  exclude: readonly string[];
};

const exclusionRules: readonly TagExclusionRule[] = [
  { when: ['large_penis'], exclude: ['small_penis'] },
  { when: ['small_penis'], exclude: ['large_penis'] },
  { when: ['huge_breasts'], exclude: ['small_breasts'] },
  { when: ['small_breasts'], exclude: ['huge_breasts'] },
  { when: ['lesbian', 'wlw', 'yuri'], exclude: ['gay', 'mlm', 'bara'] },
  { when: ['gay', 'mlm', 'bara'], exclude: ['lesbian', 'wlw', 'yuri'] },
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
 * All built-in tags split by gender coding, computed lazily so the
 * classifier (not a hand-maintained list) is the single source of truth.
 */
let femaleGenderedTags: ReadonlySet<string> | null = null;
let maleGenderedTags: ReadonlySet<string> | null = null;

function genderedTagPools(): { female: ReadonlySet<string>; male: ReadonlySet<string> } {
  if (!femaleGenderedTags || !maleGenderedTags) {
    const female = new Set<string>();
    const male = new Set<string>();
    for (const tags of Object.values(TAG_CATEGORY_MAP)) {
      for (const tag of tags) {
        const code = genderCodeOfTag(tag);
        if (code === 'female') female.add(tag);
        else if (code === 'male') male.add(tag);
      }
    }
    femaleGenderedTags = female;
    maleGenderedTags = male;
  }
  return { female: femaleGenderedTags, male: maleGenderedTags };
}

/**
 * Get all tags that should be excluded based on currently selected tags.
 * Combines the static rules above with dynamic gender opposition, so a
 * selected female-coded tag excludes every male-coded tag (and
 * penis/balls appearance tags) and vice versa.
 */
function getExcludedTags(currentSelections: Record<string, string[]>): Set<string> {
  const excluded = new Set<string>();

  // Collect all currently selected tags across all categories
  const allSelected = Object.values(currentSelections).flat();

  // For each selected tag, add its exclusions to the set
  for (const tag of allSelected) {
    addExclusionsForTag(excluded, tag);
  }

  return excluded;
}

function addExclusionsForTag(excludedTags: Set<string>, tag: string): void {
  const exclusions = TAG_EXCLUSIONS[tag];
  if (exclusions) {
    for (const excludedTag of exclusions) {
      excludedTags.add(excludedTag);
    }
  }

  const pools = genderedTagPools();
  const code = genderCodeOfTag(tag);
  if (code === 'female') {
    for (const opposite of pools.male) {
      if (opposite !== tag) excludedTags.add(opposite);
    }
    for (const excludedTag of FEMALE_APPENDAGE_EXCLUSIONS) {
      excludedTags.add(excludedTag);
    }
  } else if (code === 'male') {
    for (const opposite of pools.female) {
      if (opposite !== tag) excludedTags.add(opposite);
    }
    if (!MALE_BREAST_ALLOWED_TAGS.has(tag)) {
      for (const excludedTag of MALE_APPENDAGE_EXCLUSIONS) {
        excludedTags.add(excludedTag);
      }
    }
  }

  // Reverse appendage rules: picking the anatomy implies the gender side.
  if ((FEMALE_APPENDAGE_EXCLUSIONS as readonly string[]).includes(tag)) {
    for (const femaleTag of pools.female) {
      if (femaleTag !== tag) excludedTags.add(femaleTag);
    }
  }
  if ((MALE_APPENDAGE_EXCLUSIONS as readonly string[]).includes(tag)) {
    for (const maleTag of pools.male) {
      if (maleTag !== tag && !MALE_BREAST_ALLOWED_TAGS.has(maleTag)) {
        excludedTags.add(maleTag);
      }
    }
  }
}

/**
 * Get all tags that should be excluded based on currently selected tags
 * (exported for UI). Pass every rendered tag as `candidates` so custom
 * tags — which the built-in pools cannot know — get the same gender
 * opposition treatment in the browser.
 */
export function getExcludedTagsForUI(
  currentSelections: Record<string, string[]>,
  candidates: readonly string[] = [],
): Set<string> {
  const excluded = getExcludedTags(currentSelections);
  if (candidates.length > 0) {
    const selectedCodes = new Set(
      Object.values(currentSelections).flat().map(genderCodeOfTag),
    );
    for (const candidate of candidates) {
      const code = genderCodeOfTag(candidate);
      if (code === 'neutral') continue;
      if (selectedCodes.has(code === 'female' ? 'male' : 'female')) {
        excluded.add(candidate);
      }
    }
  }
  return excluded;
}

/**
 * Gender codes present in a selections record, ignoring neutral tags.
 * Used to keep custom tags — which the built-in exclusion map cannot
 * know — coherent during random draws.
 */
function selectedGenderCodes(selections: Record<string, string[]>): Set<GenderCode> {
  const codes = new Set<GenderCode>();
  for (const tag of Object.values(selections).flat()) {
    const code = genderCodeOfTag(tag);
    if (code !== 'neutral') codes.add(code);
  }
  return codes;
}

/**
 * Draw a random number of tags from a pool, respecting min/max constraints
 * and exclusions. `selectedCodes` tracks genders picked so far (including
 * custom tags) and is updated as this draw picks, so a custom opposite-
 * gender candidate can never slip in alongside an earlier pick.
 */
function drawTags(
  pool: readonly string[],
  min: number,
  max: number,
  excludedTags: Set<string>,
  selectedCodes: Set<GenderCode> = new Set(),
): string[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  if (count <= 0) return [];

  const selected: string[] = [];

  for (const tag of shuffle(pool)) {
    if (selected.length >= count) break;
    if (excludedTags.has(tag)) continue;
    const code = genderCodeOfTag(tag);
    if (code !== 'neutral' && selectedCodes.has(code === 'female' ? 'male' : 'female')) continue;

    selected.push(tag);
    if (code !== 'neutral') selectedCodes.add(code);
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
 * Pass merged pools via `options.pools` (e.g. built-ins plus user custom
 * tags) so custom tags can be drawn; otherwise the built-in pools are used.
 * Locked selections — custom or not — still exert exclusions on the draw.
 *
 * Tags are selected with exclusion rules to prevent conflicting tags (e.g., male/female, mother/father).
 */
export function randomizeTags(
  currentSelections: Record<string, string[]>,
  lockedKeys: readonly string[] = [],
  options: { includeNsfw?: boolean; pools?: Record<string, readonly string[]> } = {},
): Record<string, string[]> {
  const includeNsfw = options.includeNsfw ?? true;
  const pools = options.pools ?? TAG_CATEGORY_MAP;
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
  const codes = selectedGenderCodes(next);

  for (const key of coreCategoryKeys) {
    if (lockedKeys.includes(key)) continue;
    next[key] = drawTags(pools[key] ?? [], 1, 2, excludedTags, codes);
    // Update exclusions after each selection
    excludedTags = getExcludedTags(next);
  }

  for (const key of supportingKeys) {
    if (lockedKeys.includes(key)) continue;
    next[key] = drawTags(pools[key] ?? [], 0, 2, excludedTags, codes);
    // Update exclusions after each selection
    excludedTags = getExcludedTags(next);
  }

  for (const key of flavorKeys) {
    if (lockedKeys.includes(key)) continue;
    if (key === 'kink_fetish' && !includeNsfw) continue;
    next[key] = drawTags(pools[key] ?? [], 0, 1, excludedTags, codes);
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

export const STUDIO_FAVORITES_CHANGED_EVENT = 'charactervault:studio-favorites-changed';

export function notifyFavoritesChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STUDIO_FAVORITES_CHANGED_EVENT));
  }
}

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

export function setFavoriteTags(refs: TaggedRef[]): TaggedRef[] {
  const seen = new Set<string>();
  const next = refs.filter((r) => {
    if (typeof r?.category !== 'string' || typeof r?.tag !== 'string') return false;
    if (!r.category || !r.tag) return false;
    const key = `${r.category}:${r.tag}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  writeTagRefList(FAVORITE_TAGS_KEY, next);
  return next;
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
