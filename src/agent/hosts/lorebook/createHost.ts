import type { CharacterBook } from '../../../db/characterTypes';
import { formatCustomContextChunk } from '../../../services/CustomContextService';
import type { ActionResult, AgentHost, ParsedAction } from '../../core/types';
import { formatEntryCatalog } from './catalog';
import { buildLorebookAgentSystemPrompt } from './prompt';
import {
  addEntry,
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
        if (addedThisRun >= maxNewEntries) {
          return {
            ok: false,
            toolName: 'add_entry',
            message: `limit: max ${maxNewEntries} new entries per run`,
          };
        }
        const applied = addEntry(book, action);
        if (!applied.result.ok) return applied.result;
        book = applied.book;
        dirty = true;
        addedThisRun += 1;
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
