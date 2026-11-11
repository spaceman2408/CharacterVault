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
import {
  cardBookEntryToEntry,
  entryToCardBookEntry,
  normalizeCardBook,
} from '../../../../src/services/LorebookConverter';

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
    expect(result.message).toMatch(/keys: keep — \d+ tokens/);
    expect(result.message).not.toContain('SECRET BODY');
  });

  it('names recursion flags by the fields add_entry and update_entry take', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content: 'Castle.',
        extensions: {},
        enabled: true,
        name: 'The Red Keep',
        excludeRecursion: true,
        preventRecursion: true,
        delayUntilRecursion: true,
      },
    ];
    expect(listEntries(book).message).toMatch(
      /#4 The Red Keep — keys: keep — \d+ tokens, excludeRecursion, preventRecursion, delayUntilRecursion$/m,
    );
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

  it('keeps a recursion flag off when a card entry is normalized again', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      cardBookEntryToEntry({
        id: 4,
        keys: ['keep'],
        content: 'The Red Keep is a castle.',
        extensions: { exclude_recursion: true, prevent_recursion: true },
        enabled: true,
        name: 'The Red Keep',
      }),
    ];
    const { book: next, changed } = updateEntry(
      book,
      action('update_entry', { id: '4', excludeRecursion: 'false' }),
    );
    expect(changed).toBe(true);
    const reloaded = normalizeCardBook(next).entries[0];
    expect(reloaded.excludeRecursion).toBe(false);
    expect(reloaded.preventRecursion).toBe(true);
    expect(entryToCardBookEntry(reloaded).extensions.exclude_recursion).toBe(false);
  });

  it('does not add a recursion flag that is already off', () => {
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
    const { book: next, changed } = updateEntry(
      book,
      action('update_entry', { id: '4', excludeRecursion: 'false' }, 'A castle on a hill.'),
    );
    expect(changed).toBe(true);
    expect(next.entries[0]).not.toHaveProperty('excludeRecursion');
  });

  it('accepts other spellings of the recursion flags', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content: 'Castle.',
        extensions: {},
        enabled: true,
        name: 'The Red Keep',
        delayUntilRecursion: true,
      },
    ];
    const { book: next, result } = updateEntry(
      book,
      action('update_entry', {
        id: '4',
        exclude_recursion: 'true',
        PreventRecursion: 'true',
        'delay-until-recursion': 'false',
      }),
    );
    expect(result.message).toBe(
      'ok #4 The Red Keep — now excludeRecursion: true, preventRecursion: true, delayUntilRecursion: false',
    );
    expect(next.entries[0].excludeRecursion).toBe(true);
    expect(next.entries[0].preventRecursion).toBe(true);
    expect(next.entries[0].delayUntilRecursion).toBe(false);

    const { book: labelled } = updateEntry(
      next,
      action('update_entry', {
        id: '4',
        non_recursable: 'false',
        preventRecursion: 'true',
        prevent_further_recursion: 'false',
      }),
    );
    expect(labelled.entries[0].excludeRecursion).toBe(false);
    expect(labelled.entries[0].preventRecursion).toBe(true);
  });

  it('names fields it does not know instead of dropping them silently', () => {
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
    const alone = updateEntry(book, action('update_entry', { id: '4', recursion: 'false' }));
    expect(alone.result.ok).toBe(false);
    expect(alone.result.message).toBe('error: nothing to update — ignored unknown fields: recursion');

    const withBody = updateEntry(
      book,
      action('update_entry', { id: '4', recursion: 'false', Depth: '300 metres' }, 'A castle on a hill.'),
    );
    expect(withBody.result.message).toBe('ok #4 The Red Keep — ignored unknown fields: recursion, Depth');
    expect(withBody.book.entries[0].content).toBe('A castle on a hill.');
    expect(withBody.book.entries[0]).not.toHaveProperty('depth');
  });

  it('reads yes/no, on/off, 1/0, and quoted values as true or false', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content: 'Castle.',
        extensions: {},
        enabled: true,
        name: 'The Red Keep',
        constant: true,
        delayUntilRecursion: true,
      },
    ];
    const { book: next, result } = updateEntry(
      book,
      action('update_entry', {
        id: '4',
        excludeRecursion: 'Yes',
        preventRecursion: '"true"',
        delayUntilRecursion: 'off',
        enabled: '0',
        constant: 'no',
      }),
    );
    expect(result.message).toBe(
      'ok #4 The Red Keep — now constant: false, enabled: false, excludeRecursion: true, preventRecursion: true, delayUntilRecursion: false',
    );
    expect(next.entries[0].excludeRecursion).toBe(true);
    expect(next.entries[0].preventRecursion).toBe(true);
    expect(next.entries[0].delayUntilRecursion).toBe(false);
    expect(next.entries[0].enabled).toBe(false);
    expect(next.entries[0].constant).toBeUndefined();
  });

  it('says when nothing changed and what the sent fields already are', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content: 'Castle.',
        extensions: {},
        enabled: true,
        name: 'The Red Keep',
        excludeRecursion: true,
      },
    ];
    const flag = updateEntry(book, action('update_entry', { id: '4', excludeRecursion: 'true' }));
    expect(flag.changed).toBe(false);
    expect(flag.result.message).toBe('ok #4 The Red Keep — no change, already excludeRecursion: true');

    const body = updateEntry(book, action('update_entry', { id: '4' }, 'Castle.'));
    expect(body.changed).toBe(false);
    expect(body.result.message).toBe('ok #4 The Red Keep — no change');
  });

  it('warns when a write leaves an entry with excludeRecursion and delayUntilRecursion', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content: 'Castle.',
        extensions: {},
        enabled: true,
        name: 'The Red Keep',
        excludeRecursion: true,
      },
    ];
    const { result } = updateEntry(book, action('update_entry', { id: '4', delayUntilRecursion: 'true' }));
    expect(result.message).toBe(
      'ok #4 The Red Keep — now delayUntilRecursion: true — warning: excludeRecursion with delayUntilRecursion means this entry never activates',
    );

    const bodyOnly = updateEntry(
      { ...book, entries: [{ ...book.entries[0], delayUntilRecursion: true }] },
      action('update_entry', { id: '4' }, 'A castle.'),
    );
    expect(bodyOnly.result.message).toBe('ok #4 The Red Keep');
  });

  it('warns when a write delays an entry in a book with recursive_scanning off', () => {
    const book = createEmptyCharacterBook('World');
    book.recursive_scanning = false;
    book.entries = [
      { id: 4, keys: ['keep'], content: 'Castle.', extensions: {}, enabled: true, name: 'The Red Keep' },
    ];
    const off = updateEntry(book, action('update_entry', { id: '4', delayUntilRecursion: 'true' }));
    expect(off.result.message).toBe(
      'ok #4 The Red Keep — now delayUntilRecursion: true — warning: delayUntilRecursion with recursive_scanning off means this entry never activates',
    );

    const on = updateEntry(
      { ...book, recursive_scanning: true },
      action('update_entry', { id: '4', delayUntilRecursion: 'true' }),
    );
    expect(on.result.message).toBe('ok #4 The Red Keep — now delayUntilRecursion: true');
  });

  it('reports depth and selective when the write set them as a side effect', () => {
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
    const { result } = updateEntry(
      book,
      action('update_entry', { id: '4', position: 'at_depth', secondary_keys: 'castle' }),
    );
    expect(result.message).toBe('ok #4 The Red Keep — now position: at_depth, depth: 4, selective: true');
  });

  it('rejects a value that is not true or false, constant included', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      {
        id: 4,
        keys: ['keep'],
        content: 'Castle.',
        extensions: {},
        enabled: true,
        name: 'The Red Keep',
        constant: true,
      },
    ];
    const flag = updateEntry(book, action('update_entry', { id: '4', excludeRecursion: 'maybe' }, 'New body.'));
    expect(flag.result.message).toBe('error: excludeRecursion must be true or false');
    expect(flag.changed).toBe(false);

    const constant = updateEntry(book, action('update_entry', { id: '4', constant: 'always' }));
    expect(constant.result.message).toBe('error: constant must be true or false');
    expect(constant.book.entries[0].constant).toBe(true);
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

  it('reads replace_all: yes as true', () => {
    const { book: next, result } = replaceInEntry(
      keepBook('keep keep'),
      action('replace_in_entry', { id: '4', old: 'keep', new: 'Keep', replace_all: 'yes' }),
    );
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

  it('accepts a recursion flag alias and names an unknown field', () => {
    const { book: next, result } = addEntry(
      createEmptyCharacterBook('World'),
      action('add_entry', { name: 'Harbor', keys: 'harbor', non_recursable: 'true', comment: 'port town' }, 'A busy harbor.'),
    );
    expect(result.message).toBe('ok #0 Harbor — now excludeRecursion: true — ignored unknown fields: comment');
    expect(next.entries[0].excludeRecursion).toBe(true);
  });

  it('reads constant: yes as a constant entry', () => {
    const { book: next, result } = addEntry(
      createEmptyCharacterBook('World'),
      action('add_entry', { name: 'Rules', constant: 'yes' }, 'Always on.'),
    );
    expect(result.ok).toBe(true);
    expect(next.entries[0].constant).toBe(true);
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

  it('does not give a new entry the id of one deleted in the same run', async () => {
    let book = createEmptyCharacterBook('World');
    book.entries = [
      { id: 0, keys: ['a'], content: 'A.', extensions: {}, enabled: true, name: 'Alpha' },
      { id: 1, keys: ['b'], content: 'B.', extensions: {}, enabled: true, name: 'Beta' },
    ];
    const host = createLorebookHost({
      getBook: () => book,
      setBook: async (next) => {
        book = next;
      },
      getCustomContext: async () => null,
    });

    await host.execute(action('delete_entry', { id: '1' }));
    const added = await host.execute(action('add_entry', { name: 'Gamma', keys: 'g' }, 'G.'));
    expect(added.message).toBe('ok #2 Gamma');
    await host.flush?.();
    expect(book.entries?.map((entry) => [entry.id, entry.name])).toEqual([[0, 'Alpha'], [2, 'Gamma']]);
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

  it('says whether recursive_scanning is on next to the recursion counts', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = [
      { id: 1, keys: ['harbor'], content: 'Ships.', extensions: {}, enabled: true, name: 'Harbor' },
    ];
    expect(auditBook(book).message).toMatch(/^Recursion: .*; recursive_scanning off$/m);
    book.recursive_scanning = true;
    expect(auditBook(book).message).toMatch(/^Recursion: .*; recursive_scanning on$/m);
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

  it('accepts recursiveScanning and names an unknown field', () => {
    const book = createEmptyCharacterBook('World');
    const applied = updateBookSettings(
      book,
      action('update_book_settings', { recursiveScanning: 'on', recursion: 'true' }),
    );
    expect(applied.book.recursive_scanning).toBe(true);
    expect(applied.result.message).toMatch(/^ok Book settings: .*recursive_scanning: on — ignored unknown fields: recursion$/);

    const unknownOnly = updateBookSettings(book, action('update_book_settings', { recursion: 'true' }));
    expect(unknownOnly.result.message).toBe('error: nothing to update — ignored unknown fields: recursion');
  });

  it('names the delayed entries that turning recursive_scanning off strands', () => {
    const book = createEmptyCharacterBook('World');
    book.recursive_scanning = true;
    book.entries = [
      { id: 1, keys: ['fog'], content: 'Fog.', extensions: {}, enabled: true, name: 'Fog', delayUntilRecursion: true },
      {
        id: 2,
        keys: ['mist'],
        content: 'Mist.',
        extensions: {},
        enabled: true,
        name: 'Mist',
        delayUntilRecursion: true,
        excludeRecursion: true,
      },
      { id: 3, keys: ['harbor'], content: 'Ships.', extensions: {}, enabled: true, name: 'Harbor' },
    ];
    const off = updateBookSettings(book, action('update_book_settings', { recursive_scanning: 'false' }));
    expect(off.result.message).toMatch(
      / — warning: delayUntilRecursion entries never activate while recursive_scanning is off: #1 Fog$/,
    );

    const other = updateBookSettings(
      { ...book, recursive_scanning: false },
      action('update_book_settings', { scan_depth: '3' }),
    );
    expect(other.result.message).not.toContain('warning');
  });

  it('treats turning off an unset recursive_scanning as no change', () => {
    const { changed, result } = updateBookSettings(
      createEmptyCharacterBook('World'),
      action('update_book_settings', { recursive_scanning: 'false' }),
    );
    expect(changed).toBe(false);
    expect(result.message).toMatch(/recursive_scanning: off — no change$/);
  });

  it('says when the settings were already as asked', () => {
    const book = createEmptyCharacterBook('World');
    book.recursive_scanning = true;
    const { result, changed } = updateBookSettings(
      book,
      action('update_book_settings', { recursive_scanning: 'true' }),
    );
    expect(changed).toBe(false);
    expect(result.message).toMatch(/recursive_scanning: on — no change$/);
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

  it('reads an unset recursive_scanning as off and warns next to edges', () => {
    const book = linkedBook();
    delete book.recursive_scanning;
    const whole = readRecursion(book, action('read_recursion')).message;
    expect(whole).toContain('recursive_scanning off');
    expect(whole).toContain('Warning: recursive_scanning is off');

    const focused = readRecursion(book, action('read_recursion', { id: '2' })).message;
    expect(focused).toContain('recursive_scanning off');
    expect(focused).toContain('Warning: recursive_scanning is off');

    expect(readRecursion(linkedBook(), action('read_recursion', { id: '2' })).message).not.toContain('Warning');
  });

  it('lists the edges a flag blocks and which flag blocks them', () => {
    const book = linkedBook();
    book.entries[1].excludeRecursion = true;

    const target = readRecursion(book, action('read_recursion', { id: '2' })).message;
    expect(target).toContain('Incoming: (none)');
    expect(target).toContain('Blocked incoming:\n- #1 Harbor → #2 Docks (docks) — #2 has excludeRecursion');

    const source = readRecursion(book, action('read_recursion', { id: '1' })).message;
    expect(source).toContain('Outgoing: (none)');
    expect(source).toContain('Blocked outgoing:\n- #1 Harbor → #2 Docks (docks) — #2 has excludeRecursion');

    const whole = readRecursion(book, action('read_recursion')).message;
    expect(whole).toContain('Blocked by excludeRecursion / preventRecursion: 1 edge;');

    const prevented = linkedBook();
    prevented.entries[0].preventRecursion = true;
    expect(readRecursion(prevented, action('read_recursion', { id: '1' })).message).toContain(
      '- #1 Harbor → #2 Docks (docks) — #1 has preventRecursion',
    );
    expect(readRecursion(linkedBook(), action('read_recursion', { id: '1' })).message).not.toContain('Blocked');
  });

  it('warns when excludeRecursion and delayUntilRecursion leave an entry unable to activate', () => {
    const book = linkedBook();
    book.entries[1].excludeRecursion = true;
    book.entries[1].delayUntilRecursion = true;
    expect(readRecursion(book, action('read_recursion', { id: '2' })).message).toContain(
      'Warning: excludeRecursion with delayUntilRecursion means this entry never activates.',
    );
    expect(readRecursion(book, action('read_recursion')).message).toContain(
      '#2 Docks excludeRecursion, delayUntilRecursion (never activates)',
    );
  });

  it('warns when recursive_scanning off leaves a delayed entry unable to activate', () => {
    const book = linkedBook();
    book.recursive_scanning = false;
    book.entries[1].delayUntilRecursion = true;
    expect(readRecursion(book, action('read_recursion', { id: '2' })).message).toContain(
      'Warning: delayUntilRecursion with recursive_scanning off means this entry never activates.',
    );
    expect(readRecursion(book, action('read_recursion')).message).toContain(
      '#2 Docks delayUntilRecursion (never activates)',
    );
    book.recursive_scanning = true;
    expect(readRecursion(book, action('read_recursion', { id: '2' })).message).not.toContain('never activates');
  });

  it('says how many flagged entries the Flags line leaves out', () => {
    const book = createEmptyCharacterBook('World');
    book.entries = Array.from({ length: 30 }, (_, id) => ({
      id,
      keys: [`key${id}`],
      content: 'Body.',
      extensions: {},
      enabled: true,
      name: `E${id}`,
      preventRecursion: true,
    }));
    expect(readRecursion(book, action('read_recursion')).message).toMatch(/^Flags: .*#23 E23 preventRecursion; …\+6$/m);
  });

  it('does not warn when off but no entry unlocks another', () => {
    const book = createEmptyCharacterBook('World');
    book.recursive_scanning = false;
    book.entries = [
      { id: 1, keys: ['harbor'], content: 'Ships.', extensions: {}, enabled: true, name: 'Harbor' },
    ];
    const result = readRecursion(book, action('read_recursion')).message;
    expect(result).toContain('recursive_scanning off');
    expect(result).not.toContain('Warning');
  });

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
