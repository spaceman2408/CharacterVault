import { describe, expect, it, vi } from 'vitest';
import { createEmptyCharacterBook } from '../../../../src/db/characterTypes';
import { createLorebookHost } from '../../../../src/agent/hosts/lorebook/createHost';
import {
  addEntry,
  auditBook,
  deleteEntry,
  listEntries,
  parseCommaList,
  parseEntryId,
  readEntry,
  readRecursion,
  replaceAcrossBook,
  replaceInEntry,
  searchBook,
  updateBookSettings,
  updateEntry,
} from '../../../../src/agent/hosts/lorebook/tools';

function action(
  name: string,
  headers: Record<string, string> = {},
  body = '',
) {
  return { name, headers, body };
}

describe('parseCommaList', () => {
  it('splits, trims, and drops empties', () => {
    expect(parseCommaList('a, b,, c')).toEqual(['a', 'b', 'c']);
  });
});

describe('parseEntryId', () => {
  it('accepts plain and hashed ids', () => {
    expect(parseEntryId('4')).toBe(4);
    expect(parseEntryId('#12')).toBe(12);
    expect(parseEntryId('  0 ')).toBe(0);
  });

  it('rejects non-integers', () => {
    expect(parseEntryId('')).toBeNull();
    expect(parseEntryId('1.5')).toBeNull();
    expect(parseEntryId('-1')).toBeNull();
    expect(parseEntryId('id:4')).toBeNull();
  });
});

describe('listEntries', () => {
  it('does not include entry content', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content: 'SECRET BODY',
        extensions: {},
        enabled: true,
        name: 'The Red Keep',
      },
    ];
    const result = listEntries(book);
    expect(result.ok).toBe(true);
    expect(result.message).toContain('#4 The Red Keep — keys: keep');
    expect(result.message).toContain('Book settings:');
    expect(result.message).toMatch(/keys: keep — \d+ chars/);
    expect(result.message).not.toContain('SECRET BODY');
  });
});

describe('readEntry', () => {
  it('returns only that entry\'s name, keys, and content', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content: 'SECRET BODY',
        extensions: {},
        enabled: true,
        name: 'The Red Keep',
      },
      {
        id: 5,
        keys: ['other'],
        content: 'OTHER SECRET',
        extensions: {},
        enabled: true,
        name: 'Elsewhere',
      },
    ];
    const result = readEntry(book, action('read_entry', { id: '4' }));
    expect(result.ok).toBe(true);
    expect(result.message).toContain('#4 The Red Keep');
    expect(result.message).toContain('keys: keep');
    expect(result.message).toContain('SECRET BODY');
    expect(result.message).not.toContain('OTHER SECRET');
    expect(result.message).not.toContain('Elsewhere');
  });

  it('includes non-default activation fields', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        secondary_keys: ['red keep'],
        content: 'Castle.',
        extensions: {},
        enabled: false,
        constant: true,
        name: 'The Red Keep',
        position: 'at_depth',
        depth: 2,
        insertion_order: 80,
        probability: 50,
        useProbability: true,
        selective: true,
        excludeRecursion: true,
        preventRecursion: true,
        delayUntilRecursion: true,
      },
    ];
    const result = readEntry(book, action('read_entry', { id: '4' }));
    expect(result.message).toContain('enabled: false');
    expect(result.message).toContain('constant: true');
    expect(result.message).toContain('secondary_keys: red keep');
    expect(result.message).toContain('position: at_depth');
    expect(result.message).toContain('depth: 2');
    expect(result.message).toContain('insertion_order: 80');
    expect(result.message).toContain('probability: 50');
    expect(result.message).toContain('excludeRecursion: true');
    expect(result.message).toContain('preventRecursion: true');
    expect(result.message).toContain('delayUntilRecursion: true');
  });

  it('rejects a missing entry', () => {
    const book = createEmptyCharacterBook('World');
    const result = readEntry(book, action('read_entry', { id: '9' }));
    expect(result.ok).toBe(false);
    expect(result.message).toBe('error: no entry #9');
  });
});

describe('updateEntry', () => {
  it('replaces content for an existing entry', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content: 'short stub',
        extensions: { context_enabled: false },
        enabled: true,
        name: 'The Red Keep',
      },
    ];
    const { book: next, result, changed } = updateEntry(
      book,
      action('update_entry', { id: '4' }, 'The Red Keep is the royal castle in King\'s Landing.'),
    );
    expect(result.ok).toBe(true);
    expect(changed).toBe(true);
    expect(result.message).toBe('ok #4 The Red Keep');
    expect(next.entries).toHaveLength(1);
    expect(next.entries[0].content).toContain('royal castle');
    expect(next.entries[0].keys).toEqual(['keep']);
    expect(next.entries[0].extensions.context_enabled).toBe(false);
  });

  it('rejects a name that belongs to another entry', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 1,
        keys: ['a'],
        content: 'A',
        extensions: {},
        enabled: true,
        name: 'Alpha',
      },
      {
        id: 2,
        keys: ['b'],
        content: 'B',
        extensions: {},
        enabled: true,
        name: 'Beta',
      },
    ];
    const { result, changed } = updateEntry(
      book,
      action('update_entry', { id: '2', name: 'Alpha' }, 'Renamed badly.'),
    );
    expect(result.ok).toBe(false);
    expect(changed).toBe(false);
    expect(result.message).toMatch(/^exists: #1/);
  });

  it('updates common activation flags without touching content', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content: 'The Red Keep is a castle.',
        extensions: {},
        enabled: true,
        name: 'The Red Keep',
      },
    ];
    const { book: next, result, changed } = updateEntry(
      book,
      action('update_entry', {
        id: '4',
        enabled: 'false',
        position: 'after_char',
        insertion_order: '100',
        secondary_keys: 'red keep, castle',
        probability: '40',
        excludeRecursion: 'true',
        preventRecursion: 'true',
        delayUntilRecursion: 'true',
      }),
    );
    expect(result.ok).toBe(true);
    expect(changed).toBe(true);
    expect(next.entries[0].content).toBe('The Red Keep is a castle.');
    expect(next.entries[0].enabled).toBe(false);
    expect(next.entries[0].position).toBe('after_char');
    expect(next.entries[0].insertion_order).toBe(100);
    expect(next.entries[0].secondary_keys).toEqual(['red keep', 'castle']);
    expect(next.entries[0].selective).toBe(true);
    expect(next.entries[0].probability).toBe(40);
    expect(next.entries[0].useProbability).toBe(true);
    expect(next.entries[0].excludeRecursion).toBe(true);
    expect(next.entries[0].preventRecursion).toBe(true);
    expect(next.entries[0].delayUntilRecursion).toBe(true);
  });

  it('rejects an invalid position', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content: 'Castle.',
        extensions: {},
        enabled: true,
        name: 'The Red Keep',
      },
    ];
    const { result, changed } = updateEntry(
      book,
      action('update_entry', { id: '4', position: 'in_the_void' }),
    );
    expect(result.ok).toBe(false);
    expect(changed).toBe(false);
    expect(result.message).toContain('position must be');
  });
});

describe('replaceInEntry', () => {
  function keepBook(content = 'The Red Keep is a castle.') {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content,
        extensions: { context_enabled: false },
        enabled: true,
        name: 'The Red Keep',
      },
    ];
    return book;
  }

  it('replaces a unique snippet and leaves name and keys', () => {
    const { book: next, result, changed } = replaceInEntry(
      keepBook(),
      action('replace_in_entry', { id: '4', old: 'a castle', new: 'the royal castle' }),
    );
    expect(result.ok).toBe(true);
    expect(changed).toBe(true);
    expect(result.message).toBe('ok #4 The Red Keep — replaced 1');
    expect(next.entries[0].content).toBe('The Red Keep is the royal castle.');
    expect(next.entries[0].keys).toEqual(['keep']);
  });

  it('uses the body as replacement when new is omitted', () => {
    const { book: next, result } = replaceInEntry(
      keepBook(),
      action('replace_in_entry', { id: '4', old: 'castle' }, 'fortress'),
    );
    expect(result.ok).toBe(true);
    expect(next.entries[0].content).toBe('The Red Keep is a fortress.');
  });

  it('rejects a missing or non-unique snippet', () => {
    const missing = replaceInEntry(
      keepBook(),
      action('replace_in_entry', { id: '4', old: 'dragon', new: 'wyrm' }),
    );
    expect(missing.result.ok).toBe(false);
    expect(missing.result.toolName).toBe('replace_in_entry');
    expect(missing.result.message).toContain('old not found');

    const dup = replaceInEntry(
      keepBook('keep keep'),
      action('replace_in_entry', { id: '4', old: 'keep', new: 'Keep' }),
    );
    expect(dup.result.ok).toBe(false);
    expect(dup.result.message).toContain('matches 2 times');
  });

  it('replace_all replaces every match', () => {
    const { book: next, result } = replaceInEntry(
      keepBook('keep keep'),
      action('replace_in_entry', { id: '4', old: 'keep', new: 'Keep', replace_all: 'true' }),
    );
    expect(result.ok).toBe(true);
    expect(result.message).toContain('replaced 2');
    expect(next.entries[0].content).toBe('Keep Keep');
  });
});

describe('deleteEntry', () => {
  it('removes only that entry', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content: 'SECRET BODY',
        extensions: {},
        enabled: true,
        name: 'The Red Keep',
      },
      {
        id: 5,
        keys: ['other'],
        content: 'OTHER SECRET',
        extensions: {},
        enabled: true,
        name: 'Elsewhere',
      },
    ];
    const { book: next, result, changed, entryId } = deleteEntry(
      book,
      action('delete_entry', { id: '4' }),
    );
    expect(result.ok).toBe(true);
    expect(changed).toBe(true);
    expect(entryId).toBe(4);
    expect(result.message).toBe('ok #4 The Red Keep');
    expect(next.entries).toHaveLength(1);
    expect(next.entries[0].id).toBe(5);
  });

  it('rejects a missing entry', () => {
    const book = createEmptyCharacterBook('World');
    const { result, changed } = deleteEntry(book, action('delete_entry', { id: '9' }));
    expect(result.ok).toBe(false);
    expect(changed).toBe(false);
    expect(result.message).toBe('error: no entry #9');
  });
});

describe('addEntry', () => {
  it('uses the next free id and blank-entry defaults', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 0,
        keys: ['existing'],
        content: 'old',
        extensions: {},
        enabled: true,
      },
    ];
    const { book: next, result } = addEntry(
      book,
      action('add_entry', { name: 'Harbor', keys: 'harbor, port' }, 'A busy harbor.'),
    );
    expect(result.ok).toBe(true);
    expect(result.message).toBe('ok #1 Harbor');
    expect(next.entries).toHaveLength(2);
    const entry = next.entries[1];
    expect(entry.id).toBe(1);
    expect(entry.name).toBe('Harbor');
    expect(entry.keys).toEqual(['harbor', 'port']);
    expect(entry.content).toBe('A busy harbor.');
    expect(entry.enabled).toBe(true);
    expect(entry.extensions.context_enabled).toBe(false);
    expect(entry.priority).toBe(0);
    expect(entry.position).toBe('before_char');
    expect(entry.constant).toBeUndefined();
  });

  it('accepts common activation flags and defaults at_depth to 4', () => {
    const book = createEmptyCharacterBook('World');
    const { result, book: next } = addEntry(
      book,
      action(
        'add_entry',
        {
          name: 'Harbor',
          keys: 'harbor',
          position: 'at_depth',
          insertion_order: '50',
          probability: '80',
        },
        'A busy harbor.',
      ),
    );
    expect(result.ok).toBe(true);
    expect(next.entries[0].position).toBe('at_depth');
    expect(next.entries[0].depth).toBe(4);
    expect(next.entries[0].insertion_order).toBe(50);
    expect(next.entries[0].probability).toBe(80);
  });

  it('allows empty keys when constant is true', () => {
    const book = createEmptyCharacterBook('World');
    const { result, book: next } = addEntry(
      book,
      action('add_entry', { name: 'Rules', constant: 'true' }, 'Always true.'),
    );
    expect(result.ok).toBe(true);
    expect(next.entries[0].constant).toBe(true);
    expect(next.entries[0].keys).toEqual([]);
  });

  it('rejects a non-constant entry without keys', () => {
    const book = createEmptyCharacterBook('World');
    const { result, book: next } = addEntry(
      book,
      action('add_entry', { name: 'Nope' }, 'Body'),
    );
    expect(result.ok).toBe(false);
    expect(next.entries).toHaveLength(0);
  });

  it('rejects a name that already exists in the book', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 3,
        keys: ['prime days'],
        content: 'Old calendar blurb.',
        extensions: {},
        enabled: true,
        name: 'Prime Days — The Five Days Outside the Months',
      },
    ];
    const { result, book: next } = addEntry(
      book,
      action(
        'add_entry',
        { name: 'Prime Days — The Five Days Outside the Months', keys: 'prime days' },
        'A longer rewrite of prime days.',
      ),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/^exists: #3/);
    expect(next.entries).toHaveLength(1);
    expect(next.entries[0].content).toBe('Old calendar blurb.');
  });

  it('replaces a same-name entry added this run when the new body is longer', () => {
    const book = createEmptyCharacterBook('World');
    const stub = addEntry(
      book,
      action('add_entry', { name: 'Prime Days', keys: 'prime days' }, 'Five days.'),
    );
    expect(stub.created).toBe(true);
    const revisable = new Set([stub.entryId!]);
    const { book: next, result, created, changed } = addEntry(
      stub.book,
      action(
        'add_entry',
        { name: 'Prime Days', keys: 'prime days' },
        'The Prime Days are the five-day period at the end of the year.',
      ),
      revisable,
    );
    expect(result.ok).toBe(true);
    expect(created).toBe(false);
    expect(changed).toBe(true);
    expect(next.entries).toHaveLength(1);
    expect(next.entries[0].id).toBe(stub.entryId);
    expect(next.entries[0].content).toContain('five-day period');
  });

  it('keeps the longer body when a same-name revisable write is shorter', () => {
    const book = createEmptyCharacterBook('World');
    const full = addEntry(
      book,
      action(
        'add_entry',
        { name: 'Prime Days', keys: 'prime days' },
        'The Prime Days are the five-day period at the end of the year.',
      ),
    );
    const { book: next, changed } = addEntry(
      full.book,
      action('add_entry', { name: 'Prime Days', keys: 'prime days' }, 'Five days.'),
      new Set([full.entryId!]),
    );
    expect(changed).toBe(false);
    expect(next.entries).toHaveLength(1);
    expect(next.entries[0].content).toContain('five-day period');
  });
});

describe('createLorebookHost', () => {
  it('persists once on flush after multiple add_entry calls', async () => {
    let book = createEmptyCharacterBook('World');
    const setBook = vi.fn(async (next) => {
      book = next;
    });
    const takeSnapshot = vi.fn(async () => undefined);
    const getCustomContext = vi.fn(async () => 'world bible');
    const host = createLorebookHost({
      getBook: () => book,
      setBook,
      getCustomContext,
      takeSnapshot,
    });

    await host.extraContextChunks();
    await host.extraContextChunks();
    expect(getCustomContext).toHaveBeenCalledTimes(1);

    await host.execute(
      action('add_entry', { name: 'A', keys: 'a' }, 'Entry A'),
    );
    await host.execute(
      action('add_entry', { name: 'B', keys: 'b' }, 'Entry B'),
    );
    expect(setBook).not.toHaveBeenCalled();
    await host.flush?.();
    expect(takeSnapshot).toHaveBeenCalledTimes(1);
    expect(setBook).toHaveBeenCalledTimes(1);
    expect(book.entries).toHaveLength(2);
    expect(book.entries.every((entry) => entry.extensions.context_enabled === false)).toBe(true);
  });

  it('persists a snippet replace on flush', async () => {
    let book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content: 'The Red Keep is a castle.',
        extensions: {},
        enabled: true,
        name: 'The Red Keep',
      },
    ];
    const host = createLorebookHost({
      getBook: () => book,
      setBook: async (next) => {
        book = next;
      },
      getCustomContext: async () => null,
    });

    const result = await host.execute(
      action('replace_in_entry', { id: '4', old: 'a castle', new: 'the royal castle' }),
    );
    expect(result.ok).toBe(true);
    expect(book.entries[0].content).toBe('The Red Keep is a castle.');
    await host.flush?.();
    expect(book.entries[0].content).toBe('The Red Keep is the royal castle.');
  });

  it('collapses two same-name add_entry calls into one longer entry', async () => {
    let book = createEmptyCharacterBook('World');
    const host = createLorebookHost({
      getBook: () => book,
      setBook: async (next) => {
        book = next;
      },
      getCustomContext: async () => null,
    });

    const first = await host.execute(
      action('add_entry', { name: 'Prime Days', keys: 'prime days' }, 'Five days.'),
    );
    const second = await host.execute(
      action(
        'add_entry',
        { name: 'Prime Days', keys: 'prime days' },
        'The Prime Days are the five-day period outside the months.',
      ),
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.message).toBe(second.message);
    await host.flush?.();
    expect(book.entries).toHaveLength(1);
    expect(book.entries[0].content).toContain('five-day period');
  });

  it('reads one entry and serves the cached body after update', async () => {
    let book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content: 'short stub',
        extensions: {},
        enabled: true,
        name: 'The Red Keep',
      },
    ];
    const host = createLorebookHost({
      getBook: () => book,
      setBook: async (next) => {
        book = next;
      },
      getCustomContext: async () => null,
    });

    const firstRead = await host.execute(action('read_entry', { id: '4' }));
    expect(firstRead.ok).toBe(true);
    expect(firstRead.message).toContain('short stub');

    book.entries[0].content = 'MUTATED LIVE BOOK';
    const cachedRead = await host.execute(action('read_entry', { id: '4' }));
    expect(cachedRead.message).toContain('short stub');
    expect(cachedRead.message).not.toContain('MUTATED LIVE BOOK');

    const updated = await host.execute(
      action('update_entry', { id: '4' }, 'The Red Keep is the royal castle.'),
    );
    expect(updated.ok).toBe(true);
    const afterUpdate = await host.execute(action('read_entry', { id: '4' }));
    expect(afterUpdate.message).toContain('royal castle');
    expect(afterUpdate.message).not.toContain('short stub');

    expect(book.entries[0].content).toBe('MUTATED LIVE BOOK');
    await host.flush?.();
    expect(book.entries[0].content).toContain('royal castle');
  });

  it('deletes an entry, drops the read cache, and persists on flush', async () => {
    let book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content: 'short stub',
        extensions: {},
        enabled: true,
        name: 'The Red Keep',
      },
    ];
    const host = createLorebookHost({
      getBook: () => book,
      setBook: async (next) => {
        book = next;
      },
      getCustomContext: async () => null,
    });

    const read = await host.execute(action('read_entry', { id: '4' }));
    expect(read.ok).toBe(true);
    const deleted = await host.execute(action('delete_entry', { id: '4' }));
    expect(deleted.ok).toBe(true);
    const afterDelete = await host.execute(action('read_entry', { id: '4' }));
    expect(afterDelete.ok).toBe(false);
    expect(afterDelete.message).toBe('error: no entry #4');

    expect(book.entries).toHaveLength(1);
    await host.flush?.();
    expect(book.entries).toHaveLength(0);
  });

  it('searches the in-run book after add_entry and persists replace_across on flush', async () => {
    let book = createEmptyCharacterBook('World');
    const host = createLorebookHost({
      getBook: () => book,
      setBook: async (next) => {
        book = next;
      },
      getCustomContext: async () => null,
    });

    await host.execute(action('add_entry', { name: 'Harbor', keys: 'harbor' }, 'A busy harbor.'));
    const found = await host.execute(action('search', { query: 'harbor' }));
    expect(found.ok).toBe(true);
    expect(found.message).toContain('Harbor');
    expect(found.message).not.toContain('\n---\n');

    const replaced = await host.execute(
      action('replace_across', { old: 'harbor', new: 'port', replace_all: 'true' }),
    );
    expect(replaced.ok).toBe(true);
    await host.flush?.();
    expect(book.entries[0].content).toContain('port');
    expect(book.entries[0].keys).toContain('port');
  });

  it('updates book settings on flush', async () => {
    let book = createEmptyCharacterBook('World');
    const host = createLorebookHost({
      getBook: () => book,
      setBook: async (next) => {
        book = next;
      },
      getCustomContext: async () => null,
    });
    const result = await host.execute(
      action('update_book_settings', {
        scan_depth: '4',
        token_budget: '512',
        recursive_scanning: 'true',
      }),
    );
    expect(result.ok).toBe(true);
    expect(book.scan_depth).toBeUndefined();
    await host.flush?.();
    expect(book.scan_depth).toBe(4);
    expect(book.token_budget).toBe(512);
    expect(book.recursive_scanning).toBe(true);
  });
});

describe('searchBook', () => {
  it('returns locations and snippets without bodies', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content:
          'Far below the walls, the harbor district wakes before dawn and the fishermen argue over berths.',
        extensions: {},
        enabled: true,
        name: 'The Red Keep',
      },
    ];
    const result = searchBook(book, action('search', { query: 'harbor' }));
    expect(result.ok).toBe(true);
    expect(result.message).toContain('harbor');
    expect(result.message).toContain('#4 The Red Keep');
    expect(result.message).not.toContain('\n---\n');
  });
});

describe('replaceAcrossBook', () => {
  it('replaces in content and keys when unique or replace_all', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['harbor'],
        content: 'The harbor is busy.',
        extensions: {},
        enabled: true,
        name: 'Harbor',
      },
    ];
    const { book: next, result } = replaceAcrossBook(
      book,
      action('replace_across', { old: 'harbor', new: 'port', replace_all: 'true' }),
    );
    expect(result.ok).toBe(true);
    expect(next.entries[0].content).toBe('The port is busy.');
    expect(next.entries[0].keys).toEqual(['port']);
    expect(result.message).toContain('replaced');
  });

  it('fails the whole call when one place is not unique', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content: 'keep keep',
        extensions: {},
        enabled: true,
        name: 'Keep',
      },
    ];
    const { changed, result } = replaceAcrossBook(
      book,
      action('replace_across', { old: 'keep', new: 'Keep' }),
    );
    expect(result.ok).toBe(false);
    expect(changed).toBe(false);
    expect(result.message).toContain('matches 2 times');
  });
});

describe('auditBook', () => {
  it('reports counts without entry bodies', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 1,
        keys: ['harbor'],
        content: 'SECRET BODY',
        extensions: {},
        enabled: true,
        name: 'Harbor',
      },
      {
        id: 2,
        keys: ['harbor'],
        content: '',
        extensions: {},
        enabled: false,
        name: 'Docks',
      },
    ];
    const result = auditBook(book);
    expect(result.ok).toBe(true);
    expect(result.message).toContain('2 entries');
    expect(result.message).toContain('Duplicate keys');
    expect(result.message).not.toContain('SECRET BODY');
  });
});

describe('updateBookSettings', () => {
  it('patches scan_depth and recursive_scanning', () => {
    const book = createEmptyCharacterBook('World');
    const { book: next, result, changed } = updateBookSettings(
      book,
      action('update_book_settings', { scan_depth: '3', recursive_scanning: 'true' }),
    );
    expect(result.ok).toBe(true);
    expect(changed).toBe(true);
    expect(next.scan_depth).toBe(3);
    expect(next.recursive_scanning).toBe(true);
    expect(next.name).toBe('World');
  });
});

describe('readRecursion', () => {
  function linkedBook() {
    const book = createEmptyCharacterBook('World');
    book.recursive_scanning = true;
    book.entries = [
      {
        id: 1,
        keys: ['harbor'],
        content: 'The docks sit beside the harbor.',
        extensions: {},
        enabled: true,
        name: 'Harbor',
      },
      {
        id: 2,
        keys: ['docks'],
        content: 'Ships unload at the docks.',
        extensions: {},
        enabled: true,
        name: 'Docks',
      },
    ];
    return book;
  }

  it('maps who can unlock whom without dumping bodies', () => {
    const result = readRecursion(linkedBook(), action('read_recursion'));
    expect(result.ok).toBe(true);
    expect(result.message).toContain('Recursion map');
    expect(result.message).toContain('#1 Harbor → #2 Docks (docks)');
    expect(result.message).not.toContain('The docks sit beside the harbor.');
  });

  it('focuses incoming and outgoing for one entry', () => {
    const result = readRecursion(linkedBook(), action('read_recursion', { id: '2' }));
    expect(result.ok).toBe(true);
    expect(result.message).toContain('Recursion for #2 Docks');
    expect(result.message).toContain('Incoming:');
    expect(result.message).toContain('#1 Harbor → #2 Docks (docks)');
    expect(result.message).toContain('Outgoing: (none)');
  });

  it('drops an edge when the target is non-recursable', () => {
    const book = linkedBook();
    const blocked = updateEntry(
      book,
      action('update_entry', { id: '2', excludeRecursion: 'true' }),
    );
    const result = readRecursion(blocked.book, action('read_recursion'));
    expect(result.message).not.toContain('#1 Harbor → #2 Docks');
    expect(result.message).toContain('excludeRecursion');
  });

  it('rejects a missing focus id', () => {
    const result = readRecursion(linkedBook(), action('read_recursion', { id: '9' }));
    expect(result.ok).toBe(false);
    expect(result.message).toBe('error: no entry #9');
  });
});
