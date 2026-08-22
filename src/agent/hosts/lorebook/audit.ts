import type { CharacterBook, LorebookEntry } from '../../../db/characterTypes';
import {
  buildRecursionGraph,
  getBookRecursionStats,
} from '../../../components/editor/lorebook/recursionGraph';
import { estimateTokens } from '../../../services/AIService';
import { findCycle } from './recursion';

function entryLabel(entry: LorebookEntry): string {
  return `#${entry.id} ${entry.name?.trim() || entry.keys?.[0] || '(unnamed)'}`;
}

function duplicateKeyLines(entries: LorebookEntry[]): string[] {
  const byKey = new Map<string, LorebookEntry[]>();
  for (const entry of entries) {
    for (const key of entry.keys ?? []) {
      const needle = key.trim().toLowerCase();
      if (!needle) continue;
      const list = byKey.get(needle) ?? [];
      list.push(entry);
      byKey.set(needle, list);
    }
  }
  const lines: string[] = [];
  for (const [key, hits] of byKey) {
    const uniqueIds = [...new Set(hits.map((entry) => entry.id))];
    if (uniqueIds.length < 2) continue;
    const labels = uniqueIds.map((id) => {
      const entry = hits.find((item) => item.id === id);
      return entry ? entryLabel(entry) : `#${id}`;
    });
    lines.push(`${key} (${labels.join(', ')})`);
  }
  return lines;
}

export function formatBookAudit(book: CharacterBook): string {
  const entries = book.entries ?? [];
  const graph = buildRecursionGraph(entries);
  const stats = getBookRecursionStats(entries, graph);
  const constants = entries.filter((entry) => entry.constant).length;
  const disabled = entries.filter((entry) => entry.enabled === false).length;
  const empty = entries.filter((entry) => !(entry.content ?? '').trim()).length;
  let contentTokens = 0;
  for (const entry of entries) {
    contentTokens += estimateTokens(entry.content ?? '');
  }

  const lines = [
    `Lorebook: ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} (${constants} constant, ${disabled} disabled, ${empty} empty)`,
    `Entry content: ~${contentTokens} tokens` +
      (book.token_budget != null ? ` / budget ${book.token_budget}` : ''),
    `Recursion: ${stats.edgeCount} edges, ${stats.isolatedCount} isolated, cycle: ${findCycle(entries, graph) ?? 'none'}`,
  ];

  const duplicates = duplicateKeyLines(entries);
  if (duplicates.length > 0) {
    lines.push(`Duplicate keys: ${duplicates.slice(0, 8).join('; ')}`);
    if (duplicates.length > 8) lines.push(`…and ${duplicates.length - 8} more duplicate keys`);
  }

  if (empty > 0) {
    const emptyLabels = entries
      .filter((entry) => !(entry.content ?? '').trim())
      .slice(0, 6)
      .map(entryLabel);
    lines.push(`Empty entries: ${emptyLabels.join(', ')}`);
  }

  return lines.join('\n');
}
