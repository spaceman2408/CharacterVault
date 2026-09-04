import { describe, expect, it } from 'vitest';
import {
  applyBookDecisions,
  applyCharacterReview,
  applyLorebookReview,
  applySpecDecisions,
  defaultDecisions,
  diffBookChanges,
  diffCharacterReview,
  diffLorebookReview,
  diffSpecChanges,
} from '../../../src/agent/review/diff';
import type {
  CharacterBook,
  CharacterSpec,
  LorebookEntry,
} from '../../../src/db/characterTypes';
import { createEmptyCharacterBook } from '../../../src/db/characterTypes';

function spec(overrides: Partial<CharacterSpec> = {}): CharacterSpec {
  return {
    name: 'Aria',
    description: 'A cartographer.',
    personality: 'Quiet.',
    scenario: 'A port.',
    first_mes: 'Hello.',
    mes_example: '',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    physical_description: '',
    ...overrides,
  };
}

function entry(overrides: Partial<LorebookEntry> & { id: number }): LorebookEntry {
  return {
    keys: ['harbor'],
    content: 'The harbor sleeps.',
    extensions: {},
    enabled: true,
    ...overrides,
  };
}

function book(entries: LorebookEntry[] = []): CharacterBook {
  return { ...createEmptyCharacterBook('World'), entries };
}

describe('diffSpecChanges', () => {
  it('returns no changes for identical specs', () => {
    expect(diffSpecChanges(spec(), spec())).toEqual([]);
  });

  it('diffs changed scalar fields', () => {
    const changes = diffSpecChanges(spec(), spec({ description: 'A pirate queen.' }));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      id: 'field:description',
      kind: 'field',
      label: 'Description',
      before: 'A cartographer.',
      after: 'A pirate queen.',
    });
  });

  it('diffs tags as comma-joined text', () => {
    const changes = diffSpecChanges(spec(), spec({ tags: ['a', 'b'] }));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ id: 'field:tags', before: '', after: 'a, b' });
  });

  it('diffs per-greeting changes when lengths match', () => {
    const changes = diffSpecChanges(
      spec({ alternate_greetings: ['Hi.', 'Yo.'] }),
      spec({ alternate_greetings: ['Hi.', 'Hello there.'] }),
    );
    expect(changes).toEqual([
      { id: 'greeting:1', kind: 'greeting', index: 1, before: 'Yo.', after: 'Hello there.' },
    ]);
  });

  it('falls back to a whole-list change when greeting counts differ', () => {
    const changes = diffSpecChanges(
      spec({ alternate_greetings: ['Hi.'] }),
      spec({ alternate_greetings: ['Hi.', 'Welcome.'] }),
    );
    expect(changes).toEqual([
      { id: 'greetings', kind: 'greetings', before: ['Hi.'], after: ['Hi.', 'Welcome.'] },
    ]);
  });
});

describe('diffBookChanges', () => {
  it('detects added, updated, and deleted entries', () => {
    const before = book([entry({ id: 1 }), entry({ id: 2, content: 'Old.' })]);
    const after = book([
      entry({ id: 2, content: 'New.' }),
      entry({ id: 3, content: 'Fresh.' }),
    ]);
    const changes = diffBookChanges(before, after);
    expect(changes.map((change) => change.id).sort()).toEqual([
      'entry-added:3',
      'entry-deleted:1',
      'entry-updated:2',
    ]);
  });

  it('flags entry metadata changes on updates', () => {
    const before = book([entry({ id: 1, enabled: true })]);
    const after = book([entry({ id: 1, enabled: false })]);
    const changes = diffBookChanges(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: 'entry-updated', metaChanged: true });
  });

  it('summarizes book setting changes', () => {
    const before = book();
    const after = book();
    after.description = 'A world.';
    const changes = diffBookChanges(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: 'book-settings' });
  });
});

describe('applyCharacterReview', () => {
  it('applies approved field edits and skips denied ones', () => {
    const payload = {
      originalSpec: spec(),
      proposedSpec: spec({ description: 'Pirate.', personality: 'Bold.' }),
      originalBook: book(),
      proposedBook: undefined,
    };
    const decisions = defaultDecisions(diffCharacterReview(payload));
    decisions['field:personality'] = { approved: false };
    decisions['field:description'] = { approved: true, edited: 'Pirate queen.' };
    const applied = applyCharacterReview(payload, decisions);
    expect(applied.spec?.description).toBe('Pirate queen.');
    expect(applied.spec?.personality).toBe('Quiet.');
    expect(applied.book).toBeUndefined();
  });

  it('returns no spec when everything is denied', () => {
    const payload = {
      originalSpec: spec(),
      proposedSpec: spec({ description: 'Pirate.' }),
      originalBook: book(),
      proposedBook: undefined,
    };
    const decisions = defaultDecisions(diffCharacterReview(payload));
    decisions['field:description'] = { approved: false };
    expect(applyCharacterReview(payload, decisions)).toEqual({});
  });

  it('applies entry adds with edited content and keys', () => {
    const proposed = book([entry({ id: 7, content: 'Draft.', keys: ['a'] })]);
    const payload = { originalSpec: spec(), originalBook: book(), proposedBook: proposed };
    const decisions = defaultDecisions(diffCharacterReview(payload));
    decisions['entry-added:7'] = { approved: true, edited: 'Final.', editedKeys: ['a', 'b'] };
    const applied = applyCharacterReview(payload, decisions);
    expect(applied.book?.entries).toHaveLength(1);
    expect(applied.book?.entries[0]).toMatchObject({
      id: 7,
      content: 'Final.',
      keys: ['a', 'b'],
    });
  });

  it('honors entry deletes only when approved', () => {
    const original = book([entry({ id: 1 }), entry({ id: 2 })]);
    const proposed = book([entry({ id: 2 })]);
    const payload = { originalSpec: spec(), originalBook: original, proposedBook: proposed };
    const decisions = defaultDecisions(diffCharacterReview(payload));
    decisions['entry-deleted:1'] = { approved: false };
    const applied = applyCharacterReview(payload, decisions);
    expect(applied.book).toBeUndefined();
  });
});

describe('applyLorebookReview', () => {
  it('returns null when nothing is approved', () => {
    const payload = { originalBook: book(), proposedBook: book([entry({ id: 1 })]) };
    const decisions = defaultDecisions(diffLorebookReview(payload));
    decisions['entry-added:1'] = { approved: false };
    expect(applyLorebookReview(payload, decisions)).toBeNull();
  });

  it('applies approved updates with edits', () => {
    const payload = {
      originalBook: book([entry({ id: 1, content: 'Old.' })]),
      proposedBook: book([entry({ id: 1, content: 'New.' })]),
    };
    const decisions = defaultDecisions(diffLorebookReview(payload));
    decisions['entry-updated:1'] = { approved: true, edited: 'Edited.' };
    const applied = applyLorebookReview(payload, decisions);
    expect(applied?.entries[0].content).toBe('Edited.');
  });
});

describe('live-base merging', () => {
  it('preserves concurrent live edits to untouched fields', () => {
    const original = spec();
    const proposed = spec({ description: 'Pirate.' });
    const changes = diffSpecChanges(original, proposed);
    const decisions = defaultDecisions(changes);
    const live = spec({ personality: 'Edited while reviewing.' });
    const merged = applySpecDecisions(live, changes, decisions);
    expect(merged?.description).toBe('Pirate.');
    expect(merged?.personality).toBe('Edited while reviewing.');
  });

  it('rebases added entries when the id is taken in the live book', () => {
    const original = book();
    const proposed = book([entry({ id: 0, content: 'Agent entry.' })]);
    const changes = diffBookChanges(original, proposed);
    const decisions = defaultDecisions(changes);
    const live = book([entry({ id: 0, content: 'User entry added meanwhile.' })]);
    const merged = applyBookDecisions(live, proposed, changes, decisions);
    expect(merged?.entries).toHaveLength(2);
    expect(merged?.entries.map((row) => row.id).sort()).toEqual([0, 1]);
    expect(merged?.entries.find((row) => row.id === 1)?.content).toBe('Agent entry.');
    expect(merged?.entries.find((row) => row.id === 0)?.content).toBe(
      'User entry added meanwhile.',
    );
  });

  it('skips updates for entries deleted from the live book', () => {
    const original = book([entry({ id: 1, content: 'Old.' })]);
    const proposed = book([entry({ id: 1, content: 'New.' })]);
    const changes = diffBookChanges(original, proposed);
    const decisions = defaultDecisions(changes);
    const merged = applyBookDecisions(book(), proposed, changes, decisions);
    expect(merged).toBeUndefined();
  });

  it('skips per-greeting edits when the live list shrank', () => {
    const original = spec({ alternate_greetings: ['A.', 'B.'] });
    const proposed = spec({ alternate_greetings: ['A.', 'B edited.'] });
    const changes = diffSpecChanges(original, proposed);
    const decisions = defaultDecisions(changes);
    const merged = applySpecDecisions(spec({ alternate_greetings: ['Only.'] }), changes, decisions);
    expect(merged).toBeUndefined();
  });

  it('strips a phantom trailing empty greeting from list edits', () => {
    const original = spec({ alternate_greetings: ['A.'] });
    const proposed = spec({ alternate_greetings: ['A.', 'B.'] });
    const changes = diffSpecChanges(original, proposed);
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe('greetings');
    const decisions = defaultDecisions(changes);
    decisions.greetings = { approved: true, edited: 'A.\nB.\n' };
    const merged = applySpecDecisions(original, changes, decisions);
    expect(merged?.alternate_greetings).toEqual(['A.', 'B.']);
  });
});
