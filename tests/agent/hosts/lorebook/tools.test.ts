import { describe, expect, it, vi } from 'vitest';
import { createEmptyCharacterBook } from '../../../../src/db/characterTypes';
import { createLorebookHost } from '../../../../src/agent/hosts/lorebook/createHost';
import {
  addEntry,
  listEntries,
  parseCommaList,
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
    expect(result.message).not.toContain('SECRET BODY');
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
});
