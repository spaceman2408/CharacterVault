import type { CharacterBook, LorebookEntry } from '../../../db/characterTypes';
import { estimateTokens } from '../../../services/AIService';
import type { ContextUsageSummary } from './types';

export function isEntryContextEnabled(entry: LorebookEntry): boolean {
  return entry.extensions?.context_enabled !== false;
}

export function hasNonDefaultActivation(entry: LorebookEntry): boolean {
  return (
    (entry.probability !== undefined && entry.probability !== 100) ||
    entry.useProbability === true ||
    entry.excludeRecursion === true ||
    entry.preventRecursion === true ||
    entry.delayUntilRecursion === true
  );
}

export function computeContextUsage(
  entries: LorebookEntry[],
  tokenBudget: number | undefined,
  samplerContextLength: number | undefined,
  extraTokens = 0,
): ContextUsageSummary {
  let included = 0;
  let tokens = 0;
  for (const entry of entries) {
    if (!entry.enabled) continue;
    if (!isEntryContextEnabled(entry)) continue;
    included += 1;
    tokens += estimateTokens(entry.content || '');
    if (entry.keys?.length) tokens += estimateTokens(entry.keys.join(','));
    if (entry.comment) tokens += estimateTokens(entry.comment);
  }

  tokens += extraTokens;

  const limit = Math.max(
    1,
    tokenBudget && tokenBudget > 0 ? tokenBudget : samplerContextLength || 8192,
  );
  const percentage = Math.min(100, (tokens / limit) * 100);
  let status: ContextUsageSummary['status'] = 'good';
  if (percentage > 80) status = 'danger';
  else if (percentage > 50) status = 'warning';

  return { included, tokens, limit, percentage, status };
}

export function sanitizeLorebookFilename(name: string, suffix: string): string {
  // eslint-disable-next-line no-control-regex
  let sanitized = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  sanitized = sanitized.replace(/[.\s]+$/, '');
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reservedNames.test(sanitized)) {
    sanitized += '_';
  }
  const maxLength = 200 - suffix.length;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength).replace(/[.\s]+$/, '');
  }
  return (sanitized || 'lorebook') + suffix;
}

export function createBlankLorebookEntry(id: number): LorebookEntry {
  return {
    id,
    keys: [],
    content: '',
    extensions: {},
    enabled: true,
    case_sensitive: false,
    name: '',
    priority: 0,
    position: 'before_char',
  };
}

export function nextAvailableEntryId(entries: LorebookEntry[]): number {
  const usedIds = new Set(entries.map((e) => e.id));
  let id = 0;
  while (usedIds.has(id)) id += 1;
  return id;
}

export function normalizeCharacterBook(lorebook: CharacterBook | undefined): CharacterBook {
  return {
    name: lorebook?.name || '',
    description: lorebook?.description || '',
    scan_depth: lorebook?.scan_depth,
    token_budget: lorebook?.token_budget,
    recursive_scanning: lorebook?.recursive_scanning,
    entries: lorebook?.entries || [],
    extensions: lorebook?.extensions || {},
  };
}
