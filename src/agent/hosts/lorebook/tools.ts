import type { CharacterBook, LorebookEntry } from '../../../db/characterTypes';
import type { ActionResult, ParsedAction } from '../../core/types';
import { formatEntryCatalog } from './catalog';

export const LOREBOOK_TOOL_NAMES = ['list_entries', 'add_entry'] as const;
export type LorebookToolName = (typeof LOREBOOK_TOOL_NAMES)[number];

export const MAX_NEW_ENTRIES_PER_RUN = 25;

export function parseCommaList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function parseConstantFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  return raw.trim().toLowerCase() === 'true';
}

export function nextAvailableEntryId(entries: LorebookEntry[]): number {
  const usedIds = new Set(entries.map((entry) => entry.id));
  let id = 0;
  while (usedIds.has(id)) id += 1;
  return id;
}

export function entryDisplayName(action: ParsedAction): string {
  return (action.headers.name ?? '').trim() || parseCommaList(action.headers.keys)[0] || '';
}

export function findEntryByName(
  entries: LorebookEntry[],
  name: string,
): LorebookEntry | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return entries.find((entry) => {
    const label = (entry.name?.trim() || entry.keys?.[0] || '').toLowerCase();
    return label === needle;
  });
}

export function createBlankLorebookEntry(id: number): LorebookEntry {
  return {
    id,
    keys: [],
    content: '',
    extensions: { context_enabled: false },
    enabled: true,
    case_sensitive: false,
    name: '',
    priority: 0,
    position: 'before_char',
  };
}

export function listEntries(book: CharacterBook): ActionResult {
  const entries = book.entries ?? [];
  const catalog = formatEntryCatalog(book);
  const header = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
  return {
    ok: true,
    toolName: 'list_entries',
    message: `${header}\n${catalog}`,
  };
}

export interface AddEntryResult {
  book: CharacterBook;
  result: ActionResult;
  created: boolean;
  changed: boolean;
  entryId?: number;
}

function addEntryError(book: CharacterBook, message: string): AddEntryResult {
  return {
    book,
    result: { ok: false, toolName: 'add_entry', message },
    created: false,
    changed: false,
  };
}

export function addEntry(
  book: CharacterBook,
  action: ParsedAction,
  revisableIds: ReadonlySet<number> = new Set(),
): AddEntryResult {
  const content = action.body.trim();
  const constant = parseConstantFlag(action.headers.constant);
  const keys = parseCommaList(action.headers.keys);
  const name = entryDisplayName(action);

  if (!content) {
    return addEntryError(book, 'error: content is empty');
  }
  if (!constant && keys.length === 0) {
    return addEntryError(book, 'error: non-constant entries need at least one key');
  }

  const entries = book.entries ?? [];
  const existing = findEntryByName(entries, name);

  if (existing) {
    if (!revisableIds.has(existing.id)) {
      return addEntryError(
        book,
        `exists: #${existing.id} ${existing.name || name} — will not update existing entries`,
      );
    }

    const okResult = {
      ok: true,
      toolName: 'add_entry' as const,
      message: `ok #${existing.id} ${existing.name || name || '(unnamed)'}`,
    };

    if (content.length <= existing.content.trim().length) {
      return {
        book,
        result: okResult,
        created: false,
        changed: false,
        entryId: existing.id,
      };
    }

    const nextEntry: LorebookEntry = {
      ...existing,
      name: name || existing.name,
      keys: keys.length > 0 ? keys : existing.keys,
      content,
    };
    if (constant) nextEntry.constant = true;

    return {
      book: {
        ...book,
        entries: entries.map((entry) => (entry.id === existing.id ? nextEntry : entry)),
      },
      result: okResult,
      created: false,
      changed: true,
      entryId: existing.id,
    };
  }

  const entry = createBlankLorebookEntry(nextAvailableEntryId(entries));
  entry.name = name;
  entry.keys = keys;
  entry.content = content;
  if (constant) entry.constant = true;

  return {
    book: {
      ...book,
      entries: [...entries, entry],
    },
    result: {
      ok: true,
      toolName: 'add_entry',
      message: `ok #${entry.id} ${name || '(unnamed)'}`,
    },
    created: true,
    changed: true,
    entryId: entry.id,
  };
}
