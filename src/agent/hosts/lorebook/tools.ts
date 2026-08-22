import type { CharacterBook, LorebookEntry } from '../../../db/characterTypes';
import type { ActionResult, ParsedAction } from '../../core/types';
import { parseReplaceAll, replaceText, replacementText, searchText } from '../replaceText';
import {
  applyBookReplacements,
  collectBookTargets,
  formatReplaceAcross,
  replaceAcrossTargets,
  searchTargets,
} from '../search';
import { formatBookAudit } from './audit';
import { formatEntryCatalog } from './catalog';
import { formatRecursionMap } from './recursion';
import {
  applyEntryFlagPatch,
  formatBookSettings,
  formatEntryFlagLines,
  hasAnyFlagHeader,
  parseBookSettings,
  parseEntryFlags,
} from './flags';

export const LOREBOOK_TOOL_NAMES = [
  'list_entries',
  'read_entry',
  'add_entry',
  'update_entry',
  'replace_in_entry',
  'delete_entry',
  'search',
  'replace_across',
  'audit_book',
  'read_recursion',
  'update_book_settings',
] as const;
export type LorebookToolName = (typeof LOREBOOK_TOOL_NAMES)[number];

export const MAX_NEW_ENTRIES_PER_RUN = 50;
export const MAX_UPDATES_PER_RUN = 50;
export const MAX_DELETES_PER_RUN = 50;

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

export function parseEntryId(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^#/, '');
  if (!/^\d+$/.test(trimmed)) return null;
  const id = Number(trimmed);
  if (!Number.isInteger(id) || id < 0) return null;
  return id;
}

export function findEntryById(
  entries: LorebookEntry[],
  id: number,
): LorebookEntry | undefined {
  return entries.find((entry) => entry.id === id);
}

export function formatEntryRead(entry: LorebookEntry): string {
  const name = entry.name?.trim() || '(unnamed)';
  const keys = entry.keys?.length ? entry.keys.join(', ') : '(none)';
  const lines = [`#${entry.id} ${name}`, `keys: ${keys}`, ...formatEntryFlagLines(entry)];
  lines.push('---', entry.content ?? '');
  return lines.join('\n');
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

export function readEntry(book: CharacterBook, action: ParsedAction): ActionResult {
  const id = parseEntryId(action.headers.id);
  if (id == null) {
    return { ok: false, toolName: 'read_entry', message: 'error: id must be a non-negative integer' };
  }
  const entry = findEntryById(book.entries ?? [], id);
  if (!entry) {
    return { ok: false, toolName: 'read_entry', message: `error: no entry #${id}` };
  }
  return {
    ok: true,
    toolName: 'read_entry',
    message: formatEntryRead(entry),
  };
}

export interface UpdateEntryResult {
  book: CharacterBook;
  result: ActionResult;
  changed: boolean;
  entry?: LorebookEntry;
}

function updateEntryError(
  book: CharacterBook,
  message: string,
  toolName: 'update_entry' | 'replace_in_entry' = 'update_entry',
): UpdateEntryResult {
  return {
    book,
    result: { ok: false, toolName, message },
    changed: false,
  };
}

export function updateEntry(book: CharacterBook, action: ParsedAction): UpdateEntryResult {
  const id = parseEntryId(action.headers.id);
  if (id == null) {
    return updateEntryError(book, 'error: id must be a non-negative integer');
  }

  const entries = book.entries ?? [];
  const existing = findEntryById(entries, id);
  if (!existing) {
    return updateEntryError(book, `error: no entry #${id}`);
  }

  const hasContent = action.body.trim().length > 0;
  const hasName = Object.prototype.hasOwnProperty.call(action.headers, 'name');
  const hasKeys = Object.prototype.hasOwnProperty.call(action.headers, 'keys');
  const hasConstant = Object.prototype.hasOwnProperty.call(action.headers, 'constant');
  const hasFlags = hasAnyFlagHeader(action.headers);
  if (!hasContent && !hasName && !hasKeys && !hasConstant && !hasFlags) {
    return updateEntryError(book, 'error: nothing to update');
  }

  const flags = parseEntryFlags(action.headers);
  if ('error' in flags) {
    return updateEntryError(book, flags.error);
  }

  const content = hasContent ? action.body.trim() : existing.content;
  const name = hasName ? (action.headers.name ?? '').trim() : existing.name;
  const keys = hasKeys ? parseCommaList(action.headers.keys) : existing.keys;
  const constant = hasConstant ? parseConstantFlag(action.headers.constant) : Boolean(existing.constant);

  if (!content) {
    return updateEntryError(book, 'error: content is empty');
  }
  if (!constant && keys.length === 0) {
    return updateEntryError(book, 'error: non-constant entries need at least one key');
  }

  const displayName = (name ?? '').trim() || keys[0] || '';
  const collision = findEntryByName(entries, displayName);
  if (collision && collision.id !== existing.id) {
    return updateEntryError(
      book,
      `exists: #${collision.id} ${collision.name || displayName} — pick a different name`,
    );
  }

  let nextEntry: LorebookEntry = {
    ...existing,
    name,
    keys,
    content,
  };
  if (constant) nextEntry.constant = true;
  else if (hasConstant) delete nextEntry.constant;
  nextEntry = applyEntryFlagPatch(nextEntry, flags.patch);

  const sameList = (a: string[] | undefined, b: string[] | undefined): boolean => {
    const left = a ?? [];
    const right = b ?? [];
    return left.length === right.length && left.every((item, index) => item === right[index]);
  };

  const unchanged =
    nextEntry.content === existing.content &&
    nextEntry.name === existing.name &&
    sameList(nextEntry.keys, existing.keys) &&
    Boolean(nextEntry.constant) === Boolean(existing.constant) &&
    nextEntry.enabled === existing.enabled &&
    nextEntry.position === existing.position &&
    nextEntry.depth === existing.depth &&
    nextEntry.insertion_order === existing.insertion_order &&
    nextEntry.probability === existing.probability &&
    Boolean(nextEntry.selective) === Boolean(existing.selective) &&
    sameList(nextEntry.secondary_keys, existing.secondary_keys) &&
    Boolean(nextEntry.useProbability) === Boolean(existing.useProbability) &&
    Boolean(nextEntry.excludeRecursion) === Boolean(existing.excludeRecursion) &&
    Boolean(nextEntry.preventRecursion) === Boolean(existing.preventRecursion) &&
    Boolean(nextEntry.delayUntilRecursion) === Boolean(existing.delayUntilRecursion);
  if (unchanged) {
    return {
      book,
      result: {
        ok: true,
        toolName: 'update_entry',
        message: `ok #${existing.id} ${existing.name || displayName || '(unnamed)'}`,
      },
      changed: false,
      entry: existing,
    };
  }

  return {
    book: {
      ...book,
      entries: entries.map((entry) => (entry.id === existing.id ? nextEntry : entry)),
    },
    result: {
      ok: true,
      toolName: 'update_entry',
      message: `ok #${existing.id} ${nextEntry.name?.trim() || displayName || '(unnamed)'}`,
    },
    changed: true,
    entry: nextEntry,
  };
}

export function replaceInEntry(book: CharacterBook, action: ParsedAction): UpdateEntryResult {
  const id = parseEntryId(action.headers.id);
  if (id == null) {
    return updateEntryError(book, 'error: id must be a non-negative integer', 'replace_in_entry');
  }

  const entries = book.entries ?? [];
  const existing = findEntryById(entries, id);
  if (!existing) {
    return updateEntryError(book, `error: no entry #${id}`, 'replace_in_entry');
  }

  const applied = replaceText(
    existing.content ?? '',
    searchText(action),
    replacementText(action),
    parseReplaceAll(action.headers.replace_all),
  );
  if (!applied.ok) {
    return updateEntryError(book, applied.message, 'replace_in_entry');
  }

  const displayName = existing.name?.trim() || existing.keys?.[0] || '(unnamed)';
  if (applied.text === (existing.content ?? '')) {
    return {
      book,
      result: {
        ok: true,
        toolName: 'replace_in_entry',
        message: `ok #${existing.id} ${displayName} — replaced ${applied.count}`,
      },
      changed: false,
      entry: existing,
    };
  }

  const nextEntry: LorebookEntry = { ...existing, content: applied.text };
  return {
    book: {
      ...book,
      entries: entries.map((entry) => (entry.id === existing.id ? nextEntry : entry)),
    },
    result: {
      ok: true,
      toolName: 'replace_in_entry',
      message: `ok #${existing.id} ${nextEntry.name?.trim() || displayName} — replaced ${applied.count}`,
    },
    changed: true,
    entry: nextEntry,
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
  const flags = parseEntryFlags(action.headers);
  if ('error' in flags) {
    return addEntryError(book, flags.error);
  }

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
      const patched = applyEntryFlagPatch(existing, flags.patch);
      if (patched === existing) {
        return {
          book,
          result: okResult,
          created: false,
          changed: false,
          entryId: existing.id,
        };
      }
      return {
        book: {
          ...book,
          entries: entries.map((entry) => (entry.id === existing.id ? patched : entry)),
        },
        result: okResult,
        created: false,
        changed: true,
        entryId: existing.id,
      };
    }

    let nextEntry: LorebookEntry = {
      ...existing,
      name: name || existing.name,
      keys: keys.length > 0 ? keys : existing.keys,
      content,
    };
    if (constant) nextEntry.constant = true;
    nextEntry = applyEntryFlagPatch(nextEntry, flags.patch);

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

  const entry = applyEntryFlagPatch(createBlankLorebookEntry(nextAvailableEntryId(entries)), flags.patch);
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

export interface DeleteEntryResult {
  book: CharacterBook;
  result: ActionResult;
  changed: boolean;
  entryId?: number;
}

export function deleteEntry(book: CharacterBook, action: ParsedAction): DeleteEntryResult {
  const id = parseEntryId(action.headers.id);
  if (id == null) {
    return {
      book,
      result: { ok: false, toolName: 'delete_entry', message: 'error: id must be a non-negative integer' },
      changed: false,
    };
  }

  const entries = book.entries ?? [];
  const existing = findEntryById(entries, id);
  if (!existing) {
    return {
      book,
      result: { ok: false, toolName: 'delete_entry', message: `error: no entry #${id}` },
      changed: false,
    };
  }

  const label = existing.name?.trim() || existing.keys?.[0] || '(unnamed)';
  return {
    book: {
      ...book,
      entries: entries.filter((entry) => entry.id !== id),
    },
    result: {
      ok: true,
      toolName: 'delete_entry',
      message: `ok #${id} ${label}`,
    },
    changed: true,
    entryId: id,
  };
}

export function searchBook(book: CharacterBook, action: ParsedAction): ActionResult {
  return searchTargets(collectBookTargets(book), action);
}

export function replaceAcrossBook(
  book: CharacterBook,
  action: ParsedAction,
): { book: CharacterBook; result: ActionResult; changed: boolean } {
  const applied = replaceAcrossTargets(collectBookTargets(book), action);
  if (!applied.ok) {
    return {
      book,
      changed: false,
      result: { ok: false, toolName: 'replace_across', message: applied.message },
    };
  }
  return {
    book: applyBookReplacements(book, applied.replacements),
    changed: true,
    result: { ok: true, toolName: 'replace_across', message: formatReplaceAcross(applied) },
  };
}

export function auditBook(book: CharacterBook): ActionResult {
  return { ok: true, toolName: 'audit_book', message: formatBookAudit(book) };
}

export function readRecursion(book: CharacterBook, action: ParsedAction): ActionResult {
  const raw = action.headers.id;
  if (raw != null && raw.trim() !== '') {
    const id = parseEntryId(raw);
    if (id == null) {
      return { ok: false, toolName: 'read_recursion', message: 'error: id must be a non-negative integer' };
    }
    const entry = findEntryById(book.entries ?? [], id);
    if (!entry) {
      return { ok: false, toolName: 'read_recursion', message: `error: no entry #${id}` };
    }
    return { ok: true, toolName: 'read_recursion', message: formatRecursionMap(book, id) };
  }
  return { ok: true, toolName: 'read_recursion', message: formatRecursionMap(book) };
}

export function updateBookSettings(
  book: CharacterBook,
  action: ParsedAction,
): { book: CharacterBook; result: ActionResult; changed: boolean } {
  const parsed = parseBookSettings(action.headers, action.body);
  if ('error' in parsed) {
    return {
      book,
      changed: false,
      result: { ok: false, toolName: 'update_book_settings', message: parsed.error },
    };
  }
  const next: CharacterBook = { ...book, ...parsed.patch };
  const unchanged =
    next.name === book.name &&
    next.description === book.description &&
    next.scan_depth === book.scan_depth &&
    next.token_budget === book.token_budget &&
    next.recursive_scanning === book.recursive_scanning;
  return {
    book: next,
    changed: !unchanged,
    result: {
      ok: true,
      toolName: 'update_book_settings',
      message: `ok ${formatBookSettings(next)}`,
    },
  };
}
