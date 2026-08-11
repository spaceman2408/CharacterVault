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

/** ST-style /pattern/flags; flags limited to typical JS regex flags. */
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
      // Unicode property escapes unavailable: simple boundary fallback.
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

export type BookRecursionStats = {
  entryCount: number;
  edgeCount: number;
  linkedCount: number;
  isolatedCount: number;
  excludeRecursionCount: number;
  preventRecursionCount: number;
  delayUntilRecursionCount: number;
};

export type RecursionComponent = {
  id: string;
  entryIds: number[];
  edges: RecursionEdge[];
};

export type RecursionFlagPatch = Partial<
  Pick<LorebookEntry, 'excludeRecursion' | 'preventRecursion' | 'delayUntilRecursion'>
>;

function degree(graph: RecursionGraph, id: number): number {
  return (graph.outgoing.get(id)?.length ?? 0) + (graph.incoming.get(id)?.length ?? 0);
}

export function countEdges(graph: RecursionGraph): number {
  let n = 0;
  for (const edges of graph.outgoing.values()) n += edges.length;
  return n;
}

export function getBookRecursionStats(
  entries: LorebookEntry[],
  graph: RecursionGraph,
): BookRecursionStats {
  let linkedCount = 0;
  let excludeRecursionCount = 0;
  let preventRecursionCount = 0;
  let delayUntilRecursionCount = 0;

  for (const entry of entries) {
    if (degree(graph, entry.id) > 0) linkedCount += 1;
    if (entry.excludeRecursion === true) excludeRecursionCount += 1;
    if (entry.preventRecursion === true) preventRecursionCount += 1;
    if (entry.delayUntilRecursion === true) delayUntilRecursionCount += 1;
  }

  return {
    entryCount: entries.length,
    edgeCount: countEdges(graph),
    linkedCount,
    isolatedCount: entries.length - linkedCount,
    excludeRecursionCount,
    preventRecursionCount,
    delayUntilRecursionCount,
  };
}

/**
 * Undirected connected components over recursion edges.
 * Isolated entries (degree 0) each form their own component and are
 * returned after linked components, sorted by size desc then min id.
 */
export function getConnectedComponents(
  entries: LorebookEntry[],
  graph: RecursionGraph,
): RecursionComponent[] {
  const ids = entries.map((e) => e.id);
  const idSet = new Set(ids);
  const undirected = new Map<number, Set<number>>();
  for (const id of ids) undirected.set(id, new Set());

  const allEdges: RecursionEdge[] = [];
  for (const edges of graph.outgoing.values()) {
    for (const edge of edges) {
      if (!idSet.has(edge.fromId) || !idSet.has(edge.toId)) continue;
      allEdges.push(edge);
      undirected.get(edge.fromId)?.add(edge.toId);
      undirected.get(edge.toId)?.add(edge.fromId);
    }
  }

  const visited = new Set<number>();
  const components: RecursionComponent[] = [];

  for (const start of ids) {
    if (visited.has(start)) continue;
    const stack = [start];
    visited.add(start);
    const memberSet = new Set<number>();
    while (stack.length > 0) {
      const cur = stack.pop()!;
      memberSet.add(cur);
      for (const next of undirected.get(cur) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }

    const entryIds = [...memberSet].sort((a, b) => a - b);
    const edges = allEdges.filter(
      (e) => memberSet.has(e.fromId) && memberSet.has(e.toId),
    );
    components.push({
      id: `c-${entryIds[0] ?? start}`,
      entryIds,
      edges,
    });
  }

  components.sort((a, b) => {
    const aLinked = a.edges.length > 0 ? 1 : 0;
    const bLinked = b.edges.length > 0 ? 1 : 0;
    if (bLinked !== aLinked) return bLinked - aLinked;
    if (b.entryIds.length !== a.entryIds.length) return b.entryIds.length - a.entryIds.length;
    return (a.entryIds[0] ?? 0) - (b.entryIds[0] ?? 0);
  });

  return components;
}

/**
 * BFS layers for layout within a component.
 * Layer 0 = nodes with no inbound edges from the component (sources).
 * Remaining cycle-only nodes are appended as a final layer.
 */
export function layerComponent(entryIds: number[], graph: RecursionGraph): number[][] {
  if (entryIds.length === 0) return [];
  const member = new Set(entryIds);

  const inDegree = new Map<number, number>();
  for (const id of entryIds) inDegree.set(id, 0);

  for (const id of entryIds) {
    for (const edge of graph.outgoing.get(id) ?? []) {
      if (!member.has(edge.toId)) continue;
      inDegree.set(edge.toId, (inDegree.get(edge.toId) ?? 0) + 1);
    }
  }

  const layers: number[][] = [];
  const placed = new Set<number>();
  let frontier = entryIds.filter((id) => (inDegree.get(id) ?? 0) === 0).sort((a, b) => a - b);

  // If every node has inbound (pure cycle), start with lowest id.
  if (frontier.length === 0) {
    frontier = [[...entryIds].sort((a, b) => a - b)[0]];
  }

  while (frontier.length > 0) {
    layers.push(frontier);
    for (const id of frontier) placed.add(id);
    const nextSet = new Set<number>();
    for (const id of frontier) {
      for (const edge of graph.outgoing.get(id) ?? []) {
        if (!member.has(edge.toId) || placed.has(edge.toId)) continue;
        nextSet.add(edge.toId);
      }
    }
    frontier = [...nextSet].sort((a, b) => a - b);
    // Avoid infinite loop on cycles: only place unplaced neighbors once.
    if (frontier.some((id) => placed.has(id))) {
      frontier = frontier.filter((id) => !placed.has(id));
    }
  }

  const leftover = entryIds.filter((id) => !placed.has(id)).sort((a, b) => a - b);
  if (leftover.length > 0) layers.push(leftover);

  return layers;
}

/** Flatten all edges from a graph (stable order by fromId, toId). */
export function listEdges(graph: RecursionGraph): RecursionEdge[] {
  const edges: RecursionEdge[] = [];
  const fromIds = [...graph.outgoing.keys()].sort((a, b) => a - b);
  for (const fromId of fromIds) {
    const outs = [...(graph.outgoing.get(fromId) ?? [])].sort((a, b) => a.toId - b.toId);
    edges.push(...outs);
  }
  return edges;
}

/** Replace one entry in a list (live draft merge for the open editor). */
export function mergeEntryDraft(
  entries: LorebookEntry[],
  draft: LorebookEntry,
): LorebookEntry[] {
  return entries.map((entry) => (entry.id === draft.id ? draft : entry));
}

export function applyEntryFlagPatch(
  entries: LorebookEntry[],
  ids: number[],
  patch: RecursionFlagPatch,
): LorebookEntry[] {
  if (ids.length === 0) return entries;
  const idSet = new Set(ids);
  return entries.map((entry) => (idSet.has(entry.id) ? { ...entry, ...patch } : entry));
}

export function entryDisplayName(entry: LorebookEntry, fallbackIndex?: number): string {
  const label = (entry.comment || entry.name || '').trim();
  if (label) return label;
  if (fallbackIndex !== undefined) return `Entry ${fallbackIndex}`;
  return `Entry #${entry.id}`;
}

/** Prefer list mode when the book is large enough that a free layout is noisy. */
export function shouldPreferListLayout(entryCount: number, edgeCount: number): boolean {
  return entryCount > 150 || edgeCount > 400;
}
