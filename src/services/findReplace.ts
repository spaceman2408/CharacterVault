import type { CharacterBook, CharacterSpec, LorebookEntry } from '../db/characterTypes';

export interface FindReplaceOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  preserveCase: boolean;
}

export interface FindReplaceCard {
  /** Omitted for a standalone vault lorebook: only the book is searched. */
  spec?: CharacterSpec;
  book?: CharacterBook;
}

export interface FindTarget {
  /** `field:<id>`, `greeting:<index>`, `book:name|description`, `entry:<id>:<field>` */
  id: string;
  group: 'card' | 'lorebook';
  label: string;
  /** Entry title for lorebook entry targets. */
  entryLabel?: string;
  text: string;
  /** Comma-separated list (tags, keys): replacing a comma splits items. */
  list?: boolean;
}

export interface FindMatch {
  id: string;
  targetId: string;
  start: number;
  end: number;
  text: string;
  replacement: string;
}

export interface FindTargetMatches {
  target: FindTarget;
  matches: FindMatch[];
}

export type FindResult =
  | { ok: true; groups: FindTargetMatches[]; total: number; truncated: boolean }
  | { ok: false; error: string };

export type ApplyResult =
  | { ok: true; spec?: CharacterSpec; book?: CharacterBook; count: number; places: number }
  | { ok: false; error: string };

export const MAX_FIND_MATCHES = 2000;

const CARD_FIELDS: Array<{ id: CardFieldId; label: string }> = [
  { id: 'name', label: 'Name' },
  { id: 'description', label: 'Description' },
  { id: 'first_mes', label: 'First Message' },
  { id: 'mes_example', label: 'Examples' },
  { id: 'scenario', label: 'Scenario' },
  { id: 'physical_description', label: 'Appearance' },
  { id: 'personality', label: 'Personality' },
  { id: 'system_prompt', label: 'System' },
  { id: 'post_history_instructions', label: 'Post-History' },
  { id: 'creator', label: 'Creator' },
  { id: 'creator_notes', label: 'Creator Notes' },
  { id: 'tags', label: 'Tags' },
  { id: 'character_version', label: 'Version' },
  { id: 'avatar', label: 'Avatar URL' },
];

type CardFieldId =
  | 'name'
  | 'description'
  | 'first_mes'
  | 'mes_example'
  | 'scenario'
  | 'physical_description'
  | 'personality'
  | 'system_prompt'
  | 'post_history_instructions'
  | 'creator'
  | 'creator_notes'
  | 'tags'
  | 'character_version'
  | 'avatar';

type EntryField = 'comment' | 'name' | 'content' | 'keys' | 'secondary_keys';

const ENTRY_FIELDS: Array<{ field: EntryField; label: string; list?: boolean }> = [
  { field: 'comment', label: 'Title' },
  { field: 'name', label: 'Name' },
  { field: 'keys', label: 'Keys', list: true },
  { field: 'secondary_keys', label: 'Filter keys', list: true },
  { field: 'content', label: 'Content' },
];

const MUST_NOT_EMPTY = new Set(['field:name', 'field:first_mes']);

export function entryDisplayLabel(entry: LorebookEntry): string {
  return entry.comment?.trim() || entry.name?.trim() || entry.keys?.[0]?.trim() || `Entry #${entry.id}`;
}

function entryFieldText(entry: LorebookEntry, field: EntryField): string {
  if (field === 'keys' || field === 'secondary_keys') return (entry[field] ?? []).join(', ');
  return entry[field] ?? '';
}

export function collectFindTargets(card: FindReplaceCard): FindTarget[] {
  const { spec, book } = card;
  const targets: FindTarget[] = [];
  if (spec) {
    for (const { id, label } of CARD_FIELDS) {
      const text = id === 'tags' ? (spec.tags ?? []).join(', ') : spec[id] ?? '';
      targets.push({ id: `field:${id}`, group: 'card', label, text, list: id === 'tags' || undefined });
      if (id === 'first_mes') {
        (spec.alternate_greetings ?? []).forEach((greeting, index) => {
          targets.push({ id: `greeting:${index}`, group: 'card', label: `Greeting ${index + 1}`, text: greeting ?? '' });
        });
      }
    }
  }
  if (!book) return targets;
  targets.push({ id: 'book:name', group: 'lorebook', label: 'Book Name', text: book.name ?? '' });
  targets.push({ id: 'book:description', group: 'lorebook', label: 'Book Description', text: book.description ?? '' });
  for (const entry of book.entries ?? []) {
    const entryLabel = entryDisplayLabel(entry);
    for (const { field, label, list } of ENTRY_FIELDS) {
      targets.push({
        id: `entry:${entry.id}:${field}`,
        group: 'lorebook',
        label,
        entryLabel,
        text: entryFieldText(entry, field),
        list,
      });
    }
  }
  return targets;
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compilePattern(query: string, options: FindReplaceOptions): RegExp | { error: string } {
  const source = options.regex ? query : escapeRegExp(query);
  const flags = `gm${options.caseSensitive ? '' : 'i'}`;
  const attempt = (unicode: boolean): RegExp => {
    const word = unicode ? '[\\p{L}\\p{N}_]' : '[A-Za-z0-9_]';
    const wrapped = options.wholeWord ? `(?<!${word})(?:${source})(?!${word})` : source;
    return new RegExp(wrapped, unicode ? `${flags}u` : flags);
  };
  try {
    return attempt(true);
  } catch {
    try {
      return attempt(false);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Invalid regular expression' };
    }
  }
}

function unescapeRegexReplacement(template: string): string {
  return template.replace(/\\(\\|n|t)/g, (_, ch: string) => (ch === 'n' ? '\n' : ch === 't' ? '\t' : '\\'));
}

function expandReplacement(template: string, match: RegExpExecArray): string {
  const groupCount = match.length - 1;
  return template.replace(/\$(\$|&|`|'|<([^>]*)>|(\d{1,2}))/g, (whole, token: string, name?: string, digits?: string) => {
    if (token === '$') return '$';
    if (token === '&') return match[0];
    if (token === '`') return match.input.slice(0, match.index);
    if (token === "'") return match.input.slice(match.index + match[0].length);
    if (name !== undefined) {
      const groups = match.groups;
      if (!groups || !(name in groups)) return whole;
      return groups[name] ?? '';
    }
    if (digits !== undefined) {
      let index = Number(digits);
      let rest = '';
      if (index > groupCount && digits.length === 2) {
        index = Number(digits[0]);
        rest = digits[1];
      }
      if (index < 1 || index > groupCount) return whole;
      return (match[index] ?? '') + rest;
    }
    return whole;
  });
}

const hasCase = (text: string): boolean => text.toUpperCase() !== text.toLowerCase();

/** VS Code's three shapes: ALL UPPER, all lower, Capitalised. Anything else keeps the typed replacement. */
export function preserveCase(matched: string, replacement: string): string {
  if (!replacement || !hasCase(matched)) return replacement;
  const [first, ...restChars] = Array.from(matched);
  const rest = restChars.join('');
  const capitalise = (): string => {
    const [head, ...tail] = Array.from(replacement);
    return head.toUpperCase() + tail.join('');
  };
  if (!hasCase(rest)) return first === first.toUpperCase() ? capitalise() : replacement.toLowerCase();
  if (matched === matched.toUpperCase()) return replacement.toUpperCase();
  if (matched === matched.toLowerCase()) return replacement.toLowerCase();
  if (hasCase(first) && first === first.toUpperCase() && rest === rest.toLowerCase()) return capitalise();
  return replacement;
}

export function findInCard(
  card: FindReplaceCard,
  query: string,
  replacement: string,
  options: FindReplaceOptions,
): FindResult {
  if (!query) return { ok: true, groups: [], total: 0, truncated: false };
  const pattern = compilePattern(query, options);
  if ('error' in pattern) return { ok: false, error: pattern.error };
  const template = options.regex ? unescapeRegexReplacement(replacement) : replacement;

  const groups: FindTargetMatches[] = [];
  let total = 0;
  let truncated = false;
  for (const target of collectFindTargets(card)) {
    if (!target.text) continue;
    if (truncated) break;
    const matches: FindMatch[] = [];
    pattern.lastIndex = 0;
    let found: RegExpExecArray | null;
    while ((found = pattern.exec(target.text)) !== null) {
      if (found[0].length === 0) {
        const codePoint = target.text.codePointAt(found.index) ?? 0;
        pattern.lastIndex = found.index + (pattern.unicode && codePoint > 0xffff ? 2 : 1);
        continue;
      }
      if (total >= MAX_FIND_MATCHES) {
        truncated = true;
        break;
      }
      const raw = options.regex ? expandReplacement(template, found) : template;
      matches.push({
        id: `${target.id}@${found.index}`,
        targetId: target.id,
        start: found.index,
        end: found.index + found[0].length,
        text: found[0],
        replacement: options.preserveCase ? preserveCase(found[0], raw) : raw,
      });
      total += 1;
    }
    if (matches.length > 0) groups.push({ target, matches });
  }
  return { ok: true, groups, total, truncated };
}

/** True when both cards hold the same spec and lorebook (used to detect edits made since a find or replace). */
export function sameFindReplaceCard(a: FindReplaceCard, b: FindReplaceCard): boolean {
  return JSON.stringify(a.spec) === JSON.stringify(b.spec) && JSON.stringify(a.book ?? null) === JSON.stringify(b.book ?? null);
}

function replaceRanges(text: string, matches: FindMatch[]): string {
  let next = text;
  for (const match of [...matches].sort((a, b) => b.start - a.start)) {
    next = next.slice(0, match.start) + match.replacement + next.slice(match.end);
  }
  return next;
}

function splitList(text: string): string[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Applies every match not in `excluded` to the card. `groups` must come from `findInCard` on this same card.
 * `required` adds target ids that must not be left empty (on top of the name, first message and greetings).
 */
export function applyFindReplace(
  card: FindReplaceCard,
  groups: FindTargetMatches[],
  excluded: ReadonlySet<string> = new Set(),
  required: readonly string[] = [],
): ApplyResult {
  const edits = new Map<string, string>();
  let count = 0;
  for (const { target, matches } of groups) {
    const included = matches.filter((match) => !excluded.has(match.id));
    if (included.length === 0) continue;
    const next = replaceRanges(target.text, included);
    count += included.length;
    if (next === target.text) continue;
    if (!next.trim() && (MUST_NOT_EMPTY.has(target.id) || required.includes(target.id) || target.id.startsWith('greeting:'))) {
      return { ok: false, error: `This would leave ${target.label} empty` };
    }
    edits.set(target.id, next);
  }

  let spec = card.spec;
  let book = card.book;
  if (edits.size === 0) return { ok: true, spec, book, count, places: 0 };

  const greetings = [...(spec?.alternate_greetings ?? [])];
  let greetingsChanged = false;
  const entryEdits = new Map<number, Partial<Record<EntryField, string>>>();
  let bookName: string | undefined;
  let bookDescription: string | undefined;

  for (const [id, text] of edits) {
    const [kind, key, field] = id.split(':');
    if (kind === 'field' && spec) {
      spec = { ...spec, [key]: key === 'tags' ? splitList(text) : text };
    } else if (kind === 'greeting') {
      greetings[Number(key)] = text;
      greetingsChanged = true;
    } else if (kind === 'book') {
      if (key === 'name') bookName = text;
      else bookDescription = text;
    } else if (kind === 'entry') {
      const entryId = Number(key);
      entryEdits.set(entryId, { ...entryEdits.get(entryId), [field]: text });
    }
  }
  if (greetingsChanged && spec) spec = { ...spec, alternate_greetings: greetings };

  if (book && (entryEdits.size > 0 || bookName !== undefined || bookDescription !== undefined)) {
    book = {
      ...book,
      ...(bookName !== undefined ? { name: bookName } : {}),
      ...(bookDescription !== undefined ? { description: bookDescription } : {}),
      entries: book.entries.map((entry) => {
        const changes = entryEdits.get(entry.id);
        if (!changes) return entry;
        const next: LorebookEntry = { ...entry };
        for (const [field, text] of Object.entries(changes) as Array<[EntryField, string]>) {
          if (field === 'keys' || field === 'secondary_keys') next[field] = splitList(text);
          else next[field] = text;
        }
        return next;
      }),
    };
  }

  return { ok: true, spec, book, count, places: edits.size };
}
