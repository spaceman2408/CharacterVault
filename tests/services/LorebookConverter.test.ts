import { describe, expect, it } from 'vitest';
import {
  convertSTEntry,
  convertToSTEntry,
  convertSTLorebook,
  convertToSTLorebook,
  importLorebook,
  cardBookEntryToEntry,
  entryToCardBookEntry,
  normalizeCardBook,
} from '../../src/services/LorebookConverter';
import type { LorebookEntry } from '../../src/db/characterTypes';

describe('LorebookConverter', () => {
  it('maps ST at-depth position and role into curated fields', () => {
    const entry = convertSTEntry({
      uid: 1,
      key: ['castle'],
      keysecondary: ['north'],
      comment: 'Castle',
      content: 'A tall fortress.',
      constant: false,
      selective: true,
      order: 100,
      position: 4,
      disable: false,
      caseSensitive: false,
      selectiveLogic: 0,
      probability: 50,
      useProbability: true,
      depth: 2,
      role: 0,
      excludeRecursion: true,
      preventRecursion: false,
      delayUntilRecursion: false,
      matchWholeWords: true,
    });

    expect(entry.position).toBe('at_depth');
    expect(entry.depth).toBe(2);
    expect(entry.role).toBe(0);
    expect(entry.selective).toBe(true);
    expect(entry.selectiveLogic).toBe(0);
    expect(entry.probability).toBe(50);
    expect(entry.useProbability).toBe(true);
    expect(entry.excludeRecursion).toBe(true);
    expect(entry.matchWholeWords).toBe(true);
    expect(entry.extensions._st_position).toBe(4);
  });

  it('round-trips curated activation fields through ST export', () => {
    const original: LorebookEntry = {
      id: 7,
      keys: ['dragon'],
      secondary_keys: ['fire'],
      content: 'Wyrm.',
      extensions: {},
      enabled: true,
      comment: 'Dragon',
      selective: true,
      selectiveLogic: 3,
      priority: 42,
      position: 'at_depth',
      depth: 5,
      role: 2,
      constant: false,
      case_sensitive: true,
      matchWholeWords: false,
      probability: 75,
      useProbability: true,
      excludeRecursion: false,
      preventRecursion: true,
      delayUntilRecursion: true,
    };

    const st = convertToSTEntry(original, 0);
    expect(st.position).toBe(4);
    expect(st.depth).toBe(5);
    expect(st.role).toBe(2);
    expect(st.selectiveLogic).toBe(3);
    expect(st.probability).toBe(75);
    expect(st.preventRecursion).toBe(true);
    expect(st.delayUntilRecursion).toBe(true);
    expect(st.matchWholeWords).toBe(false);

    const back = convertSTEntry(st);
    expect(back.position).toBe('at_depth');
    expect(back.depth).toBe(5);
    expect(back.role).toBe(2);
    expect(back.selectiveLogic).toBe(3);
    expect(back.probability).toBe(75);
    expect(back.preventRecursion).toBe(true);
  });

  it('preserves unmapped ST position via _st_position when possible', () => {
    const entry = convertSTEntry({
      uid: 2,
      key: ['x'],
      keysecondary: [],
      comment: '',
      content: 'y',
      constant: false,
      selective: false,
      order: 0,
      position: 7, // outlet
      disable: false,
      caseSensitive: false,
      outletName: 'scene',
    });

    expect(entry.extensions._st_position).toBe(7);
    expect(entry.extensions.outletName).toBe('scene');

    const st = convertToSTEntry(entry, 0);
    // Still maps to outlet raw position because curated position matches POSITION_MAP[7]
    expect(st.position).toBe(7);
    expect(st.outletName).toBe('scene');
  });

  it('imports full ST lorebook record format', () => {
    const data = {
      entries: {
        '0': {
          uid: 0,
          key: ['a'],
          keysecondary: [],
          comment: 'A',
          content: 'Alpha',
          constant: true,
          selective: false,
          order: 10,
          position: 0,
          disable: false,
          caseSensitive: false,
        },
        '1': {
          uid: 1,
          key: ['b'],
          keysecondary: ['c'],
          comment: 'B',
          content: 'Beta',
          constant: false,
          selective: true,
          order: 20,
          position: 5,
          disable: false,
          caseSensitive: true,
          selectiveLogic: 2,
        },
      },
    };

    const book = convertSTLorebook(data);
    expect(book.entries).toHaveLength(2);
    expect(book.entries[0].constant).toBe(true);
    expect(book.entries[1].position).toBe('before_example');
    expect(book.entries[1].selectiveLogic).toBe(2);

    const exported = convertToSTLorebook(book);
    expect(Object.keys(exported.entries)).toEqual(['0', '1']);
    expect(exported.entries['1'].position).toBe(5);

    const reimported = importLorebook(exported);
    expect(reimported?.entries).toHaveLength(2);
  });

  it('keys exported ST entries by uid after an entry was deleted', () => {
    const entry = (id: number): LorebookEntry => ({
      id,
      keys: [`k${id}`],
      content: `Entry ${id}`,
      extensions: {},
      enabled: true,
    });

    const exported = convertToSTLorebook({ entries: [entry(0), entry(2), entry(5)], extensions: {} });
    expect(Object.keys(exported.entries)).toEqual(['0', '2', '5']);
    for (const [key, stEntry] of Object.entries(exported.entries)) {
      expect(stEntry.uid).toBe(Number(key));
    }

    const reimported = importLorebook(exported);
    expect(reimported?.entries.map((e) => e.id)).toEqual([0, 2, 5]);
    expect(reimported?.entries.map((e) => e.content)).toEqual(['Entry 0', 'Entry 2', 'Entry 5']);
  });

  it('gives duplicate or missing entry ids a free uid instead of dropping entries', () => {
    const entry = (id: number, content: string): LorebookEntry => ({
      id,
      keys: [],
      content,
      extensions: {},
      enabled: true,
    });

    const exported = convertToSTLorebook({
      entries: [entry(1, 'a'), entry(1, 'b'), entry(undefined as unknown as number, 'c'), entry(0, 'd')],
      extensions: {},
    });

    expect(Object.keys(exported.entries)).toEqual(['0', '1', '2', '3']);
    for (const [key, stEntry] of Object.entries(exported.entries)) {
      expect(stEntry.uid).toBe(Number(key));
    }
    expect(exported.entries['1'].content).toBe('a');
    expect(exported.entries['2'].content).toBe('b');
    expect(exported.entries['3'].content).toBe('c');
    expect(exported.entries['0'].content).toBe('d');
  });

  it('imports book-level scan settings from ST originalData', () => {
    const book = convertSTLorebook({
      entries: {
        '0': {
          uid: 0,
          key: ['a'],
          keysecondary: [],
          comment: 'A',
          content: 'Alpha',
          constant: false,
          selective: false,
          order: 0,
          position: 0,
          disable: false,
          caseSensitive: false,
        },
      },
      originalData: {
        name: 'Matrus',
        description: '',
        scan_depth: 4,
        token_budget: 512,
        recursive_scanning: true,
      },
    });

    expect(book.name).toBe('Matrus');
    expect(book.scan_depth).toBe(4);
    expect(book.token_budget).toBe(512);
    expect(book.recursive_scanning).toBe(true);
  });

  it('falls back to root-level scan settings when originalData omits them', () => {
    const book = convertSTLorebook({
      entries: {
        '0': {
          uid: 0,
          key: ['a'],
          keysecondary: [],
          comment: 'A',
          content: 'Alpha',
          constant: false,
          selective: false,
          order: 0,
          position: 0,
          disable: false,
          caseSensitive: false,
        },
      },
      recursive_scanning: true,
      scan_depth: 2,
      token_budget: 200,
    });

    expect(book.recursive_scanning).toBe(true);
    expect(book.scan_depth).toBe(2);
    expect(book.token_budget).toBe(200);
  });

  it('round-trips book-level scan settings through ST export', () => {
    const book = convertSTLorebook({
      entries: {
        '0': {
          uid: 0,
          key: ['a'],
          keysecondary: [],
          comment: 'A',
          content: 'Alpha',
          constant: false,
          selective: false,
          order: 0,
          position: 0,
          disable: false,
          caseSensitive: false,
        },
      },
      originalData: {
        name: 'Matrus',
        recursive_scanning: true,
        scan_depth: 3,
        token_budget: 400,
      },
    });

    const exported = convertToSTLorebook(book);
    expect(exported.originalData?.recursive_scanning).toBe(true);
    expect(exported.originalData?.scan_depth).toBe(3);
    expect(exported.originalData?.token_budget).toBe(400);

    const back = importLorebook(exported);
    expect(back?.recursive_scanning).toBe(true);
    expect(back?.scan_depth).toBe(3);
    expect(back?.token_budget).toBe(400);
  });

  it('reads SillyTavern card entry options from extensions', () => {
    const entry = cardBookEntryToEntry({
      id: 3,
      keys: ['harbor'],
      content: 'Docks.',
      enabled: true,
      insertion_order: 250,
      position: 'after_char',
      extensions: {
        position: 4,
        depth: 2,
        role: 1,
        exclude_recursion: true,
        prevent_recursion: true,
        delay_until_recursion: false,
        probability: 40,
        useProbability: true,
        selectiveLogic: 3,
        match_whole_words: true,
        sticky: 2,
      },
    });

    expect(entry.position).toBe('at_depth');
    expect(entry.depth).toBe(2);
    expect(entry.role).toBe(1);
    expect(entry.excludeRecursion).toBe(true);
    expect(entry.preventRecursion).toBe(true);
    expect(entry.delayUntilRecursion).toBe(false);
    expect(entry.probability).toBe(40);
    expect(entry.useProbability).toBe(true);
    expect(entry.selectiveLogic).toBe(3);
    expect(entry.matchWholeWords).toBe(true);
    expect(entry.insertion_order).toBe(250);
    expect(entry.extensions.sticky).toBe(2);
  });

  it('keeps top-level values over stale extension values on card import', () => {
    const entry = cardBookEntryToEntry({
      id: 0,
      keys: ['a'],
      content: '',
      enabled: true,
      excludeRecursion: false,
      extensions: { exclude_recursion: true },
    });
    expect(entry.excludeRecursion).toBe(false);
  });

  it('writes card entry options where SillyTavern reads them', () => {
    const card = entryToCardBookEntry({
      id: 1,
      keys: ['castle'],
      content: 'Fortress.',
      enabled: true,
      priority: 7,
      position: 'at_depth',
      depth: 3,
      role: 2,
      excludeRecursion: true,
      preventRecursion: false,
      probability: 60,
      useProbability: true,
      selectiveLogic: 1,
      matchWholeWords: false,
      case_sensitive: true,
      extensions: { _st_position: 1, sticky: 5 },
    });
    const raw = card as unknown as Record<string, unknown>;

    expect(card.position).toBe('after_char');
    expect(card.insertion_order).toBe(7);
    expect(card.case_sensitive).toBe(true);
    expect(card.extensions).toEqual({
      position: 4,
      depth: 3,
      role: 2,
      exclude_recursion: true,
      prevent_recursion: false,
      probability: 60,
      useProbability: true,
      selectiveLogic: 1,
      match_whole_words: false,
      case_sensitive: true,
      sticky: 5,
    });
    expect(raw.excludeRecursion).toBeUndefined();
    expect(raw.depth).toBeUndefined();
  });

  it("keeps an Author's Note position on card round-trip until Position changes", () => {
    const imported = cardBookEntryToEntry({
      id: 0,
      keys: ['a'],
      content: '',
      enabled: true,
      extensions: { position: 2 },
    });
    expect(imported.position).toBe('before_char');
    expect(entryToCardBookEntry(imported).extensions.position).toBe(2);
    expect(entryToCardBookEntry({ ...imported, position: 'after_char' }).extensions.position).toBe(1);
  });

  it('maps options on a bare character_book lorebook import', () => {
    const book = importLorebook({
      entries: [
        { id: 0, keys: ['a'], content: 'A', enabled: true, extensions: { exclude_recursion: true } },
      ],
    });
    expect(book?.entries[0].excludeRecursion).toBe(true);
  });

  it('keeps a position changed in CharacterVault over the stored SillyTavern one', () => {
    const edited = cardBookEntryToEntry({
      id: 0,
      keys: ['a'],
      content: '',
      enabled: true,
      position: 'before_example',
      extensions: { position: 4 },
    });
    expect(edited.position).toBe('before_example');
    expect(entryToCardBookEntry(edited).extensions.position).toBe(5);
  });

  it('takes the detailed SillyTavern position when the spec position is unchanged', () => {
    const untouched = cardBookEntryToEntry({
      id: 0,
      keys: ['a'],
      content: '',
      enabled: true,
      position: 'after_char',
      extensions: { position: 4 },
    });
    expect(untouched.position).toBe('at_depth');
    expect(untouched.extensions.position).toBeUndefined();
    expect(untouched.extensions._st_position).toBe(4);
  });

  it('normalizes an old stored book once and then leaves it alone', () => {
    const stored = {
      entries: [
        { id: 0, keys: ['a'], content: '', enabled: true, position: 'after_char' as const, extensions: { position: 4, depth: 6, exclude_recursion: true } },
        { id: 1, keys: ['b'], content: '', enabled: true, position: 'before_char' as const, extensions: {} },
      ],
      extensions: {},
    };

    const once = normalizeCardBook(stored);
    expect(once).not.toBe(stored);
    expect(once.entries[0]).toMatchObject({ position: 'at_depth', depth: 6, excludeRecursion: true });
    expect(once.entries[1]).toBe(stored.entries[1]);
    expect(normalizeCardBook(once)).toBe(once);
    expect(normalizeCardBook(undefined)).toBeUndefined();
  });
});
