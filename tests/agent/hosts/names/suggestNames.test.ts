import { describe, expect, it } from 'vitest';
import { createCharacterHost } from '../../../../src/agent/hosts/character/createHost';
import { createLorebookHost } from '../../../../src/agent/hosts/lorebook/createHost';
import fakerNames from '../../../../src/agent/hosts/names/fakerNames.json';
import { OVERUSED_NAMES } from '../../../../src/agent/hosts/names/overused';
import { MAX_NAME_COUNT, NAME_ORIGINS, suggestNames } from '../../../../src/agent/hosts/names/suggestNames';
import type { CharacterBook, CharacterSpec } from '../../../../src/db/characterTypes';
import { createEmptyCharacterBook } from '../../../../src/db/characterTypes';

const { origins } = fakerNames;

function action(headers: Record<string, string>) {
  return { name: 'suggest_names', headers, body: '' };
}

function namesIn(message: string): string[] {
  return message
    .split('\n')
    .slice(1)
    .filter((line) => !line.startsWith('Unknown origin'));
}

function splitsInto(name: string, firsts: string[], lasts: string[]): boolean {
  for (let i = name.indexOf(' '); i !== -1; i = name.indexOf(' ', i + 1)) {
    if (firsts.includes(name.slice(0, i)) && lasts.includes(name.slice(i + 1))) return true;
  }
  return false;
}

function spec(overrides: Partial<CharacterSpec> = {}): CharacterSpec {
  return {
    name: 'Nadia',
    description: 'A cartographer.',
    personality: '',
    scenario: '',
    first_mes: 'Hello.',
    mes_example: '',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    physical_description: '',
    ...overrides,
  };
}

describe('suggestNames', () => {
  it('offers exactly the origins in the name data', () => {
    expect([...NAME_ORIGINS].sort()).toEqual(Object.keys(origins).sort());
  });

  it('returns first names from the chosen origin and gender', async () => {
    const result = await suggestNames(action({ origin: 'german', gender: 'female', part: 'first' }), []);
    expect(result.ok).toBe(true);
    expect(result.message.split('\n')[0]).toBe('suggest_names: 12 first names, female, german');
    const names = namesIn(result.message);
    expect(names).toHaveLength(12);
    for (const name of names) expect(origins.german.first.female).toContain(name);
  });

  it('pairs a gendered surname with the first name', async () => {
    const result = await suggestNames(action({ origin: 'czech', gender: 'female', count: '20' }), []);
    for (const name of namesIn(result.message)) {
      expect(splitsInto(name, origins.czech.first.female, origins.czech.last.female)).toBe(true);
    }
  });

  it('gives Polish women the feminine surname form', async () => {
    const result = await suggestNames(action({ origin: 'polish', gender: 'female', part: 'last', count: '30' }), []);
    for (const name of namesIn(result.message)) {
      expect(origins.polish.last.female).toContain(name);
      expect(name).not.toMatch(/ki$/);
    }
  });

  it('puts the Vietnamese family name first', async () => {
    const result = await suggestNames(action({ origin: 'vietnamese', gender: 'male', count: '20' }), []);
    for (const name of namesIn(result.message)) {
      expect(splitsInto(name, origins.vietnamese.last.any, origins.vietnamese.first.male)).toBe(true);
    }
  });

  it('never suggests overused names', async () => {
    for (let run = 0; run < 20; run += 1) {
      const result = await suggestNames(
        action({ origin: 'american, british, german, dutch, swedish', part: 'first', count: '30' }),
        [],
      );
      for (const token of namesIn(result.message).flatMap((name) => name.split(/[\s'-]+/))) {
        expect(OVERUSED_NAMES.has(token.toLowerCase())).toBe(false);
      }
    }
  });

  it('skips names that already appear in the text', async () => {
    const all = origins.german.first.female;
    const kept = all
      .filter((name) => /^\p{Lu}[\p{L}\p{M}]+$/u.test(name) && !OVERUSED_NAMES.has(name.toLowerCase()))
      .filter((name) => !all.some((other) => other !== name && other.split(/[\s-]+/).includes(name)))
      .slice(0, 40);
    const usedText = all.filter((name) => !kept.includes(name)).join(', ');
    const result = await suggestNames(
      action({ origin: 'german', gender: 'female', part: 'first', count: '30' }),
      [usedText],
    );
    expect(result.ok).toBe(true);
    for (const name of namesIn(result.message)) expect(kept).toContain(name);
  });

  it('accepts origin labels and skips unknown ones', async () => {
    const result = await suggestNames(action({ origin: 'Scottish, South African' }), []);
    expect(result.ok).toBe(true);
    expect(result.message).toContain('south-african');
    expect(result.message).toContain('Unknown origin skipped: Scottish');
  });

  it('fails with the origin list when no origin is known', async () => {
    const result = await suggestNames(action({ origin: 'scottish' }), []);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('unknown origin scottish');
    expect(result.message).toContain('swiss-german');
    expect((await suggestNames(action({}), [])).ok).toBe(false);
  });

  it('rejects an unknown gender or part', async () => {
    expect((await suggestNames(action({ origin: 'french', gender: 'woman' }), [])).ok).toBe(false);
    expect((await suggestNames(action({ origin: 'french', part: 'middle' }), [])).ok).toBe(false);
  });

  it('clamps count', async () => {
    const many = await suggestNames(action({ origin: 'italian', count: '99' }), []);
    expect(namesIn(many.message)).toHaveLength(MAX_NAME_COUNT);
    const one = await suggestNames(action({ origin: 'italian', count: '0' }), []);
    expect(namesIn(one.message)).toHaveLength(1);
  });
});

describe('suggest_names in the hosts', () => {
  it('skips names used on the card and in its lorebook', async () => {
    const book: CharacterBook = {
      ...createEmptyCharacterBook(),
      entries: [{ id: 1, keys: ['Kowalska'], name: 'Zofia Kowalska', content: 'A baker.' }] as CharacterBook['entries'],
    };
    const host = createCharacterHost({
      getSpec: () => spec({ name: 'Nadia Kowalska', description: 'Nadia works with Hanna Nowak.' }),
      getBook: () => book,
      persist: async () => {},
      getCustomContext: async () => null,
    });
    for (let run = 0; run < 10; run += 1) {
      const result = await host.execute(action({ origin: 'polish', gender: 'female', count: '30' }));
      expect(result.ok).toBe(true);
      expect(result.message).not.toMatch(/\b(Nadia|Zofia|Hanna|Kowalska|Nowak)\b/u);
    }
  });

  it('skips names used in a standalone lorebook', async () => {
    let book: CharacterBook = {
      ...createEmptyCharacterBook('Town'),
      entries: [{ id: 1, keys: ['Nowak'], name: 'Hanna Nowak', content: 'The mayor.' }] as CharacterBook['entries'],
    };
    const host = createLorebookHost({
      getBook: () => book,
      setBook: async (next) => {
        book = next;
      },
      getCustomContext: async () => null,
    });
    for (let run = 0; run < 10; run += 1) {
      const result = await host.execute(action({ origin: 'polish', gender: 'female', count: '30' }));
      expect(result.ok).toBe(true);
      expect(result.message).not.toMatch(/\b(Hanna|Nowak)\b/u);
    }
  });
});
