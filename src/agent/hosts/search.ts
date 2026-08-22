import type { CharacterBook } from '../../db/characterTypes';
import type { ActionResult, ParsedAction } from '../core/types';
import { parseReplaceAll, replaceText, replacementText, searchInText, searchText } from './replaceText';

export const MAX_SEARCH_PLACES = 40;
export const MAX_REPLACE_ACROSS_PER_RUN = 10;

export interface TextTarget {
  id: string;
  loc: string;
  text: string;
}

export function searchQuery(action: ParsedAction): string {
  const header = (action.headers.query ?? '').trim();
  if (header) return header;
  return action.body.trim();
}

export function collectBookTargets(book: CharacterBook): TextTarget[] {
  const targets: TextTarget[] = [];
  if (book.name) {
    targets.push({ id: 'book:name', loc: 'book name', text: book.name });
  }
  if (book.description) {
    targets.push({
      id: 'book:description',
      loc: 'book description',
      text: book.description,
    });
  }
  for (const entry of book.entries ?? []) {
    const label = entry.name?.trim() || entry.keys?.[0] || '(unnamed)';
    const prefix = `#${entry.id} ${label}`;
    targets.push({
      id: `entry:${entry.id}:content`,
      loc: prefix,
      text: entry.content ?? '',
    });
    if (entry.keys?.length) {
      targets.push({
        id: `entry:${entry.id}:keys`,
        loc: `${prefix} keys`,
        text: entry.keys.join(', '),
      });
    }
    if (entry.name?.trim()) {
      targets.push({
        id: `entry:${entry.id}:name`,
        loc: `${prefix} name`,
        text: entry.name,
      });
    }
    if (entry.secondary_keys?.length) {
      targets.push({
        id: `entry:${entry.id}:secondary_keys`,
        loc: `${prefix} filter`,
        text: entry.secondary_keys.join(', '),
      });
    }
  }
  return targets;
}

export function searchTargets(targets: TextTarget[], action: ParsedAction): ActionResult {
  const query = searchQuery(action);
  if (!query) {
    return { ok: false, toolName: 'search', message: 'error: query is empty' };
  }

  const places: Array<{ loc: string; count: number; snippet: string }> = [];
  let totalHits = 0;
  for (const target of targets) {
    if (!target.text) continue;
    const found = searchInText(target.text, query);
    if (found.count === 0 || found.snippet == null) continue;
    totalHits += found.count;
    places.push({ loc: target.loc, count: found.count, snippet: found.snippet });
  }

  const shown = places.slice(0, MAX_SEARCH_PLACES);
  const extra = places.length - shown.length;
  const quoted = JSON.stringify(query);
  if (places.length === 0) {
    return { ok: true, toolName: 'search', message: `0 matches for ${quoted}` };
  }

  const header = `${totalHits} match${totalHits === 1 ? '' : 'es'} in ${places.length} place${
    places.length === 1 ? '' : 's'
  } for ${quoted}`;
  const lines = shown.map((place) => `${place.loc} (${place.count}): ${place.snippet}`);
  if (extra > 0) lines.push(`…and ${extra} more place${extra === 1 ? '' : 's'}`);
  return { ok: true, toolName: 'search', message: `${header}\n${lines.join('\n')}` };
}

export type ReplaceAcrossSuccess = {
  ok: true;
  replacements: Array<{ id: string; loc: string; text: string; count: number }>;
  total: number;
};

export type ReplaceAcrossResult = ReplaceAcrossSuccess | { ok: false; message: string };

export function replaceAcrossTargets(
  targets: TextTarget[],
  action: ParsedAction,
): ReplaceAcrossResult {
  const oldText = searchText(action);
  const newText = replacementText(action);
  const replaceAll = parseReplaceAll(action.headers.replace_all);
  if (!oldText) {
    return { ok: false, message: 'error: old is empty' };
  }

  const replacements: ReplaceAcrossSuccess['replacements'] = [];
  let total = 0;
  for (const target of targets) {
    if (!target.text) continue;
    const applied = replaceText(target.text, oldText, newText, replaceAll);
    if (!applied.ok) {
      if (applied.message.includes('old not found')) continue;
      return {
        ok: false,
        message: applied.message.replace('error: ', `error: in ${target.loc} — `),
      };
    }
    if (applied.count === 0 || applied.text === target.text) continue;
    replacements.push({
      id: target.id,
      loc: target.loc,
      text: applied.text,
      count: applied.count,
    });
    total += applied.count;
  }

  if (replacements.length === 0) {
    return { ok: false, message: 'error: old not found in any searched text' };
  }

  return { ok: true, replacements, total };
}

export function formatReplaceAcross(applied: ReplaceAcrossSuccess): string {
  const places = applied.replacements.map((item) => item.loc);
  const shown = places.slice(0, 12);
  const extra = places.length - shown.length;
  const list = extra > 0 ? `${shown.join(', ')}, …+${extra}` : shown.join(', ');
  return `ok replaced ${applied.total} in ${applied.replacements.length} place${
    applied.replacements.length === 1 ? '' : 's'
  }: ${list}`;
}

export function applyBookReplacements(
  book: CharacterBook,
  replacements: ReplaceAcrossSuccess['replacements'],
): CharacterBook {
  if (replacements.length === 0) return book;
  const byId = new Map(replacements.map((item) => [item.id, item]));
  let name = book.name;
  let description = book.description;
  const nameHit = byId.get('book:name');
  if (nameHit) name = nameHit.text;
  const descriptionHit = byId.get('book:description');
  if (descriptionHit) description = descriptionHit.text;

  const entries = (book.entries ?? []).map((entry) => {
    const contentHit = byId.get(`entry:${entry.id}:content`);
    const keysHit = byId.get(`entry:${entry.id}:keys`);
    const nameHitEntry = byId.get(`entry:${entry.id}:name`);
    const filterHit = byId.get(`entry:${entry.id}:secondary_keys`);
    if (!contentHit && !keysHit && !nameHitEntry && !filterHit) return entry;
    return {
      ...entry,
      content: contentHit ? contentHit.text : entry.content,
      keys: keysHit ? splitCommaList(keysHit.text) : entry.keys,
      name: nameHitEntry ? nameHitEntry.text : entry.name,
      secondary_keys: filterHit ? splitCommaList(filterHit.text) : entry.secondary_keys,
    };
  });

  return { ...book, name, description, entries };
}

function splitCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
