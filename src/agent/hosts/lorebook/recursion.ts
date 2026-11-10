import type { CharacterBook, LorebookEntry } from '../../../db/characterTypes';
import {
  buildRecursionGraph,
  getBookRecursionStats,
  type RecursionEdge,
  type RecursionGraph,
} from '../../../components/editor/lorebook/recursionGraph';
import { recursiveScanningLabel } from './flags';

const MAX_SOURCE_LINES = 80;
const SCANNING_OFF_WARNING = 'Warning: recursive_scanning is off, so these edges will not fire in SillyTavern.';
const MAX_NEIGHBORS = 40;
const MAX_ISOLATED = 24;
const MAX_FLAGGED = 24;

export const NEVER_ACTIVATES = 'excludeRecursion with delayUntilRecursion means this entry never activates';

/** The initial scan skips a delayed entry and recursive passes skip an excluded one. Constants skip both checks. */
export function neverActivates(entry: LorebookEntry): boolean {
  return entry.excludeRecursion === true && entry.delayUntilRecursion === true && !entry.constant;
}

export function entryLabel(entry: LorebookEntry): string {
  return `#${entry.id} ${entry.name?.trim() || entry.comment?.trim() || entry.keys?.[0] || '(unnamed)'}`;
}

function labelFor(
  byId: Map<number, LorebookEntry>,
  id: number,
): string {
  const entry = byId.get(id);
  return entry ? entryLabel(entry) : `#${id}`;
}

function formatMatchedKeys(keys: string[]): string {
  const shown = keys.slice(0, 4);
  const extra = keys.length - shown.length;
  return extra > 0 ? `${shown.join(', ')}, …+${extra}` : shown.join(', ');
}

function formatEdge(edge: RecursionEdge, byId: Map<number, LorebookEntry>): string {
  return `${labelFor(byId, edge.fromId)} → ${labelFor(byId, edge.toId)} (${formatMatchedKeys(edge.matchedKeys)})`;
}

export function findCycle(
  entries: LorebookEntry[],
  graph: RecursionGraph = buildRecursionGraph(entries),
): string | null {
  const visiting = new Set<number>();
  const visited = new Set<number>();
  const stack: number[] = [];

  const dfs = (id: number): number[] | null => {
    if (visiting.has(id)) {
      const at = stack.indexOf(id);
      return at >= 0 ? stack.slice(at).concat(id) : [id];
    }
    if (visited.has(id)) return null;
    visiting.add(id);
    stack.push(id);
    for (const edge of graph.outgoing.get(id) ?? []) {
      const cycle = dfs(edge.toId);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  };

  for (const entry of entries) {
    const cycle = dfs(entry.id);
    if (cycle) return cycle.map((id) => `#${id}`).join(' → ');
  }
  return null;
}

function flagBits(entry: LorebookEntry): string[] {
  const bits: string[] = [];
  if (entry.excludeRecursion) bits.push('excludeRecursion');
  if (entry.preventRecursion) bits.push('preventRecursion');
  if (entry.delayUntilRecursion) bits.push('delayUntilRecursion');
  return bits;
}

/** Edges the graph would have if no entry had excludeRecursion or preventRecursion. */
function findBlockedEdges(entries: LorebookEntry[], graph: RecursionGraph): RecursionEdge[] {
  if (!entries.some((entry) => entry.excludeRecursion || entry.preventRecursion)) return [];
  const open = buildRecursionGraph(
    entries.map((entry) => ({ ...entry, excludeRecursion: false, preventRecursion: false })),
  );
  const blocked: RecursionEdge[] = [];
  for (const [fromId, edges] of open.outgoing) {
    const kept = new Set((graph.outgoing.get(fromId) ?? []).map((edge) => edge.toId));
    for (const edge of edges) if (!kept.has(edge.toId)) blocked.push(edge);
  }
  return blocked;
}

function blockReason(edge: RecursionEdge, byId: Map<number, LorebookEntry>): string {
  const reasons: string[] = [];
  if (byId.get(edge.fromId)?.preventRecursion) reasons.push(`#${edge.fromId} has preventRecursion`);
  if (byId.get(edge.toId)?.excludeRecursion) reasons.push(`#${edge.toId} has excludeRecursion`);
  return reasons.join(', ');
}

function edgeLines(
  title: string,
  edges: RecursionEdge[],
  byId: Map<number, LorebookEntry>,
  blocked = false,
): string[] {
  if (edges.length === 0) return [`${title}: (none)`];
  const shown = edges.slice(0, MAX_NEIGHBORS);
  const lines = [`${title}:`];
  for (const edge of shown) {
    lines.push(`- ${formatEdge(edge, byId)}${blocked ? ` — ${blockReason(edge, byId)}` : ''}`);
  }
  if (edges.length > shown.length) lines.push(`…and ${edges.length - shown.length} more`);
  return lines;
}

export function formatRecursionMap(book: CharacterBook, focusId?: number): string {
  const entries = book.entries ?? [];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const graph = buildRecursionGraph(entries);
  const stats = getBookRecursionStats(entries, graph);
  const cycle = findCycle(entries, graph);
  const scan = recursiveScanningLabel(book);
  const blocked = findBlockedEdges(entries, graph);

  if (focusId != null) {
    return formatEgoMap(focusId, byId, graph, blocked, scan, cycle);
  }

  const header = `Recursion map — ${stats.entryCount} ${
    stats.entryCount === 1 ? 'entry' : 'entries'
  }, ${stats.edgeCount} ${stats.edgeCount === 1 ? 'edge' : 'edges'}, ${stats.isolatedCount} isolated, cycle: ${
    cycle ?? 'none'
  }; recursive_scanning ${scan}`;

  const lines = [header];
  if (scan === 'off' && stats.edgeCount > 0) lines.push(SCANNING_OFF_WARNING);

  const sources = entries.filter((entry) => (graph.outgoing.get(entry.id) ?? []).length > 0);
  const shownSources = sources.slice(0, MAX_SOURCE_LINES);
  for (const source of shownSources) {
    const outgoing = graph.outgoing.get(source.id) ?? [];
    const parts = outgoing.map((edge) => {
      const target = labelFor(byId, edge.toId);
      return `${target} (${formatMatchedKeys(edge.matchedKeys)})`;
    });
    lines.push(`${entryLabel(source)} → ${parts.join('; ')}`);
  }
  if (sources.length > shownSources.length) {
    const extra = sources.length - shownSources.length;
    lines.push(`…and ${extra} more source ${extra === 1 ? 'entry' : 'entries'}`);
  }

  const isolated = entries.filter((entry) => {
    const out = graph.outgoing.get(entry.id)?.length ?? 0;
    const incoming = graph.incoming.get(entry.id)?.length ?? 0;
    return out === 0 && incoming === 0;
  });
  if (isolated.length > 0) {
    const shown = isolated.slice(0, MAX_ISOLATED).map(entryLabel);
    const extra = isolated.length - shown.length;
    lines.push(
      `Isolated: ${shown.join(', ')}${extra > 0 ? `, …+${extra}` : ''}`,
    );
  }

  if (blocked.length > 0) {
    lines.push(
      `Blocked by excludeRecursion / preventRecursion: ${blocked.length} ${
        blocked.length === 1 ? 'edge' : 'edges'
      }; read_recursion with an id lists them.`,
    );
  }

  const flagged = entries.filter((entry) => flagBits(entry).length > 0);
  if (flagged.length > 0) {
    const shown = flagged.slice(0, MAX_FLAGGED).map((entry) => {
      const note = neverActivates(entry) ? ' (never activates)' : '';
      return `${entryLabel(entry)} ${flagBits(entry).join(', ')}${note}`;
    });
    const extra = flagged.length - shown.length;
    lines.push(`Flags: ${shown.join('; ')}${extra > 0 ? `; …+${extra}` : ''}`);
  }

  return lines.join('\n');
}

function formatEgoMap(
  focusId: number,
  byId: Map<number, LorebookEntry>,
  graph: RecursionGraph,
  blocked: RecursionEdge[],
  scan: string,
  cycle: string | null,
): string {
  const entry = byId.get(focusId);
  if (!entry) return `error: no entry #${focusId}`;

  const incoming = graph.incoming.get(focusId) ?? [];
  const outgoing = graph.outgoing.get(focusId) ?? [];
  const blockedIn = blocked.filter((edge) => edge.toId === focusId);
  const blockedOut = blocked.filter((edge) => edge.fromId === focusId);
  const flags = flagBits(entry);
  const header = `Recursion for ${entryLabel(entry)} — ${incoming.length} in, ${outgoing.length} out; recursive_scanning ${scan}`;

  const lines = [header];
  if (scan === 'off' && incoming.length + outgoing.length > 0) lines.push(SCANNING_OFF_WARNING);
  if (flags.length > 0) lines.push(`flags: ${flags.join(', ')}`);
  if (neverActivates(entry)) lines.push(`Warning: ${NEVER_ACTIVATES}.`);
  if (cycle) lines.push(`cycle: ${cycle}`);

  lines.push(...edgeLines('Incoming', incoming, byId));
  if (blockedIn.length > 0) lines.push(...edgeLines('Blocked incoming', blockedIn, byId, true));
  lines.push(...edgeLines('Outgoing', outgoing, byId));
  if (blockedOut.length > 0) lines.push(...edgeLines('Blocked outgoing', blockedOut, byId, true));

  return lines.join('\n');
}
