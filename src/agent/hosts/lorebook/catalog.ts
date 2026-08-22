import type { CharacterBook, LorebookEntry } from '../../../db/characterTypes';
import { formatBookSettings, formatEntryFlagSuffix } from './flags';

function entryLabel(entry: LorebookEntry): string {
  const name = entry.name?.trim() || entry.comment?.trim() || '(unnamed)';
  const keys = entry.keys?.length ? entry.keys.join(', ') : '(none)';
  return `#${entry.id} ${name} — keys: ${keys} — ${formatEntryFlagSuffix(entry)}`;
}

export function formatEntryCatalog(book: CharacterBook): string {
  const settings = formatBookSettings(book);
  const entries = book.entries ?? [];
  if (entries.length === 0) {
    return `${settings}\nCurrent lorebook entries (id, name, keys, token size, flags):\n(none)`;
  }
  const lines = entries.map(entryLabel);
  return `${settings}\nCurrent lorebook entries (id, name, keys, token size, flags):\n${lines.join('\n')}`;
}
