import type { CharacterBook, LorebookEntry, SnapshotDiffEntry } from '../../db/characterTypes';
import { snapshotValuesMatch } from '../../utils/snapshotCompare';
import { DEPTH_ROLE_OPTIONS, POSITION_OPTIONS, SELECTIVE_LOGIC_OPTIONS } from '../editor/lorebook/constants';

export type ChangeStatus = 'added' | 'deleted' | 'edited';

/** A setting that differs. Empty sides are ''; long values render as a text diff. */
export interface SettingChange {
  label: string;
  before: string;
  after: string;
  long: boolean;
}

export type SnapshotChange =
  | { id: string; kind: 'text'; label: string; before: string; after: string }
  | { id: string; kind: 'image'; before: string; after: string }
  | { id: string; kind: 'greeting'; status: ChangeStatus; index: number; before: string; after: string }
  | {
      id: string;
      kind: 'entry';
      status: ChangeStatus;
      entryId: number;
      title: string;
      beforeKeys: string;
      afterKeys: string;
      keysChanged: boolean;
      beforeContent: string;
      afterContent: string;
      contentChanged: boolean;
      settings: SettingChange[];
    }
  | { id: string; kind: 'book-settings'; settings: SettingChange[] };

/** One changed section and the cards that show it. Restore works on the whole section. */
export interface SnapshotChangeGroup {
  entry: SnapshotDiffEntry;
  changes: SnapshotChange[];
}

const LONG_SETTING_CHARS = 60;

const ENTRY_SETTING_LABELS: Record<string, string> = {
  comment: 'Title',
  name: 'Internal notes',
  secondary_keys: 'Secondary keys',
  enabled: 'Enabled',
  constant: 'Constant',
  selective: 'Selective',
  selectiveLogic: 'Selective logic',
  position: 'Position',
  depth: 'Depth',
  role: 'Role',
  insertion_order: 'Insertion order',
  priority: 'Priority',
  probability: 'Probability %',
  useProbability: 'Use probability',
  case_sensitive: 'Case sensitive',
  matchWholeWords: 'Match whole words',
  excludeRecursion: 'Non-recursable',
  preventRecursion: 'Prevent further recursion',
  delayUntilRecursion: 'Delay until recursion',
};

const BOOK_SETTING_LABELS: Record<string, string> = {
  name: 'Book name',
  description: 'Description',
  scan_depth: 'Scan depth',
  token_budget: 'Token budget',
  recursive_scanning: 'Recursive scanning',
};

const EXTENSION_LABELS: Record<string, string> = {
  context_enabled: 'AI context',
};

const OPTION_LABELS: Record<string, ReadonlyArray<{ value: unknown; label: string }>> = {
  position: POSITION_OPTIONS,
  selectiveLogic: SELECTIVE_LOGIC_OPTIONS,
  role: DEPTH_ROLE_OPTIONS,
};

function normalizeText(value: string): string {
  return value.includes('\r') ? value.replace(/\r\n?/g, '\n') : value;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === 'object' && Object.keys(value).length === 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** One `path: value` line per leaf, so nested data diffs line by line. */
function flattenLines(value: unknown, path = ''): string[] {
  if (isEmptyValue(value)) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenLines(item, `${path}[${index}]`));
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .flatMap((key) => flattenLines(record[key], path ? `${path}.${key}` : key));
  }
  return [`${path}: ${typeof value === 'string' ? JSON.stringify(normalizeText(value)) : String(value)}`];
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return normalizeText(value);
  if (Array.isArray(value)) return value.map(toText).join('\n');
  if (typeof value === 'object') return flattenLines(value).join('\n');
  return String(value);
}

function formatSetting(key: string, value: unknown): string {
  if (isEmptyValue(value)) return '';
  const option = OPTION_LABELS[key]?.find((candidate) => candidate.value === value);
  if (option) return option.label;
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (typeof value === 'string') return normalizeText(value);
  if (Array.isArray(value)) return value.map((item) => toText(item)).join(', ');
  if (typeof value === 'object') return flattenLines(value).join('\n');
  return String(value);
}

function settingChange(label: string, before: string, after: string): SettingChange {
  const long = [before, after].some((text) => text.length > LONG_SETTING_CHARS || text.includes('\n'));
  return { label, before, after, long };
}

/** Known keys first, in label order, then anything else a card carries. */
function orderedKeys(labels: Record<string, string>, ...records: Record<string, unknown>[]): string[] {
  const seen = new Set(Object.keys(labels));
  const extra = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!seen.has(key)) extra.add(key);
    }
  }
  return [...Object.keys(labels), ...[...extra].sort()];
}

function settingChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>,
  skip: ReadonlySet<string>,
): SettingChange[] {
  const changes: SettingChange[] = [];
  for (const key of orderedKeys(labels, before, after)) {
    if (skip.has(key)) continue;
    if (key === 'extensions') {
      const beforeExtensions = asRecord(before.extensions);
      const afterExtensions = asRecord(after.extensions);
      for (const extensionKey of orderedKeys(EXTENSION_LABELS, beforeExtensions, afterExtensions)) {
        if (snapshotValuesMatch(beforeExtensions[extensionKey], afterExtensions[extensionKey])) continue;
        changes.push(settingChange(
          EXTENSION_LABELS[extensionKey] ?? `extensions.${extensionKey}`,
          formatSetting(extensionKey, beforeExtensions[extensionKey]),
          formatSetting(extensionKey, afterExtensions[extensionKey]),
        ));
      }
      continue;
    }
    if (snapshotValuesMatch(before[key], after[key])) continue;
    changes.push(settingChange(labels[key] ?? key, formatSetting(key, before[key]), formatSetting(key, after[key])));
  }
  return changes;
}

type SequenceOp = { type: 'same' } | { type: 'del'; i: number } | { type: 'add'; j: number };

// LCS table guard for the middle of two greeting lists (after the shared
// start and end are trimmed). Past this, greetings pair up by position.
const MAX_SEQUENCE_CELLS = 250000;

function diffSequence(before: string[], after: string[]): SequenceOp[] {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
  let endBefore = before.length;
  let endAfter = after.length;
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
    endBefore -= 1;
    endAfter -= 1;
  }
  const ops: SequenceOp[] = [];
  for (let index = 0; index < start; index += 1) ops.push({ type: 'same' });

  const n = endBefore - start;
  const m = endAfter - start;
  if (n * m > MAX_SEQUENCE_CELLS) {
    for (let offset = 0; offset < Math.max(n, m); offset += 1) {
      if (offset < n) ops.push({ type: 'del', i: start + offset });
      if (offset < m) ops.push({ type: 'add', j: start + offset });
    }
  } else if (n > 0 || m > 0) {
    const width = m + 1;
    const lcs = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
        lcs[i * width + j] = before[start + i] === after[start + j]
          ? lcs[(i + 1) * width + j + 1] + 1
          : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (before[start + i] === after[start + j]) {
        ops.push({ type: 'same' });
        i += 1;
        j += 1;
      } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
        ops.push({ type: 'del', i: start + i });
        i += 1;
      } else {
        ops.push({ type: 'add', j: start + j });
        j += 1;
      }
    }
    for (; i < n; i += 1) ops.push({ type: 'del', i: start + i });
    for (; j < m; j += 1) ops.push({ type: 'add', j: start + j });
  }

  for (let index = endBefore; index < before.length; index += 1) ops.push({ type: 'same' });
  return ops;
}

/**
 * Unchanged greetings anchor the alignment, so deleting greeting 2 of 5 shows
 * one deletion instead of every later greeting as edited. Within a run of
 * changes, removals and additions pair up in order as edits.
 */
export function diffGreetings(beforeRaw: string[], afterRaw: string[]): SnapshotChange[] {
  const before = beforeRaw.map(normalizeText);
  const after = afterRaw.map(normalizeText);
  const changes: SnapshotChange[] = [];
  let removed: number[] = [];
  let added: number[] = [];
  const flush = (): void => {
    for (let offset = 0; offset < Math.max(removed.length, added.length); offset += 1) {
      const i = removed[offset];
      const j = added[offset];
      if (i !== undefined && j !== undefined) {
        changes.push({ id: `greeting:edited:${j}`, kind: 'greeting', status: 'edited', index: j, before: before[i], after: after[j] });
      } else if (i !== undefined) {
        changes.push({ id: `greeting:deleted:${i}`, kind: 'greeting', status: 'deleted', index: i, before: before[i], after: '' });
      } else {
        changes.push({ id: `greeting:added:${j}`, kind: 'greeting', status: 'added', index: j, before: '', after: after[j] });
      }
    }
    removed = [];
    added = [];
  };
  for (const op of diffSequence(before, after)) {
    if (op.type === 'same') flush();
    else if (op.type === 'del') removed.push(op.i);
    else added.push(op.j);
  }
  flush();
  return changes;
}

function entryTitle(entry: LorebookEntry): string {
  return entry.comment || entry.name || `Entry #${entry.id}`;
}

const ENTRY_SKIP_KEYS: ReadonlySet<string> = new Set(['id', 'keys', 'content']);

function entryChange(status: ChangeStatus, before: LorebookEntry | undefined, after: LorebookEntry | undefined): SnapshotChange {
  const entry = (after ?? before) as LorebookEntry;
  const beforeContent = toText(before?.content);
  const afterContent = toText(after?.content);
  return {
    id: `entry:${entry.id}`,
    kind: 'entry',
    status,
    entryId: entry.id,
    title: entryTitle(entry),
    beforeKeys: formatSetting('keys', before?.keys),
    afterKeys: formatSetting('keys', after?.keys),
    keysChanged: !snapshotValuesMatch(before?.keys, after?.keys),
    beforeContent,
    afterContent,
    contentChanged: !snapshotValuesMatch(beforeContent, afterContent),
    settings: before && after
      ? settingChanges(asRecord(before), asRecord(after), ENTRY_SETTING_LABELS, ENTRY_SKIP_KEYS)
      : [],
  };
}

const BOOK_SKIP_KEYS: ReadonlySet<string> = new Set(['entries']);

export function diffLorebook(snapshotBook: CharacterBook | null, currentBook: CharacterBook | null): SnapshotChange[] {
  const beforeEntries = snapshotBook?.entries ?? [];
  const afterEntries = currentBook?.entries ?? [];
  const beforeById = new Map(beforeEntries.map((entry) => [entry.id, entry]));
  const afterById = new Map(afterEntries.map((entry) => [entry.id, entry]));
  const changes: SnapshotChange[] = [];

  for (const entry of afterEntries) {
    const before = beforeById.get(entry.id);
    if (!before) changes.push(entryChange('added', undefined, entry));
    else if (!snapshotValuesMatch(before, entry)) changes.push(entryChange('edited', before, entry));
  }
  for (const entry of beforeEntries) {
    if (!afterById.has(entry.id)) changes.push(entryChange('deleted', entry, undefined));
  }

  const settings = settingChanges(asRecord(snapshotBook), asRecord(currentBook), BOOK_SETTING_LABELS, BOOK_SKIP_KEYS);
  const beforeOrder = beforeEntries.filter((entry) => afterById.has(entry.id)).map((entry) => `#${entry.id}`);
  const afterOrder = afterEntries.filter((entry) => beforeById.has(entry.id)).map((entry) => `#${entry.id}`);
  if (beforeOrder.join() !== afterOrder.join()) {
    settings.push(settingChange('Entry order', beforeOrder.join(', '), afterOrder.join(', ')));
  }
  if (settings.length > 0) {
    changes.push({ id: 'book-settings', kind: 'book-settings', settings });
  }
  return changes;
}

function asBook(value: unknown): CharacterBook | null {
  return value !== null && typeof value === 'object' && 'entries' in value ? (value as CharacterBook) : null;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? item : toText(item))) : [];
}

function sectionChanges(entry: SnapshotDiffEntry): SnapshotChange[] {
  switch (entry.section) {
    case 'image':
      return [{
        id: 'image',
        kind: 'image',
        before: typeof entry.snapshotValue === 'string' ? entry.snapshotValue : '',
        after: typeof entry.currentValue === 'string' ? entry.currentValue : '',
      }];
    case 'alternate_greetings':
      return diffGreetings(asStrings(entry.snapshotValue), asStrings(entry.currentValue));
    case 'lorebook':
      return diffLorebook(asBook(entry.snapshotValue), asBook(entry.currentValue));
    default:
      return [];
  }
}

/**
 * Cards for each changed section. Anything without its own view (and any
 * section whose detailed diff comes up empty) falls back to a line diff of
 * its text, so a section flagged as changed always has something to show.
 */
export function buildSnapshotChangeGroups(entries: SnapshotDiffEntry[]): SnapshotChangeGroup[] {
  return entries
    .filter((entry) => entry.changed)
    .map((entry) => {
      const changes = sectionChanges(entry);
      return {
        entry,
        changes: changes.length > 0
          ? changes
          : [{
              id: `field:${entry.section}`,
              kind: 'text',
              label: entry.label,
              before: toText(entry.snapshotValue),
              after: toText(entry.currentValue),
            }],
      };
    });
}
