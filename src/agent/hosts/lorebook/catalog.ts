import type { CharacterBook, LorebookEntry } from '../../../db/characterTypes';

function entryLabel(entry: LorebookEntry): string {
  const name = entry.name?.trim() || entry.comment?.trim() || '(unnamed)';
  const keys = entry.keys?.length ? entry.keys.join(', ') : '(none)';
  return `#${entry.id} ${name} — keys: ${keys}`;
}

export function formatEntryCatalog(book: CharacterBook): string {
  const entries = book.entries ?? [];
  if (entries.length === 0) {
    return 'Current lorebook entries (id, name, keys only):\n(none)';
  }
  const lines = entries.map(entryLabel);
  return `Current lorebook entries (id, name, keys only):\n${lines.join('\n')}`;
}
