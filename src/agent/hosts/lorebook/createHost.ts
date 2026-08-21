import type { CharacterBook } from '../../../db/characterTypes';
import { formatCustomContextChunk } from '../../../services/CustomContextService';
import type { ActionResult, AgentHost, ParsedAction } from '../../core/types';
import { formatEntryCatalog } from './catalog';
import { buildLorebookAgentSystemPrompt } from './prompt';
import {
  addEntry,
  entryDisplayName,
  findEntryByName,
  listEntries,
  LOREBOOK_TOOL_NAMES,
  MAX_NEW_ENTRIES_PER_RUN,
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
  const revisableIds = new Set<number>();
  let snapshotTaken = false;
  let cachedCustomChunk: string | null | undefined;

  return {
    toolNames: LOREBOOK_TOOL_NAMES,

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
