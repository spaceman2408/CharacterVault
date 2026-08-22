import type { CharacterBook, LorebookEntry } from '../../../db/characterTypes';
import {
  buildRecursionGraph,
  getBookRecursionStats,
  type RecursionEdge,
  type RecursionGraph,
} from '../../../components/editor/lorebook/recursionGraph';

const MAX_SOURCE_LINES = 80;
const MAX_NEIGHBORS = 40;
const MAX_ISOLATED = 24;

function entryLabel(entry: LorebookEntry): string {
  return `#${entry.id} ${entry.name?.trim() || entry.keys?.[0] || '(unnamed)'}`;
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

function scanningLabel(book: CharacterBook): string {
  if (book.recursive_scanning === false) return 'off';
  if (book.recursive_scanning === true) return 'on';
  return 'unset';
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

export function formatRecursionMap(book: CharacterBook, focusId?: number): string {
  const entries = book.entries ?? [];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const graph = buildRecursionGraph(entries);
  const stats = getBookRecursionStats(entries, graph);
  const cycle = findCycle(entries, graph);
  const scan = scanningLabel(book);

  if (focusId != null) {
    return formatEgoMap(focusId, byId, graph, scan, cycle);
  }

  const header = `Recursion map — ${stats.entryCount} ${
    stats.entryCount === 1 ? 'entry' : 'entries'
  }, ${stats.edgeCount} ${stats.edgeCount === 1 ? 'edge' : 'edges'}, ${stats.isolatedCount} isolated, cycle: ${
    cycle ?? 'none'
  }; recursive_scanning ${scan}`;

  const lines = [header];
  if (book.recursive_scanning === false) {
    lines.push('Warning: recursive_scanning is off, so these edges will not fire in SillyTavern.');
  }

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

  const flagged = entries.filter((entry) => flagBits(entry).length > 0);
  if (flagged.length > 0) {
    lines.push(
      `Flags: ${flagged
        .slice(0, 24)
        .map((entry) => `${entryLabel(entry)} ${flagBits(entry).join(', ')}`)
        .join('; ')}`,
    );
  }

  return lines.join('\n');
}

function formatEgoMap(
  focusId: number,
  byId: Map<number, LorebookEntry>,
  graph: RecursionGraph,
  scan: string,
  cycle: string | null,
): string {
  const entry = byId.get(focusId);
  if (!entry) return `error: no entry #${focusId}`;

  const incoming = graph.incoming.get(focusId) ?? [];
  const outgoing = graph.outgoing.get(focusId) ?? [];
  const flags = flagBits(entry);
  const header = `Recursion for ${entryLabel(entry)} — ${incoming.length} in, ${outgoing.length} out; recursive_scanning ${scan}`;

  const lines = [header];
  if (flags.length > 0) lines.push(`flags: ${flags.join(', ')}`);
  if (cycle) lines.push(`cycle: ${cycle}`);

  if (incoming.length === 0) {
    lines.push('Incoming: (none)');
  } else {
    const shown = incoming.slice(0, MAX_NEIGHBORS);
    lines.push('Incoming:');
    for (const edge of shown) lines.push(`- ${formatEdge(edge, byId)}`);
    if (incoming.length > shown.length) {
      lines.push(`…and ${incoming.length - shown.length} more`);
    }
  }

  if (outgoing.length === 0) {
    lines.push('Outgoing: (none)');
  } else {
    const shown = outgoing.slice(0, MAX_NEIGHBORS);
    lines.push('Outgoing:');
    for (const edge of shown) lines.push(`- ${formatEdge(edge, byId)}`);
    if (outgoing.length > shown.length) {
      lines.push(`…and ${outgoing.length - shown.length} more`);
    }
  }

  return lines.join('\n');
}
