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

export function addEntry(
  book: CharacterBook,
  action: ParsedAction,
): { book: CharacterBook; result: ActionResult } {
  const content = action.body.trim();
  const constant = parseConstantFlag(action.headers.constant);
  const keys = parseCommaList(action.headers.keys);
  const name = (action.headers.name ?? '').trim() || keys[0] || '';

  if (!content) {
    return {
      book,
      result: {
        ok: false,
        toolName: 'add_entry',
        message: 'error: content is empty',
      },
    };
  }
  if (!constant && keys.length === 0) {
    return {
      book,
      result: {
        ok: false,
        toolName: 'add_entry',
        message: 'error: non-constant entries need at least one key',
      },
    };
  }

  const entries = book.entries ?? [];
  const entry = createBlankLorebookEntry(nextAvailableEntryId(entries));
  entry.name = name;
  entry.keys = keys;
  entry.content = content;
  if (constant) entry.constant = true;

  const nextBook: CharacterBook = {
    ...book,
    entries: [...entries, entry],
  };

  return {
    book: nextBook,
    result: {
      ok: true,
      toolName: 'add_entry',
      message: `ok #${entry.id} ${name || '(unnamed)'}`,
    },
  };
}
