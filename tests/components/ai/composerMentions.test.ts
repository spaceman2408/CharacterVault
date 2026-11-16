import { describe, expect, it } from 'vitest';
import {
  filterMentions,
  findMentionQuery,
  findMentionRanges,
  insertMention,
} from '../../../src/components/ai/composerMentions';

describe('findMentionQuery', () => {
  it('finds an @ at the start or after a space', () => {
    expect(findMentionQuery('@desc', 5)).toEqual({ start: 0, query: 'desc' });
    expect(findMentionQuery('fix @', 5)).toEqual({ start: 4, query: '' });
    expect(findMentionQuery('fix @har and', 8)).toEqual({ start: 4, query: 'har' });
  });

  it('ignores @ inside a word and closed mentions', () => {
    expect(findMentionQuery('me@mail', 7)).toBeNull();
    expect(findMentionQuery('@Description ', 13)).toBeNull();
    expect(findMentionQuery('no mention', 10)).toBeNull();
  });
});

describe('filterMentions', () => {
  const options = [
    { label: 'Description' },
    { label: 'Post-History' },
    { label: '“Harbor” (#4)' },
    { label: '“Old harbor road” (#7)' },
  ];

  it('puts prefix matches first, ignoring the opening quote', () => {
    expect(filterMentions(options, 'har').map((option) => option.label)).toEqual([
      '“Harbor” (#4)',
      '“Old harbor road” (#7)',
    ]);
  });

  it('matches case-insensitively and lists everything for an empty query', () => {
    expect(filterMentions(options, 'DESC').map((option) => option.label)).toEqual(['Description']);
    expect(filterMentions(options, '')).toHaveLength(4);
  });
});

describe('insertMention', () => {
  it('adds a trailing space at the end of the text', () => {
    const query = findMentionQuery('Tighten @des', 12)!;
    expect(insertMention('Tighten @des', query, 12, 'Description')).toEqual({
      text: 'Tighten @Description ',
      caret: 21,
    });
  });

  it('reuses the following space mid-text and puts the caret after it', () => {
    const query = findMentionQuery('Tighten @des please', 12)!;
    expect(insertMention('Tighten @des please', query, 12, 'Description')).toEqual({
      text: 'Tighten @Description please',
      caret: 21,
    });
  });
});

describe('findMentionRanges', () => {
  const options = [
    { label: 'Greeting 1' },
    { label: 'Greeting 10' },
    { label: 'Greeting Writer' },
    { label: '“Harbor” (#4)' },
  ];
  const spans = (text: string) =>
    findMentionRanges(text, options).map(({ start, end }) => text.slice(start, end));

  it('marks known mentions, ignoring case', () => {
    expect(spans('Use @Greeting Writer on @greeting 1.')).toEqual(['@Greeting Writer', '@greeting 1']);
    expect(spans('@“Harbor” (#4) needs keys')).toEqual(['@“Harbor” (#4)']);
  });

  it('prefers the longest label and needs a word boundary after it', () => {
    expect(spans('fix @Greeting 10')).toEqual(['@Greeting 10']);
    expect(spans('fix @Greeting 1x')).toEqual([]);
  });

  it('skips unknown names and @ inside a word', () => {
    expect(spans('mail me@Greeting 1 or @Nobody')).toEqual([]);
    expect(findMentionRanges('no mentions', options)).toEqual([]);
  });
});
