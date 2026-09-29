import { describe, expect, it } from 'vitest';
import type { CharacterBook, LorebookEntry, SnapshotDiffEntry } from '../../../src/db/characterTypes';
import {
  buildSnapshotChangeGroups,
  diffGreetings,
  diffLorebook,
  type SnapshotChange,
} from '../../../src/components/history/snapshotChanges';

function entry(id: number, overrides: Partial<LorebookEntry> = {}): LorebookEntry {
  return {
    id,
    keys: [`key${id}`],
    content: `Content ${id}`,
    extensions: {},
    enabled: true,
    comment: `Entry ${id}`,
    ...overrides,
  };
}

function book(entries: LorebookEntry[], overrides: Partial<CharacterBook> = {}): CharacterBook {
  return { name: 'Book', description: '', extensions: {}, entries, ...overrides };
}

function summary(changes: SnapshotChange[]): string[] {
  return changes.map((change) => {
    switch (change.kind) {
      case 'greeting':
        return `${change.status} greeting ${change.index + 1}`;
      case 'entry':
        return `${change.status} entry ${change.entryId}`;
      default:
        return change.kind;
    }
  });
}

describe('diffGreetings', () => {
  it('shows a greeting deleted from the middle as one deletion', () => {
    const changes = diffGreetings(['A', 'B', 'C', 'D'], ['A', 'C', 'D']);
    expect(summary(changes)).toEqual(['deleted greeting 2']);
    expect(changes[0]).toMatchObject({ before: 'B', after: '' });
  });

  it('pairs a rewritten greeting as an edit', () => {
    const changes = diffGreetings(['A', 'B', 'C'], ['A', 'B2', 'C']);
    expect(summary(changes)).toEqual(['edited greeting 2']);
    expect(changes[0]).toMatchObject({ before: 'B', after: 'B2' });
  });

  it('numbers added greetings by their current position', () => {
    expect(summary(diffGreetings(['A'], ['A', 'B', 'C']))).toEqual(['added greeting 2', 'added greeting 3']);
  });

  it('keeps greetings before and after the change unchanged', () => {
    const before = ['A', 'B', 'C', 'D', 'E'];
    expect(summary(diffGreetings(before, ['A', 'B', 'X', 'D', 'E']))).toEqual(['edited greeting 3']);
    expect(summary(diffGreetings(before, ['A', 'B', 'C', 'D', 'E', 'F']))).toEqual(['added greeting 6']);
    expect(summary(diffGreetings(before, ['Z', 'A', 'B', 'C', 'D', 'E']))).toEqual(['added greeting 1']);
  });

  it('pairs very long lists by position instead of building a huge table', () => {
    const before = Array.from({ length: 600 }, (_, index) => `old ${index}`);
    const after = Array.from({ length: 601 }, (_, index) => `new ${index}`);
    const changes = diffGreetings(before, after);
    expect(changes).toHaveLength(601);
    expect(changes.filter((change) => change.kind === 'greeting' && change.status === 'edited')).toHaveLength(600);
    expect(changes[600]).toMatchObject({ status: 'added', index: 600 });
  });

  it('ignores line ending differences', () => {
    expect(diffGreetings(['one\r\ntwo'], ['one\ntwo'])).toEqual([]);
  });
});

describe('diffLorebook', () => {
  it('lists added, edited, and deleted entries', () => {
    const changes = diffLorebook(
      book([entry(0), entry(1), entry(2)]),
      book([entry(0), entry(1, { content: 'Changed' }), entry(3)]),
    );
    expect(summary(changes)).toEqual(['edited entry 1', 'added entry 3', 'deleted entry 2']);
  });

  it('shows flag-only changes as settings, not an empty diff', () => {
    const [change] = diffLorebook(
      book([entry(0)]),
      book([entry(0, { constant: true, position: 'at_depth', extensions: { context_enabled: false } })]),
    );
    expect(change).toMatchObject({ kind: 'entry', status: 'edited', contentChanged: false, keysChanged: false });
    if (change.kind !== 'entry') throw new Error('expected an entry change');
    expect(change.settings.map((setting) => `${setting.label}: ${setting.before} -> ${setting.after}`)).toEqual([
      'Constant:  -> on',
      'Position:  -> At Depth',
    ]);
  });

  it('ignores the vault-only AI context pin', () => {
    const [change] = diffLorebook(
      book([entry(0, { extensions: { context_enabled: true } })]),
      book([entry(0, { content: 'Changed', extensions: { context_enabled: false } })]),
    );
    if (change.kind !== 'entry') throw new Error('expected an entry change');
    expect(change.settings).toEqual([]);
  });

  it('shows book settings and entry order', () => {
    const changes = diffLorebook(
      book([entry(0), entry(1)]),
      book([entry(1), entry(0)], { scan_depth: 4, recursive_scanning: true }),
    );
    expect(summary(changes)).toEqual(['book-settings']);
    const [settings] = changes;
    if (settings.kind !== 'book-settings') throw new Error('expected book settings');
    expect(settings.settings.map((setting) => setting.label)).toEqual([
      'Scan depth',
      'Recursive scanning',
      'Entry order',
    ]);
  });

  it('treats a missing field and an empty one as the same', () => {
    expect(diffLorebook(book([entry(0)]), book([entry(0, { name: '', secondary_keys: [] })]))).toEqual([]);
  });

  it('marks long setting values for a text diff', () => {
    const [change] = diffLorebook(book([]), book([], { description: 'x'.repeat(80) }));
    if (change.kind !== 'book-settings') throw new Error('expected book settings');
    expect(change.settings[0]).toMatchObject({ label: 'Description', long: true });
  });
});

describe('buildSnapshotChangeGroups', () => {
  function diffEntry(section: SnapshotDiffEntry['section'], snapshotValue: unknown, currentValue: unknown): SnapshotDiffEntry {
    return { section, label: section, changed: true, snapshotValue, currentValue };
  }

  it('skips unchanged sections', () => {
    const groups = buildSnapshotChangeGroups([
      { section: 'description', label: 'Description', changed: false, snapshotValue: 'a', currentValue: 'a' },
    ]);
    expect(groups).toEqual([]);
  });

  it('shows tags one per line', () => {
    const [group] = buildSnapshotChangeGroups([diffEntry('tags', ['fantasy'], ['fantasy', 'elf'])]);
    expect(group.changes[0]).toMatchObject({ kind: 'text', before: 'fantasy', after: 'fantasy\nelf' });
  });

  it('flattens extensions into one line per value', () => {
    const [group] = buildSnapshotChangeGroups([
      diffEntry('extensions', { depth_prompt: { depth: 4 } }, { depth_prompt: { depth: 2 }, fav: true }),
    ]);
    expect(group.changes[0]).toMatchObject({
      kind: 'text',
      before: 'depth_prompt.depth: 4',
      after: 'depth_prompt.depth: 2\nfav: true',
    });
  });

  it('falls back to a text diff when the detailed diff finds nothing to show', () => {
    const [group] = buildSnapshotChangeGroups([diffEntry('alternate_greetings', ['a\r\nb'], ['a\nb'])]);
    expect(group.changes).toEqual([
      { id: 'field:alternate_greetings', kind: 'text', label: 'alternate_greetings', before: 'a\nb', after: 'a\nb' },
    ]);
  });
});
