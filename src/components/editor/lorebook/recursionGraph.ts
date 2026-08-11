/**
 * Pure recursion analysis for lorebook entries (authoring aid).
 * Edge A → B means "content of A can recursively activate B via primary keys",
 * aligned with SillyTavern recursive scanning (not a full runtime simulator).
 */

import type { LorebookEntry } from '../../../db/characterTypes';

export type RecursionEdge = {
  fromId: number;
  toId: number;
  matchedKeys: string[];
};

export type RecursionGraph = {
  outgoing: Map<number, RecursionEdge[]>;
  incoming: Map<number, RecursionEdge[]>;
};

export type EgoRecursionStats = {
  triggers: number;
  triggeredBy: number;
};

/** ST-style /pattern/flags — flags limited to typical JS regex flags. */
const REGEX_KEY = /^\/(.+)\/([gimsuy]*)$/s;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whether `content` contains a hit for a single lorebook key.
 * Supports plain keys and ST `/regex/flags` keys (invalid regex → literal).
 */
export function contentMatchesKey(
  content: string,
  key: string,
  opts: {
    caseSensitive?: boolean | null;
    matchWholeWords?: boolean | null;
  } = {},
): boolean {
  const trimmed = key.trim();
  if (!trimmed || !content) return false;

  const caseSensitive = opts.caseSensitive === true;
  const matchWholeWords = opts.matchWholeWords === true;

  const regexMatch = REGEX_KEY.exec(trimmed);
  if (regexMatch) {
    const body = regexMatch[1];
    let flags = regexMatch[2] ?? '';
    if (!caseSensitive && !flags.includes('i')) {
      flags += 'i';
    }
    // Drop global so lastIndex does not skip hits on repeated tests.
    flags = flags.replace(/g/g, '');
    try {
      return new RegExp(body, flags).test(content);
    } catch {
      // Fall through to literal match on the raw key string.
    }
  }

  if (matchWholeWords) {
    const flags = caseSensitive ? 'u' : 'iu';
    try {
      const pattern = `(?<![\\p{L}\\p{N}_])${escapeRegExp(trimmed)}(?![\\p{L}\\p{N}_])`;
      return new RegExp(pattern, flags).test(content);
    } catch {
      // Unicode property escapes unavailable — simple boundary fallback.
      const flags = caseSensitive ? '' : 'i';
      return new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, flags).test(content);
    }
  }

  if (caseSensitive) {
    return content.includes(trimmed);
  }
  return content.toLowerCase().includes(trimmed.toLowerCase());
}

function keysMatchingContent(
  content: string,
  target: LorebookEntry,
): string[] {
  const keys = target.keys ?? [];
  const matched: string[] = [];
  for (const key of keys) {
    if (
      contentMatchesKey(content, key, {
        caseSensitive: target.case_sensitive,
        matchWholeWords: target.matchWholeWords,
      })
    ) {
      matched.push(key);
    }
  }
  return matched;
}

/**
 * Build directed recursion edges for a book.
 * Outgoing[A] = entries A can unlock; incoming[B] = entries that can unlock B.
 */
export function buildRecursionGraph(entries: LorebookEntry[]): RecursionGraph {
  const outgoing = new Map<number, RecursionEdge[]>();
  const incoming = new Map<number, RecursionEdge[]>();

  for (const entry of entries) {
    outgoing.set(entry.id, []);
    incoming.set(entry.id, []);
  }

  for (const source of entries) {
    if (source.preventRecursion === true) continue;
    const content = source.content ?? '';
    if (!content) continue;

    for (const target of entries) {
      if (target.id === source.id) continue;
      if (target.excludeRecursion === true) continue;
      if (!(target.keys?.length)) continue;

      const matchedKeys = keysMatchingContent(content, target);
      if (matchedKeys.length === 0) continue;

      const edge: RecursionEdge = {
        fromId: source.id,
        toId: target.id,
        matchedKeys,
      };
      outgoing.get(source.id)?.push(edge);
      incoming.get(target.id)?.push(edge);
    }
  }

  return { outgoing, incoming };
}

export function getEgoStats(graph: RecursionGraph, entryId: number): EgoRecursionStats {
  return {
    triggers: graph.outgoing.get(entryId)?.length ?? 0,
    triggeredBy: graph.incoming.get(entryId)?.length ?? 0,
  };
}

/** Replace one entry in a list (live draft merge for the open editor). */
export function mergeEntryDraft(
  entries: LorebookEntry[],
  draft: LorebookEntry,
): LorebookEntry[] {
  return entries.map((entry) => (entry.id === draft.id ? draft : entry));
}

export function entryDisplayName(entry: LorebookEntry, fallbackIndex?: number): string {
  const label = (entry.comment || entry.name || '').trim();
  if (label) return label;
  if (fallbackIndex !== undefined) return `Entry ${fallbackIndex}`;
  return `Entry #${entry.id}`;
}
