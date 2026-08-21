import type { CharacterBook } from '../../../db/characterTypes';
import { formatCustomContextChunk } from '../../../services/CustomContextService';
import type { ActionResult, AgentHost, ParsedAction } from '../../core/types';
import { formatEntryCatalog } from './catalog';
import { buildLorebookAgentSystemPrompt } from './prompt';
import { LOREBOOK_TOOL_SPECS } from './schemas';
import {
  addEntry,
  deleteEntry,
  entryDisplayName,
  findEntryById,
  findEntryByName,
  formatEntryRead,
  listEntries,
  LOREBOOK_TOOL_NAMES,
  MAX_DELETES_PER_RUN,
  MAX_NEW_ENTRIES_PER_RUN,
  MAX_UPDATES_PER_RUN,
  parseEntryId,
  readEntry,
  replaceInEntry,
  updateEntry,
} from './tools';

export interface LorebookHostIO {
  getBook: () => CharacterBook;
  setBook: (book: CharacterBook) => Promise<void>;
  getCustomContext: () => Promise<string | null>;
  takeSnapshot?: () => Promise<void>;
  maxNewEntries?: number;
}

export function createLorebookHost(io: LorebookHostIO): AgentHost {
  const maxNewEntries = io.maxNewEntries ?? MAX_NEW_ENTRIES_PER_RUN;
  let book = io.getBook();
  let dirty = false;
  let addedThisRun = 0;
  let updatedThisRun = 0;
  let deletedThisRun = 0;
  const revisableIds = new Set<number>();
  const entryReadCache = new Map<number, string>();
  let snapshotTaken = false;
  let cachedCustomChunk: string | null | undefined;

  const cacheEntryRead = (id: number, formatted: string): void => {
    entryReadCache.set(id, formatted);
  };

  const cacheBookEntry = (id: number): void => {
    const entry = findEntryById(book.entries ?? [], id);
    if (entry) cacheEntryRead(id, formatEntryRead(entry));
  };

  return {
    toolNames: LOREBOOK_TOOL_NAMES,
    tools: LOREBOOK_TOOL_SPECS,

    buildSystemPrompt(input: { extraChunks: string[] }): string {
      return buildLorebookAgentSystemPrompt(input.extraChunks);
    },

    async extraContextChunks(): Promise<string[]> {
      if (cachedCustomChunk === undefined) {
        const custom = await io.getCustomContext();
        cachedCustomChunk = custom ? formatCustomContextChunk(custom) : null;
      }
      const chunks: string[] = [];
      if (cachedCustomChunk) chunks.push(cachedCustomChunk);
      chunks.push(formatEntryCatalog(book));
      return chunks;
    },

    async execute(action: ParsedAction): Promise<ActionResult> {
      if (action.name === 'list_entries') {
        return listEntries(book);
      }
      if (action.name === 'read_entry') {
        const parsedId = parseEntryId(action.headers.id);
        if (parsedId != null) {
          const cached = entryReadCache.get(parsedId);
          if (cached != null) {
            return { ok: true, toolName: 'read_entry', message: cached };
          }
        }
        const result = readEntry(book, action);
        if (result.ok && parsedId != null) cacheEntryRead(parsedId, result.message);
        return result;
      }
      if (action.name === 'add_entry') {
        const existing = findEntryByName(book.entries ?? [], entryDisplayName(action));
        const revisable = existing != null && revisableIds.has(existing.id);
        if (!revisable && addedThisRun >= maxNewEntries) {
          return {
            ok: false,
            toolName: 'add_entry',
            message: `limit: max ${maxNewEntries} new entries per run`,
          };
        }
        const applied = addEntry(book, action, revisableIds);
        if (!applied.result.ok) return applied.result;
        if (applied.entryId != null) revisableIds.add(applied.entryId);
        if (applied.created) addedThisRun += 1;
        if (applied.changed) {
          book = applied.book;
          dirty = true;
          if (applied.entryId != null) cacheBookEntry(applied.entryId);
        }
        return applied.result;
      }
      if (action.name === 'update_entry') {
        if (updatedThisRun >= MAX_UPDATES_PER_RUN) {
          return {
            ok: false,
            toolName: 'update_entry',
            message: `limit: max ${MAX_UPDATES_PER_RUN} updates per run`,
          };
        }
        const applied = updateEntry(book, action);
        if (!applied.result.ok) return applied.result;
        if (applied.changed) {
          book = applied.book;
          dirty = true;
          updatedThisRun += 1;
        }
        if (applied.entry) cacheEntryRead(applied.entry.id, formatEntryRead(applied.entry));
        return applied.result;
      }
      if (action.name === 'replace_in_entry') {
        if (updatedThisRun >= MAX_UPDATES_PER_RUN) {
          return {
            ok: false,
            toolName: 'replace_in_entry',
            message: `limit: max ${MAX_UPDATES_PER_RUN} updates per run`,
          };
        }
        const applied = replaceInEntry(book, action);
        if (!applied.result.ok) return applied.result;
        if (applied.changed) {
          book = applied.book;
          dirty = true;
          updatedThisRun += 1;
        }
        if (applied.entry) cacheEntryRead(applied.entry.id, formatEntryRead(applied.entry));
        return applied.result;
      }
      if (action.name === 'delete_entry') {
        if (deletedThisRun >= MAX_DELETES_PER_RUN) {
          return {
            ok: false,
            toolName: 'delete_entry',
            message: `limit: max ${MAX_DELETES_PER_RUN} deletes per run`,
          };
        }
        const applied = deleteEntry(book, action);
        if (!applied.result.ok) return applied.result;
        book = applied.book;
        dirty = true;
        deletedThisRun += 1;
        if (applied.entryId != null) {
          entryReadCache.delete(applied.entryId);
          revisableIds.delete(applied.entryId);
        }
        return applied.result;
      }
      return {
        ok: false,
        toolName: action.name,
        message: `unknown_action: ${action.name}`,
      };
    },

    async flush(): Promise<void> {
      if (!dirty) return;
      if (!snapshotTaken) {
        await io.takeSnapshot?.();
        snapshotTaken = true;
      }
      await io.setBook(book);
      dirty = false;
    },
  };
}
