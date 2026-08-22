import type { CharacterBook, LorebookEntry, LorebookPosition } from '../../../db/characterTypes';

export const ENTRY_FLAG_KEYS = [
  'enabled',
  'position',
  'depth',
  'insertion_order',
  'secondary_keys',
  'selective',
  'probability',
  'excludeRecursion',
  'preventRecursion',
  'delayUntilRecursion',
] as const;

const POSITIONS = new Set<string>([
  'before_char',
  'after_char',
  'before_example',
  'after_example',
  'at_depth',
]);

export type EntryFlagPatch = {
  enabled?: boolean;
  position?: LorebookPosition;
  depth?: number;
  insertion_order?: number;
  secondary_keys?: string[];
  selective?: boolean;
  probability?: number;
  useProbability?: boolean;
  excludeRecursion?: boolean;
  preventRecursion?: boolean;
  delayUntilRecursion?: boolean;
};

export function hasHeader(headers: Record<string, string>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(headers, key);
}

export function hasAnyFlagHeader(headers: Record<string, string>): boolean {
  return ENTRY_FLAG_KEYS.some((key) => hasHeader(headers, key));
}

function commaList(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parseBool(raw: string, field: string): { ok: true; value: boolean } | { ok: false; message: string } {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'true') return { ok: true, value: true };
  if (trimmed === 'false') return { ok: true, value: false };
  return { ok: false, message: `error: ${field} must be true or false` };
}

function parseIntValue(
  raw: string,
  field: string,
  opts: { min?: number; max?: number } = {},
): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return { ok: false, message: `error: ${field} must be an integer` };
  }
  const value = Number(trimmed);
  if (opts.min != null && value < opts.min) {
    return { ok: false, message: `error: ${field} must be >= ${opts.min}` };
  }
  if (opts.max != null && value > opts.max) {
    return { ok: false, message: `error: ${field} must be <= ${opts.max}` };
  }
  return { ok: true, value };
}

export function parseEntryFlags(
  headers: Record<string, string>,
): { patch: EntryFlagPatch } | { error: string } {
  const patch: EntryFlagPatch = {};

  if (hasHeader(headers, 'enabled')) {
    const parsed = parseBool(headers.enabled, 'enabled');
    if (!parsed.ok) return { error: parsed.message };
    patch.enabled = parsed.value;
  }

  if (hasHeader(headers, 'position')) {
    const position = (headers.position ?? '').trim();
    if (!POSITIONS.has(position)) {
      return {
        error:
          'error: position must be before_char, after_char, before_example, after_example, or at_depth',
      };
    }
    patch.position = position as LorebookPosition;
  }

  if (hasHeader(headers, 'depth')) {
    const parsed = parseIntValue(headers.depth, 'depth', { min: 0 });
    if (!parsed.ok) return { error: parsed.message };
    patch.depth = parsed.value;
  }

  if (hasHeader(headers, 'insertion_order')) {
    const parsed = parseIntValue(headers.insertion_order, 'insertion_order');
    if (!parsed.ok) return { error: parsed.message };
    patch.insertion_order = parsed.value;
  }

  if (hasHeader(headers, 'secondary_keys')) {
    patch.secondary_keys = commaList(headers.secondary_keys ?? '');
  }

  if (hasHeader(headers, 'selective')) {
    const parsed = parseBool(headers.selective, 'selective');
    if (!parsed.ok) return { error: parsed.message };
    patch.selective = parsed.value;
  } else if (patch.secondary_keys && patch.secondary_keys.length > 0) {
    patch.selective = true;
  }

  if (hasHeader(headers, 'probability')) {
    const parsed = parseIntValue(headers.probability, 'probability', { min: 0, max: 100 });
    if (!parsed.ok) return { error: parsed.message };
    patch.probability = parsed.value;
    patch.useProbability = true;
  }

  if (hasHeader(headers, 'excludeRecursion')) {
    const parsed = parseBool(headers.excludeRecursion, 'excludeRecursion');
    if (!parsed.ok) return { error: parsed.message };
    patch.excludeRecursion = parsed.value;
  }

  if (hasHeader(headers, 'preventRecursion')) {
    const parsed = parseBool(headers.preventRecursion, 'preventRecursion');
    if (!parsed.ok) return { error: parsed.message };
    patch.preventRecursion = parsed.value;
  }

  if (hasHeader(headers, 'delayUntilRecursion')) {
    const parsed = parseBool(headers.delayUntilRecursion, 'delayUntilRecursion');
    if (!parsed.ok) return { error: parsed.message };
    patch.delayUntilRecursion = parsed.value;
  }

  return { patch };
}

export function applyEntryFlagPatch(entry: LorebookEntry, patch: EntryFlagPatch): LorebookEntry {
  if (Object.keys(patch).length === 0) return entry;
  const next: LorebookEntry = { ...entry };
  if (patch.enabled !== undefined) next.enabled = patch.enabled;
  if (patch.position !== undefined) next.position = patch.position;
  if (patch.depth !== undefined) next.depth = patch.depth;
  if (patch.insertion_order !== undefined) next.insertion_order = patch.insertion_order;
  if (patch.secondary_keys !== undefined) next.secondary_keys = patch.secondary_keys;
  if (patch.selective !== undefined) next.selective = patch.selective;
  if (patch.probability !== undefined) next.probability = patch.probability;
  if (patch.useProbability !== undefined) next.useProbability = patch.useProbability;
  applyBoolFlag(next, 'excludeRecursion', patch.excludeRecursion);
  applyBoolFlag(next, 'preventRecursion', patch.preventRecursion);
  applyBoolFlag(next, 'delayUntilRecursion', patch.delayUntilRecursion);
  if (next.position === 'at_depth' && next.depth == null) next.depth = 4;
  return next;
}

function applyBoolFlag(
  entry: LorebookEntry,
  key: 'excludeRecursion' | 'preventRecursion' | 'delayUntilRecursion',
  value: boolean | undefined,
): void {
  if (value === undefined) return;
  if (value) entry[key] = true;
  else delete entry[key];
}

export function formatEntryFlagLines(entry: LorebookEntry): string[] {
  const lines: string[] = [];
  if (entry.enabled === false) lines.push('enabled: false');
  if (entry.constant) lines.push('constant: true');
  if (entry.secondary_keys?.length) {
    lines.push(`secondary_keys: ${entry.secondary_keys.join(', ')}`);
  }
  if (entry.selective) lines.push('selective: true');
  if (entry.position && entry.position !== 'before_char') {
    lines.push(`position: ${entry.position}`);
  }
  if (entry.position === 'at_depth') {
    lines.push(`depth: ${entry.depth ?? 4}`);
  }
  if (entry.insertion_order != null) {
    lines.push(`insertion_order: ${entry.insertion_order}`);
  }
  if (entry.probability != null && (entry.useProbability === true || entry.probability < 100)) {
    lines.push(`probability: ${entry.probability}`);
  }
  if (entry.excludeRecursion) lines.push('excludeRecursion: true');
  if (entry.preventRecursion) lines.push('preventRecursion: true');
  if (entry.delayUntilRecursion) lines.push('delayUntilRecursion: true');
  return lines;
}

export function formatEntryFlagSuffix(entry: LorebookEntry): string {
  const parts: string[] = [`${(entry.content ?? '').length} chars`];
  if (entry.enabled === false) parts.push('disabled');
  if (entry.constant) parts.push('constant');
  if (entry.insertion_order != null && entry.insertion_order !== 0) {
    parts.push(`order ${entry.insertion_order}`);
  }
  if (entry.position && entry.position !== 'before_char') {
    parts.push(
      entry.position === 'at_depth' ? `at_depth ${entry.depth ?? 4}` : entry.position,
    );
  }
  if (entry.probability != null && entry.probability < 100) {
    parts.push(`prob ${entry.probability}`);
  }
  if (entry.secondary_keys?.length) {
    parts.push(`filter: ${entry.secondary_keys.join(', ')}`);
  }
  if (entry.excludeRecursion) parts.push('non-recursable');
  if (entry.preventRecursion) parts.push('prevent');
  if (entry.delayUntilRecursion) parts.push('delay');
  return parts.join(', ');
}

export function formatBookSettings(book: CharacterBook): string {
  const name = book.name?.trim();
  const description = book.description ?? '';
  const parts = [
    name ? `name: ${name}` : null,
    description ? `description: ${description.length} chars` : null,
    `scan_depth: ${book.scan_depth ?? '(default)'}`,
    `token_budget: ${book.token_budget ?? '(default)'}`,
    `recursive_scanning: ${book.recursive_scanning ? 'on' : 'off'}`,
  ].filter((part): part is string => part != null);
  return `Book settings: ${parts.join('; ')}`;
}

export function parseBookSettings(
  headers: Record<string, string>,
  body: string,
):
  | { patch: Partial<Pick<CharacterBook, 'name' | 'description' | 'scan_depth' | 'token_budget' | 'recursive_scanning'>> }
  | { error: string } {
  const patch: Partial<
    Pick<CharacterBook, 'name' | 'description' | 'scan_depth' | 'token_budget' | 'recursive_scanning'>
  > = {};

  if (hasHeader(headers, 'name')) patch.name = headers.name ?? '';

  if (hasHeader(headers, 'description')) {
    patch.description = headers.description ?? '';
  } else if (body.trim()) {
    patch.description = body;
  }

  if (hasHeader(headers, 'scan_depth')) {
    const parsed = parseIntValue(headers.scan_depth, 'scan_depth', { min: 0 });
    if (!parsed.ok) return { error: parsed.message };
    patch.scan_depth = parsed.value;
  }

  if (hasHeader(headers, 'token_budget')) {
    const parsed = parseIntValue(headers.token_budget, 'token_budget', { min: 0 });
    if (!parsed.ok) return { error: parsed.message };
    patch.token_budget = parsed.value;
  }

  if (hasHeader(headers, 'recursive_scanning')) {
    const parsed = parseBool(headers.recursive_scanning, 'recursive_scanning');
    if (!parsed.ok) return { error: parsed.message };
    patch.recursive_scanning = parsed.value;
  }

  if (Object.keys(patch).length === 0) {
    return { error: 'error: nothing to update' };
  }
  return { patch };
}
