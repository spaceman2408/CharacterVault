import { describe, expect, it } from 'vitest';
import { createLorebookHost } from '../../../../src/agent/hosts/lorebook/createHost';
import { formatKeyTest } from '../../../../src/agent/hosts/lorebook/keyTest';
import { testKeys } from '../../../../src/agent/hosts/lorebook/tools';
import type { CharacterBook, LorebookEntry } from '../../../../src/db/characterTypes';
import { createEmptyCharacterBook } from '../../../../src/db/characterTypes';

function entry(id: number, name: string, keys: string[], content: string, extra: Partial<LorebookEntry> = {}): LorebookEntry {
  return { id, name, keys, content, extensions: {}, enabled: true, ...extra };
}

function book(entries: LorebookEntry[], settings: Partial<CharacterBook> = {}): CharacterBook {
  return { ...createEmptyCharacterBook('World'), ...settings, entries };
}

describe('formatKeyTest', () => {
  it('lists constants and key hits without entry bodies', () => {
    const result = formatKeyTest(
      book([
        entry(0, 'Rules', [], 'SECRET RULES', { constant: true }),
        entry(1, 'Harbor', ['harbor'], 'SECRET HARBOR'),
        entry(2, 'Forest', ['forest'], 'SECRET FOREST'),
      ]),
      'We head down to the Harbor at night.',
    );
    expect(result).toContain('2 of 3 entries activate');
    expect(result).toContain('- #0 Rules — constant');
    expect(result).toContain('- #1 Harbor — "harbor"');
    expect(result).not.toContain('Forest');
    expect(result).not.toContain('SECRET');
  });

  it('reports key hits that stay inactive', () => {
    const result = formatKeyTest(
      book([
        entry(1, 'Old docks', ['harbor'], 'Docks.', { enabled: false }),
        entry(2, 'Night market', ['market'], 'Stalls.', { selective: true, secondary_keys: ['night', 'bazaar'] }),
        entry(3, 'Smugglers', ['market'], 'Crates.', { selective: true, secondary_keys: ['harbor'], selectiveLogic: 2 }),
      ]),
      'The harbor market opens at dawn.',
    );
    expect(result).toContain('0 of 3 entries activate');
    expect(result).toContain('#1 Old docks — "harbor", but disabled');
    expect(result).toContain('#2 Night market — "market", but secondary keys failed (AND ANY: night, bazaar)');
    expect(result).toContain('#3 Smugglers — "market", but secondary keys failed (NOT ANY: harbor)');
  });

  it('applies secondary keys only when selective is on', () => {
    const result = formatKeyTest(
      book([entry(1, 'Market', ['market'], 'Stalls.', { secondary_keys: ['night'] })]),
      'The market opens.',
    );
    expect(result).toContain('- #1 Market — "market"');
  });

  it('follows recursion from activated entries when recursive_scanning is on', () => {
    const entries = [
      entry(1, 'Harbor', ['harbor'], 'The lighthouse watches the harbor.'),
      entry(2, 'Lighthouse', ['lighthouse'], 'A keeper lives here.'),
      entry(3, 'Keeper', ['keeper'], 'Old Tom.', { excludeRecursion: true }),
    ];
    const on = formatKeyTest(book(entries, { recursive_scanning: true }), 'To the harbor.');
    expect(on).toContain('- #2 Lighthouse — "lighthouse" from #1 Harbor');
    expect(on).not.toContain('#3 Keeper');

    const off = formatKeyTest(book(entries), 'To the harbor.');
    expect(off).toContain('1 of 3 entries activate');
    expect(off).toContain('recursive_scanning off');
    expect(off).not.toContain('#2 Lighthouse');
  });

  it('releases a secondary-key hold when a recursive pass adds the missing word', () => {
    const result = formatKeyTest(
      book(
        [
          entry(1, 'Harbor', ['harbor'], 'Lanterns light the harbor at night.'),
          entry(2, 'Night market', ['market'], 'Stalls.', { selective: true, secondary_keys: ['night'] }),
        ],
        { recursive_scanning: true },
      ),
      'The harbor market.',
    );
    expect(result).toContain('- #2 Night market — "market" on a recursive pass');
    expect(result).not.toContain('secondary keys failed');
  });

  it('says when recursion stops at the pass limit', () => {
    const chain = Array.from({ length: 14 }, (_, i) => entry(i, `Step ${i}`, [`step${i}`], `Then step${i + 1}.`));
    const long = formatKeyTest(book(chain, { recursive_scanning: true }), 'step0');
    expect(long).toContain('11 of 14 entries activate');
    expect(long).toContain('Recursion stopped after 10 passes');

    const short = formatKeyTest(book(chain.slice(0, 4), { recursive_scanning: true }), 'step0');
    expect(short).toContain('4 of 4 entries activate');
    expect(short).not.toContain('Recursion stopped');
  });

  it('does not recurse from preventRecursion entries', () => {
    const result = formatKeyTest(
      book(
        [
          entry(1, 'Harbor', ['harbor'], 'The lighthouse watches the harbor.', { preventRecursion: true }),
          entry(2, 'Lighthouse', ['lighthouse'], 'A keeper lives here.'),
        ],
        { recursive_scanning: true },
      ),
      'To the harbor.',
    );
    expect(result).toContain('1 of 2 entries activate');
  });

  it('holds delayUntilRecursion entries until a recursive pass', () => {
    const entries = [
      entry(1, 'Harbor', ['harbor'], 'Ships come and go.'),
      entry(2, 'Fog', ['fog'], 'Thick fog.', { delayUntilRecursion: true }),
    ];
    const off = formatKeyTest(book(entries), 'Fog over the harbor.');
    expect(off).toContain('#2 Fog — "fog", but delayUntilRecursion');

    const on = formatKeyTest(book(entries, { recursive_scanning: true }), 'Fog over the harbor.');
    expect(on).toContain('- #2 Fog — "fog" on a recursive pass');
    expect(on).not.toContain('but delayUntilRecursion');
  });

  it('notes chance and the token budget', () => {
    const result = formatKeyTest(
      book([entry(1, 'Harbor', ['harbor'], 'x'.repeat(400), { probability: 40, useProbability: true })], {
        token_budget: 50,
      }),
      'harbor',
    );
    expect(result).toContain('- #1 Harbor — "harbor", 40% chance');
    expect(result).toContain('~100 tokens, over token_budget 50');
  });

  it('labels entries by name, then title, then first key', () => {
    const result = formatKeyTest(
      book([
        entry(1, '', ['harbor'], 'Docks.', { comment: 'Harbor district' }),
        entry(2, '', ['harbor'], 'Ships.'),
      ]),
      'harbor',
    );
    expect(result).toContain('- #1 Harbor district — "harbor"');
    expect(result).toContain('- #2 harbor — "harbor"');
  });

  it('handles an empty book', () => {
    expect(formatKeyTest(book([]), 'hello')).toBe('Key test — the book has no entries.');
  });
});

describe('testKeys', () => {
  it('reads text from the header or the body', () => {
    const target = book([entry(1, 'Harbor', ['harbor'], 'Docks.')]);
    expect(testKeys(target, { name: 'test_keys', headers: { text: 'the harbor' }, body: '' }).message).toContain(
      '#1 Harbor',
    );
    expect(testKeys(target, { name: 'test_keys', headers: {}, body: 'the harbor' }).message).toContain('#1 Harbor');
  });

  it('rejects empty text', () => {
    const result = testKeys(book([]), { name: 'test_keys', headers: { text: '  ' }, body: '' });
    expect(result).toEqual({ ok: false, toolName: 'test_keys', message: 'error: text is empty' });
  });

  it('runs through the lorebook host without writing', async () => {
    let writes = 0;
    const host = createLorebookHost({
      getBook: () => book([entry(1, 'Harbor', ['harbor'], 'Docks.')]),
      setBook: async () => {
        writes += 1;
      },
      getCustomContext: async () => null,
    });
    const result = await host.execute({ name: 'test_keys', headers: { text: 'the harbor' }, body: '' });
    expect(result.ok).toBe(true);
    expect(result.message).toContain('- #1 Harbor — "harbor"');
    await host.flush?.();
    expect(writes).toBe(0);
  });
});
