import { describe, expect, it } from 'vitest';
import {
  TAG_CATEGORIES,
  buildConceptFromTags,
  getVisibleCategories,
  isCustomTag,
  mergeCustomTags,
  normalizeTagSlug,
  randomizeTags,
} from '../../src/pages/ai-creation-studio/tags/tagData';

describe('normalizeTagSlug', () => {
  it('converts phrases to snake_case slugs', () => {
    expect(normalizeTagSlug('Space Pirate')).toBe('space_pirate');
    expect(normalizeTagSlug('  bimbofication!! ')).toBe('bimbofication');
    expect(normalizeTagSlug('sfw<->nsfw')).toBe('sfw_nsfw');
  });

  it('returns empty for unusable input', () => {
    expect(normalizeTagSlug('   ')).toBe('');
    expect(normalizeTagSlug('!!!')).toBe('');
  });
});

describe('new built-in categories', () => {
  it('includes dynamic and kink_fetish (nsfw)', () => {
    const keys = TAG_CATEGORIES.map((c) => c.key);
    expect(keys).toContain('dynamic');
    expect(keys).toContain('kink_fetish');
    expect(TAG_CATEGORIES.find((c) => c.key === 'kink_fetish')?.nsfw).toBe(true);
  });

  it('builds concepts with dynamic and kink tags last', () => {
    const concept = buildConceptFromTags({
      identity: ['elf'],
      dynamic: ['enemies_to_lovers'],
      kink_fetish: ['bondage'],
    });
    expect(concept).toBe('Elf, Enemies To Lovers, Bondage');
  });
});

describe('mergeCustomTags', () => {
  it('appends custom tags and ignores duplicates/unknown categories', () => {
    const merged = mergeCustomTags(TAG_CATEGORIES, {
      identity: ['space_pirate', 'elf'],
      nope: ['x'],
    });
    const identity = merged.find((c) => c.key === 'identity');
    expect(identity?.tags).toContain('space_pirate');
    expect(identity?.tags.filter((t) => t === 'elf')).toHaveLength(1);
    const baseToneCount = TAG_CATEGORIES.find((c) => c.key === 'tone')?.tags.length ?? 0;
    expect(merged.find((c) => c.key === 'tone')?.tags).toHaveLength(baseToneCount);
  });

  it('detects custom tags', () => {
    expect(isCustomTag('identity', 'space_pirate')).toBe(true);
    expect(isCustomTag('identity', 'elf')).toBe(false);
  });
});

describe('getVisibleCategories', () => {
  it('hides hidden and nsfw categories', () => {
    const visible = getVisibleCategories(TAG_CATEGORIES, {
      hideNsfw: true,
      hiddenCategories: ['tone'],
    });
    const keys = visible.map((c) => c.key);
    expect(keys).not.toContain('kink_fetish');
    expect(keys).not.toContain('tone');
    expect(keys).toContain('dynamic');
    expect(keys).toContain('generation');
  });
});

describe('randomizeTags with flavor categories', () => {
  it('skips kink tags when NSFW is off', () => {
    for (let i = 0; i < 30; i++) {
      const next = randomizeTags({}, [], { includeNsfw: false });
      expect(next['kink_fetish'] ?? []).toEqual([]);
    }
  });

  it('draws at most one dynamic/kink tag', () => {
    for (let i = 0; i < 30; i++) {
      const next = randomizeTags({});
      expect((next['dynamic'] ?? []).length).toBeLessThanOrEqual(1);
      expect((next['kink_fetish'] ?? []).length).toBeLessThanOrEqual(1);
      expect((next['identity'] ?? []).length).toBeGreaterThanOrEqual(1);
    }
  });
});
