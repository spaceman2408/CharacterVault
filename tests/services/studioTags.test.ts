import { describe, expect, it } from 'vitest';
import {
  TAG_CATEGORIES,
  buildConceptFromTags,
  genderCodeOfTag,
  getExcludedTagsForUI,
  getVisibleCategories,
  findTagCategory,
  isCustomTag,
  mergeCustomTags,
  normalizeTagSlug,
  randomizeTags,
  resolveNewCustomTag,
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

describe('findTagCategory', () => {
  it('finds built-in tags and custom tags across categories', () => {
    expect(findTagCategory('elf')?.key).toBe('identity');
    expect(findTagCategory('space_pirate', { role: ['space_pirate'] })?.key).toBe('role');
    expect(findTagCategory('missing')).toBeNull();
  });
});

describe('resolveNewCustomTag', () => {
  it('rejects a slug that already exists in another category', () => {
    const result = resolveNewCustomTag('personality', 'Elf');
    expect(result).toEqual({
      ok: false,
      error: 'This tag already exists in Identity category.',
    });
  });

  it('rejects a slug already saved as a custom tag elsewhere', () => {
    const result = resolveNewCustomTag('genre', 'space pirate', {
      identity: ['space_pirate'],
    });
    expect(result).toEqual({
      ok: false,
      error: 'This tag already exists in Identity category.',
    });
  });

  it('rejects a duplicate in the same category', () => {
    const result = resolveNewCustomTag('identity', 'elf');
    expect(result).toEqual({
      ok: false,
      error: 'This tag already exists in Identity category.',
    });
  });

  it('accepts a unique slug', () => {
    expect(resolveNewCustomTag('identity', 'Space Pirate')).toEqual({
      ok: true,
      slug: 'space_pirate',
    });
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

describe('genderCodeOfTag', () => {
  it('codes girl/boy variants by pattern', () => {
    expect(genderCodeOfTag('slime_girl')).toBe('female');
    expect(genderCodeOfTag('foxgirl')).toBe('female');
    expect(genderCodeOfTag('monster_girl')).toBe('female');
    expect(genderCodeOfTag('catboy')).toBe('male');
    expect(genderCodeOfTag('monster_boy')).toBe('male');
    expect(genderCodeOfTag('girlfriend')).toBe('female');
    expect(genderCodeOfTag('boyfriend')).toBe('male');
  });

  it('handles irregular and crossdressing tags', () => {
    expect(genderCodeOfTag('tomboy')).toBe('female');
    expect(genderCodeOfTag('goddess')).toBe('female');
    expect(genderCodeOfTag('nun')).toBe('female');
    expect(genderCodeOfTag('himbo')).toBe('male');
    expect(genderCodeOfTag('dilf')).toBe('male');
    expect(genderCodeOfTag('incubus')).toBe('male');
    expect(genderCodeOfTag('femboy')).toBe('male');
    expect(genderCodeOfTag('trap')).toBe('male');
    expect(genderCodeOfTag('femdom')).toBe('female');
    expect(genderCodeOfTag('maledom')).toBe('male');
  });

  it('leaves neutral, mixed, and ambiguous tags alone', () => {
    expect(genderCodeOfTag('human')).toBe('neutral');
    expect(genderCodeOfTag('non_human')).toBe('neutral');
    expect(genderCodeOfTag('elf')).toBe('neutral');
    expect(genderCodeOfTag('futanari')).toBe('neutral');
    expect(genderCodeOfTag('futasub')).toBe('neutral');
    expect(genderCodeOfTag('transgender')).toBe('neutral');
    expect(genderCodeOfTag('gender_bender')).toBe('neutral');
    expect(genderCodeOfTag('father-daughter')).toBe('neutral');
    expect(genderCodeOfTag('mother_and_son')).toBe('neutral');
    expect(genderCodeOfTag('knight')).toBe('neutral');
    expect(genderCodeOfTag('space_pirate')).toBe('neutral');
  });
});

describe('gender opposition exclusions', () => {
  it('blocks slime_girl with catboy in both directions', () => {
    expect(getExcludedTagsForUI({ identity: ['slime_girl'] }).has('catboy')).toBe(true);
    expect(getExcludedTagsForUI({ identity: ['catboy'] }).has('slime_girl')).toBe(true);
    expect(getExcludedTagsForUI({ identity: ['slime_girl'] }).has('femboy')).toBe(true);
    expect(getExcludedTagsForUI({ role: ['princess'] }).has('prince')).toBe(true);
  });

  it('extends appendage rules to pattern-coded tags', () => {
    const femaleExcluded = getExcludedTagsForUI({ identity: ['slime_girl'] });
    expect(femaleExcluded.has('large_penis')).toBe(true);
    expect(femaleExcluded.has('huge_balls')).toBe(true);
    const maleExcluded = getExcludedTagsForUI({ identity: ['himbo'] });
    expect(maleExcluded.has('huge_breasts')).toBe(true);
  });

  it('lets crossdressing male tags keep breasts', () => {
    const excluded = getExcludedTagsForUI({ identity: ['catboy'] });
    expect(excluded.has('huge_breasts')).toBe(false);
    expect(excluded.has('small_breasts')).toBe(false);
  });

  it('exempts futanari from gender opposition', () => {
    const excluded = getExcludedTagsForUI({ identity: ['female', 'futanari'] });
    expect(excluded.has('futanari')).toBe(false);
    expect(excluded.has('male')).toBe(true);
  });

  it('covers custom tags passed as candidates', () => {
    const excluded = getExcludedTagsForUI({ identity: ['slime_girl'] }, ['space_boy', 'space_elf']);
    expect(excluded.has('space_boy')).toBe(true);
    expect(excluded.has('space_elf')).toBe(false);
  });
});

describe('randomizeTags gender coherence', () => {
  it('never mixes female- and male-coded tags in one draw', () => {
    for (let i = 0; i < 50; i++) {
      const next = randomizeTags({});
      const tags = Object.entries(next)
        .filter(([key]) => key !== 'generation')
        .flatMap(([, value]) => value);
      const codes = new Set(tags.map(genderCodeOfTag));
      expect(codes.has('female') && codes.has('male')).toBe(false);
    }
  });
});

describe('randomizeTags with custom pools', () => {
  it('draws custom tags from merged pools', () => {
    const pools = {
      identity: ['space_girl'],
      role: [],
      personality: [],
      genre: [],
      appearance: [],
      tone: [],
      dynamic: [],
      kink_fetish: [],
    };
    for (let i = 0; i < 10; i++) {
      const next = randomizeTags({}, [], { pools });
      expect(next['identity']).toEqual(['space_girl']);
    }
  });

  it('keeps custom draws gender coherent', () => {
    const pools = {
      identity: ['space_girl', 'space_boy'],
      role: ['moon_boy'],
      personality: [],
      genre: [],
      appearance: [],
      tone: [],
      dynamic: [],
      kink_fetish: [],
    };
    for (let i = 0; i < 30; i++) {
      const next = randomizeTags({}, [], { pools });
      const tags = Object.values(next).flat();
      const codes = new Set(tags.map(genderCodeOfTag));
      expect(codes.has('female') && codes.has('male')).toBe(false);
    }
  });

  it('lets locked custom selections veto opposite-gender draws', () => {
    const pools = {
      identity: ['space_girl'],
      role: ['moon_boy'],
      personality: [],
      genre: [],
      appearance: [],
      tone: [],
      dynamic: [],
      kink_fetish: [],
    };
    for (let i = 0; i < 10; i++) {
      const next = randomizeTags({ identity: ['space_girl'] }, ['identity'], { pools });
      expect(next['identity']).toEqual(['space_girl']);
      expect(next['role'] ?? []).toEqual([]);
    }
  });
});
