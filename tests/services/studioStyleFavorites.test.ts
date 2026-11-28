// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  favoriteStyleSelections,
  getFavoriteTags,
  toggleFavoriteTag,
} from '../../src/pages/ai-creation-studio/tags/tagData';

describe('style tag favorites', () => {
  beforeEach(() => localStorage.clear());

  it('keeps one favorite perspective and one favorite tense', () => {
    toggleFavoriteTag('identity', 'elf');
    toggleFavoriteTag('generation', 'first_person');
    toggleFavoriteTag('generation', 'past_tense');
    toggleFavoriteTag('generation', 'third_person');
    expect(getFavoriteTags()).toEqual([
      { category: 'identity', tag: 'elf' },
      { category: 'generation', tag: 'past_tense' },
      { category: 'generation', tag: 'third_person' },
    ]);
  });

  it('turns favorite style tags into preselected generation tags', () => {
    expect(
      favoriteStyleSelections([
        { category: 'identity', tag: 'elf' },
        { category: 'generation', tag: 'past_tense' },
        { category: 'generation', tag: 'second_person' },
      ])
    ).toEqual({ generation: ['second_person', 'past_tense'] });
    expect(favoriteStyleSelections([{ category: 'identity', tag: 'elf' }])).toEqual({});
  });
});
