import { describe, expect, it } from 'vitest';
import type { CharacterBook, CharacterSpec, LorebookEntry } from '../../src/db/characterTypes';
import {
  applyFindReplace,
  collectFindTargets,
  findInCard,
  MAX_FIND_MATCHES,
  preserveCase,
  type FindReplaceCard,
  type FindReplaceOptions,
} from '../../src/services/findReplace';

const PLAIN: FindReplaceOptions = { caseSensitive: false, wholeWord: false, regex: false, preserveCase: false };

function spec(overrides: Partial<CharacterSpec> = {}): CharacterSpec {
  return {
    name: 'Kisuki',
    description: 'Kisuki is a paralegal. KISUKI hates mornings.',
    personality: '',
    scenario: '',
    first_mes: 'Hi, I am Kisuki.',
    mes_example: '',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: ['kisuki waves.', 'Nothing here.'],
    physical_description: '',
    tags: ['office', 'kisuki'],
    ...overrides,
  };
}

function entry(overrides: Partial<LorebookEntry> = {}): LorebookEntry {
  return { id: 3, keys: ['Kisuki', 'paralegal'], content: 'Kisuki works late.', extensions: {}, enabled: true, ...overrides };
}

function book(entries: LorebookEntry[] = [entry()]): CharacterBook {
  return { name: 'Kisuki lore', description: '', entries, extensions: {} };
}

function card(overrides: Partial<FindReplaceCard> = {}): FindReplaceCard {
  return { spec: spec(), book: book(), ...overrides };
}

function find(c: FindReplaceCard, query: string, replacement = '', options: Partial<FindReplaceOptions> = {}) {
  const result = findInCard(c, query, replacement, { ...PLAIN, ...options });
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe('collectFindTargets', () => {
  it('orders card fields, puts greetings after the first message, then the lorebook', () => {
    const ids = collectFindTargets(card()).map((t) => t.id);
    expect(ids.indexOf('greeting:0')).toBe(ids.indexOf('field:first_mes') + 1);
    expect(ids.indexOf('greeting:1')).toBe(ids.indexOf('field:first_mes') + 2);
    expect(ids.indexOf('book:name')).toBeGreaterThan(ids.indexOf('field:avatar'));
    expect(ids).toContain('entry:3:content');
    expect(ids).toContain('entry:3:keys');
    expect(ids).toContain('entry:3:comment');
  });

  it('labels greetings like the editor and entries by their title', () => {
    const targets = collectFindTargets(card({ book: book([entry({ comment: 'The office' })]) }));
    expect(targets.find((t) => t.id === 'greeting:1')?.label).toBe('Greeting 2');
    expect(targets.find((t) => t.id === 'entry:3:content')?.entryLabel).toBe('The office');
  });

  it('works without a lorebook', () => {
    const targets = collectFindTargets(card({ book: undefined }));
    expect(targets.every((t) => t.group === 'card')).toBe(true);
  });
});

describe('findInCard', () => {
  it('returns nothing for an empty query', () => {
    expect(find(card(), '')).toEqual({ ok: true, groups: [], total: 0, truncated: false });
  });

  it('matches case-insensitively by default across fields, greetings, tags and lorebook', () => {
    const result = find(card(), 'kisuki');
    const ids = result.groups.map((g) => g.target.id);
    expect(ids).toEqual(expect.arrayContaining([
      'field:name', 'field:description', 'field:first_mes', 'greeting:0', 'field:tags',
      'book:name', 'entry:3:keys', 'entry:3:content',
    ]));
    expect(result.groups.find((g) => g.target.id === 'field:description')?.matches).toHaveLength(2);
  });

  it('respects case sensitivity', () => {
    const result = find(card(), 'Kisuki', '', { caseSensitive: true });
    expect(result.groups.find((g) => g.target.id === 'greeting:0')).toBeUndefined();
    expect(result.groups.find((g) => g.target.id === 'field:description')?.matches).toHaveLength(1);
  });

  it('respects whole word, including non-ASCII letters', () => {
    const c = card({ spec: spec({ description: 'cat category cat_x Kät Käte' }) });
    const desc = (q: string) => find(c, q, '', { wholeWord: true }).groups.find((g) => g.target.id === 'field:description');
    expect(desc('cat')?.matches.map((m) => m.start)).toEqual([0]);
    expect(desc('Kät')?.matches).toHaveLength(1);
  });

  it('treats regex characters literally in plain mode, and $ in the replacement literally', () => {
    const c = card({ spec: spec({ description: 'Costs $5 (maybe).' }) });
    const result = find(c, '(maybe)', '$1 & $&');
    const match = result.groups.find((g) => g.target.id === 'field:description')!.matches[0];
    expect(match.text).toBe('(maybe)');
    expect(match.replacement).toBe('$1 & $&');
  });

  it('expands regex groups, named groups, $& and $$ and \\n in the replacement', () => {
    const c = card({ spec: spec({ description: 'Kisuki Tanaka' }) });
    const result = find(c, '(?<first>\\w+) (\\w+)', '$2, $<first> [$&] $$\\n', { regex: true });
    const match = result.groups.find((g) => g.target.id === 'field:description')!.matches[0];
    expect(match.replacement).toBe('Tanaka, Kisuki [Kisuki Tanaka] $\n');
  });

  it('leaves unknown group references as typed', () => {
    const c = card({ spec: spec({ description: 'ab' }) });
    const match = find(c, '(a)b', '$3$<nope>', { regex: true }).groups.find((g) => g.target.id === 'field:description')!.matches[0];
    expect(match.replacement).toBe('$3$<nope>');
  });

  it('uses ^ and $ per line in regex mode', () => {
    const c = card({ spec: spec({ description: 'one\ntwo\nthree' }) });
    const desc = find(c, '^t\\w+$', '', { regex: true }).groups.find((g) => g.target.id === 'field:description');
    expect(desc?.matches.map((m) => m.text)).toEqual(['two', 'three']);
  });

  it('reports an invalid regex instead of throwing', () => {
    const result = findInCard(card(), '(unclosed', '', { ...PLAIN, regex: true });
    expect(result.ok).toBe(false);
  });

  it('skips zero-length regex matches without looping', () => {
    const result = find(card(), 'x*', '', { regex: true });
    expect(result.groups.every((g) => g.matches.every((m) => m.end > m.start))).toBe(true);
  });

  it('accepts patterns that are only valid without the u flag', () => {
    const c = card({ spec: spec({ description: 'a-b' }) });
    expect(find(c, 'a\\-b', '', { regex: true }).total).toBe(1);
  });

  it('caps the number of matches', () => {
    const c = card({ spec: spec({ description: 'a'.repeat(MAX_FIND_MATCHES + 50) }), book: undefined });
    const result = find(c, 'a');
    expect(result.total).toBe(MAX_FIND_MATCHES);
    expect(result.truncated).toBe(true);
  });

  it('applies preserve case per match', () => {
    const result = find(card(), 'kisuki', 'mira', { preserveCase: true });
    const desc = result.groups.find((g) => g.target.id === 'field:description')!;
    expect(desc.matches.map((m) => m.replacement)).toEqual(['Mira', 'MIRA']);
    expect(result.groups.find((g) => g.target.id === 'greeting:0')!.matches[0].replacement).toBe('mira');
  });
});

describe('preserveCase', () => {
  it('follows the matched shape', () => {
    expect(preserveCase('kisuki', 'Mira')).toBe('mira');
    expect(preserveCase('KISUKI', 'mira')).toBe('MIRA');
    expect(preserveCase('Kisuki', 'mira')).toBe('Mira');
    expect(preserveCase('K', 'mira')).toBe('Mira');
    expect(preserveCase('McKay', 'mira')).toBe('mira');
    expect(preserveCase('123', 'mira')).toBe('mira');
  });
});

describe('applyFindReplace', () => {
  it('replaces every match and maps results back onto the card', () => {
    const c = card();
    const found = find(c, 'kisuki', 'Mira');
    const applied = applyFindReplace(c, found.groups);
    if (!applied.ok) throw new Error(applied.error);
    expect(applied.spec.name).toBe('Mira');
    expect(applied.spec.description).toBe('Mira is a paralegal. Mira hates mornings.');
    expect(applied.spec.alternate_greetings).toEqual(['Mira waves.', 'Nothing here.']);
    expect(applied.spec.tags).toEqual(['office', 'Mira']);
    expect(applied.book?.name).toBe('Mira lore');
    expect(applied.book?.entries[0].keys).toEqual(['Mira', 'paralegal']);
    expect(applied.book?.entries[0].content).toBe('Mira works late.');
    expect(applied.count).toBe(found.total);
  });

  it('does not mutate the input card', () => {
    const c = card();
    const before = JSON.stringify(c);
    applyFindReplace(c, find(c, 'kisuki', 'Mira').groups);
    expect(JSON.stringify(c)).toBe(before);
  });

  it('skips excluded matches', () => {
    const c = card();
    const found = find(c, 'kisuki', 'Mira');
    const desc = found.groups.find((g) => g.target.id === 'field:description')!;
    const applied = applyFindReplace(c, found.groups, new Set([desc.matches[1].id]));
    if (!applied.ok) throw new Error(applied.error);
    expect(applied.spec.description).toBe('Mira is a paralegal. KISUKI hates mornings.');
    expect(applied.count).toBe(found.total - 1);
  });

  it('refuses to empty the name, first message or a greeting', () => {
    const c = card({ spec: spec({ alternate_greetings: ['Kisuki'] }) });
    const result = applyFindReplace(c, find(c, '^kisuki$', '', { regex: true }).groups);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Name');
  });

  it('allows emptying other fields', () => {
    const c = card({ spec: spec({ scenario: 'Kisuki' }) });
    const found = find(c, 'Kisuki', '', { caseSensitive: true, wholeWord: true });
    const scenarioOnly = found.groups.filter((g) => g.target.id === 'field:scenario');
    const applied = applyFindReplace(c, scenarioOnly);
    expect(applied.ok && applied.spec.scenario).toBe('');
  });

  it('splits tags and keys when the replacement adds a comma', () => {
    const c = card();
    const found = find(c, 'kisuki', 'a, b', { caseSensitive: true });
    const applied = applyFindReplace(c, found.groups.filter((g) => g.target.id === 'field:tags'));
    expect(applied.ok && applied.spec.tags).toEqual(['office', 'a', 'b']);
  });

  it('leaves the lorebook untouched when no lorebook match is applied', () => {
    const c = card();
    const found = find(c, 'mornings', 'nights');
    const applied = applyFindReplace(c, found.groups);
    expect(applied.ok && applied.book).toBe(c.book);
    expect(applied.ok && applied.places).toBe(1);
  });
});
