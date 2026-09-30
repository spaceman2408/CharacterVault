/**
 * @fileoverview Lorebook format converter for importing/exporting character books
 * from/to various frontends (SillyTavern, etc.)
 * @module services/LorebookConverter
 */

import type {
  CharacterBook,
  LorebookDepthRole,
  LorebookEntry,
  LorebookPosition,
  LorebookSelectiveLogic,
} from '../db/characterTypes';

/**
 * SillyTavern lorebook entry format
 * Note: ST uses camelCase for some fields and different naming conventions
 */
export interface STLorebookEntry {
  // Core fields (mapped directly or with transforms)
  uid: number;
  key: string[];
  keysecondary: string[];
  comment: string;
  content: string;
  constant: boolean;
  selective: boolean;
  order: number;
  /**
   * ST world_info_position:
   * 0 before, 1 after, 2 AN top, 3 AN bottom, 4 at depth, 5 EM top, 6 EM bottom, 7 outlet
   * (CharacterVault maps a curated subset; unknown values preserved via extensions._st_position.)
   */
  position: number;
  disable: boolean;
  caseSensitive: boolean | null;
  extensions?: Record<string, unknown>;

  // ST-specific fields (stored in extensions for round-trip fidelity)
  vectorized?: boolean;
  selectiveLogic?: number;
  addMemo?: boolean;
  ignoreBudget?: boolean;
  excludeRecursion?: boolean;
  preventRecursion?: boolean;
  matchPersonaDescription?: boolean;
  matchCharacterDescription?: boolean;
  matchCharacterPersonality?: boolean;
  matchCharacterDepthPrompt?: boolean;
  matchScenario?: boolean;
  matchCreatorNotes?: boolean;
  delayUntilRecursion?: boolean;
  probability?: number;
  useProbability?: boolean;
  depth?: number;
  outletName?: string;
  group?: string;
  groupOverride?: boolean;
  groupWeight?: number;
  scanDepth?: number | null;
  matchWholeWords?: boolean | null;
  useGroupScoring?: boolean | null;
  automationId?: string;
  role?: number | null;
  sticky?: number | null;
  cooldown?: number | null;
  delay?: number | null;
  triggers?: string[];
  displayIndex?: number;
  characterFilter?: {
    isExclude: boolean;
    names: string[];
    tags: string[];
  };
}

/**
 * SillyTavern lorebook export format
 * Entries are stored as a Record with string keys, NOT an array
 */
export interface STLorebookExport {
  entries: Record<string, STLorebookEntry>;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  originalData?: {
    name?: string;
    description?: string;
    scan_depth?: number;
    token_budget?: number;
    recursive_scanning?: boolean;
    entries?: Array<{
      id: number;
      keys: string[];
      content: string;
      extensions?: Record<string, unknown>;
      enabled?: boolean;
      case_sensitive?: boolean;
      name?: string;
      priority?: number;
      position?: LorebookEntry['position'];
      comment?: string;
    }>;
    extensions?: Record<string, unknown>;
  };
}

/**
 * Mapping from ST numeric position to CharacterVault string position.
 * Modern ST: 0 before, 1 after, 2 AN top, 3 AN bottom, 4 atDepth, 5 EM top, 6 EM bottom, 7 outlet.
 * Legacy CV exports used 2/3 for example-message slots; both map into our curated set.
 */
const POSITION_MAP: Record<number, LorebookPosition> = {
  0: 'before_char',
  1: 'after_char',
  2: 'before_char', // AN top → closest curated slot (raw kept in _st_position)
  3: 'after_char', // AN bottom
  4: 'at_depth',
  5: 'before_example',
  6: 'after_example',
  7: 'after_char', // outlet → fallback display
};

/**
 * Reverse mapping from CharacterVault string position to ST numeric position
 */
const REVERSE_POSITION_MAP: Record<LorebookPosition, number> = {
  before_char: 0,
  after_char: 1,
  before_example: 5,
  after_example: 6,
  at_depth: 4,
};

function asSelectiveLogic(value: unknown): LorebookSelectiveLogic | undefined {
  if (value === 0 || value === 1 || value === 2 || value === 3) return value;
  return undefined;
}

function asDepthRole(value: unknown): LorebookDepthRole | null | undefined {
  if (value === null) return null;
  if (value === 0 || value === 1 || value === 2) return value;
  return undefined;
}

const LOREBOOK_POSITIONS = new Set<string>(Object.keys(REVERSE_POSITION_MAP));

/** Insertion order as the editor shows it; older entries kept it in `priority`. */
export function getEntryOrder(entry: LorebookEntry): number {
  return entry.insertion_order ?? entry.priority ?? 0;
}

/**
 * Card `character_book` entries keep SillyTavern's per-entry options in
 * snake_case `extensions` keys. Pairs are [our top-level field, ST extension key].
 */
const CARD_EXTENSION_FIELDS = [
  ['excludeRecursion', 'exclude_recursion'],
  ['preventRecursion', 'prevent_recursion'],
  ['delayUntilRecursion', 'delay_until_recursion'],
  ['probability', 'probability'],
  ['useProbability', 'useProbability'],
  ['depth', 'depth'],
  ['selectiveLogic', 'selectiveLogic'],
  ['matchWholeWords', 'match_whole_words'],
  ['role', 'role'],
  ['case_sensitive', 'case_sensitive'],
] as const satisfies ReadonlyArray<readonly [keyof LorebookEntry, string]>;

function storedSTPosition(ext: Record<string, unknown>): number | undefined {
  const stored = ext._st_position ?? ext.position;
  return typeof stored === 'number' && Number.isInteger(stored) ? stored : undefined;
}

function cardPositionOf(ext: Record<string, unknown>): number | undefined {
  const value = ext.position;
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

function needsCardNormalization(entry: LorebookEntry): boolean {
  const ext = entry.extensions ?? {};
  if (cardPositionOf(ext) !== undefined) return true;
  if (entry.position !== undefined && !LOREBOOK_POSITIONS.has(entry.position)) return true;
  const source = entry as unknown as Record<string, unknown>;
  return CARD_EXTENSION_FIELDS.some(
    ([field, extKey]) => source[field] === undefined && ext[extKey] !== undefined,
  );
}

/**
 * Read a card `character_book` entry (SillyTavern keeps options in `extensions`)
 * into the top-level fields the editor uses. Top-level values win so edits made
 * in older CharacterVault versions are kept. Safe to run repeatedly.
 */
export function cardBookEntryToEntry(entry: LorebookEntry): LorebookEntry {
  const ext = { ...(entry.extensions ?? {}) };
  const next: LorebookEntry = { ...entry, extensions: ext };

  const cardPosition = cardPositionOf(ext);
  if (cardPosition !== undefined) {
    // SillyTavern writes the spec string from its number (0 → before, else after).
    // A different top-level value means the position was changed here, so keep it.
    const specPosition: LorebookPosition = cardPosition === 0 ? 'before_char' : 'after_char';
    const unchanged =
      entry.position === undefined ||
      entry.position === specPosition ||
      !LOREBOOK_POSITIONS.has(entry.position);
    next.position = unchanged ? POSITION_MAP[cardPosition] ?? specPosition : entry.position;
    ext._st_position = cardPosition;
    delete ext.position;
  } else if (entry.position !== undefined && !LOREBOOK_POSITIONS.has(entry.position)) {
    next.position = 'before_char';
  }

  const target = next as unknown as Record<string, unknown>;
  for (const [field, extKey] of CARD_EXTENSION_FIELDS) {
    if (target[field] === undefined && ext[extKey] !== undefined) {
      target[field] = ext[extKey];
    }
  }
  if (next.selectiveLogic !== undefined) next.selectiveLogic = asSelectiveLogic(next.selectiveLogic);
  if (next.role !== undefined) next.role = asDepthRole(next.role) ?? null;

  return next;
}

/**
 * Bring a stored book written before card options were mapped up to date.
 * Returns the same object when nothing needs changing.
 */
export function normalizeCardBook<T extends CharacterBook | undefined>(book: T): T {
  if (!book?.entries?.some(needsCardNormalization)) return book;
  return {
    ...book,
    entries: book.entries.map((entry) =>
      needsCardNormalization(entry) ? cardBookEntryToEntry(entry) : entry,
    ),
  };
}

/**
 * Write an entry as a V2 card `character_book` entry that SillyTavern reads:
 * options go to snake_case `extensions`, order to `insertion_order`, and
 * `position` is limited to the spec's before_char / after_char.
 */
export function entryToCardBookEntry(entry: LorebookEntry): LorebookEntry {
  const source = entry as unknown as Record<string, unknown>;
  const ext: Record<string, unknown> = { ...(entry.extensions ?? {}) };

  const currentPosition = entry.position ?? 'before_char';
  const stored = storedSTPosition(ext);
  const stPosition =
    stored !== undefined && POSITION_MAP[stored] === currentPosition
      ? stored
      : REVERSE_POSITION_MAP[currentPosition] ?? 0;
  delete ext._st_position;
  ext.position = stPosition;

  for (const [field, extKey] of CARD_EXTENSION_FIELDS) {
    if (source[field] !== undefined) ext[extKey] = source[field];
  }

  const card: Record<string, unknown> = {
    ...entry,
    extensions: ext,
    insertion_order: getEntryOrder(entry),
    position: stPosition === 0 ? 'before_char' : 'after_char',
  };
  for (const [field] of CARD_EXTENSION_FIELDS) {
    if (field !== 'case_sensitive') delete card[field];
  }
  return card as unknown as LorebookEntry;
}

/**
 * Detect the format of a lorebook export/import data
 * @param data - The data to detect format for
 * @returns The detected format type
 */
export function detectLorebookFormat(data: unknown): 'sillytavern' | 'charactervault' | 'unknown' {
  if (!data || typeof data !== 'object') {
    return 'unknown';
  }

  const d = data as Record<string, unknown>;

  // Check for SillyTavern format:
  // - Has 'entries' property that is an object (Record), not an array
  // - Entries have ST-specific fields like 'uid', 'key', 'disable', etc.
  if (d.entries && typeof d.entries === 'object' && !Array.isArray(d.entries)) {
    const entries = d.entries as Record<string, unknown>;
    const firstEntry = Object.values(entries)[0];
    if (firstEntry && typeof firstEntry === 'object') {
      const entry = firstEntry as Record<string, unknown>;
      if ('uid' in entry || 'key' in entry || 'disable' in entry) {
        return 'sillytavern';
      }
    }
  }

  // Check for CharacterVault format:
  // - Has 'entries' property that is an array
  // - Entries have CV-specific fields like 'id', 'keys', 'enabled', etc.
  if (Array.isArray(d.entries)) {
    const firstEntry = d.entries[0];
    if (firstEntry && typeof firstEntry === 'object') {
      const entry = firstEntry as Record<string, unknown>;
      if ('id' in entry && 'keys' in entry && 'enabled' in entry) {
        return 'charactervault';
      }
    }
  }

  return 'unknown';
}

/**
 * Convert a single SillyTavern entry to CharacterVault format
 * @param entry - The ST entry to convert
 * @returns The converted CharacterVault entry
 */
export function convertSTEntry(entry: STLorebookEntry): LorebookEntry {
  // ST-specific fields not first-class in CV UI — keep in extensions for round-trip
  const stSpecificFields: Record<string, unknown> = {
    vectorized: entry.vectorized,
    addMemo: entry.addMemo,
    ignoreBudget: entry.ignoreBudget,
    matchPersonaDescription: entry.matchPersonaDescription,
    matchCharacterDescription: entry.matchCharacterDescription,
    matchCharacterPersonality: entry.matchCharacterPersonality,
    matchCharacterDepthPrompt: entry.matchCharacterDepthPrompt,
    matchScenario: entry.matchScenario,
    matchCreatorNotes: entry.matchCreatorNotes,
    outletName: entry.outletName,
    group: entry.group,
    groupOverride: entry.groupOverride,
    groupWeight: entry.groupWeight,
    scanDepth: entry.scanDepth,
    useGroupScoring: entry.useGroupScoring,
    automationId: entry.automationId,
    sticky: entry.sticky,
    cooldown: entry.cooldown,
    delay: entry.delay,
    triggers: entry.triggers,
    displayIndex: entry.displayIndex,
    characterFilter: entry.characterFilter,
  };

  const filteredStFields = Object.fromEntries(
    Object.entries(stSpecificFields).filter(([, v]) => v !== undefined)
  );

  const selectiveLogic = asSelectiveLogic(entry.selectiveLogic);
  const role = asDepthRole(entry.role);

  return {
    id: entry.uid,
    keys: entry.key || [],
    secondary_keys: entry.keysecondary || [],
    comment: entry.comment || '',
    content: entry.content || '',
    constant: entry.constant ?? false,
    selective: entry.selective ?? false,
    insertion_order: entry.order ?? 0,
    position: POSITION_MAP[entry.position] ?? 'before_char',
    enabled: !entry.disable,
    case_sensitive: entry.caseSensitive ?? false,
    name: '',
    selectiveLogic,
    matchWholeWords: entry.matchWholeWords ?? null,
    probability: entry.probability,
    useProbability: entry.useProbability,
    depth: entry.depth,
    role: role === undefined ? null : role,
    excludeRecursion: entry.excludeRecursion,
    preventRecursion: entry.preventRecursion,
    delayUntilRecursion: entry.delayUntilRecursion,
    extensions: {
      ...entry.extensions,
      ...filteredStFields,
      _st_position: entry.position,
    },
  };
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/** Book-level scan settings from a character_book / ST originalData / root export. */
function readBookScanSettings(source: unknown): Pick<
  CharacterBook,
  'scan_depth' | 'token_budget' | 'recursive_scanning'
> {
  if (!source || typeof source !== 'object') return {};
  const s = source as Record<string, unknown>;
  return {
    scan_depth: readOptionalNumber(s.scan_depth ?? s.scanDepth),
    token_budget: readOptionalNumber(s.token_budget ?? s.tokenBudget),
    recursive_scanning: readOptionalBoolean(s.recursive_scanning ?? s.recursiveScanning),
  };
}

/**
 * Convert a SillyTavern lorebook export to CharacterBook format
 * @param data - The ST export data
 * @returns The converted CharacterBook
 */
export function convertSTLorebook(data: STLorebookExport): CharacterBook {
  const entries: LorebookEntry[] = [];

  // ST exports entries as a Record with string keys (e.g., "0", "1")
  // We need to convert them to an array
  const entryRecord = data.entries || {};
  const sortedKeys = Object.keys(entryRecord).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  for (const key of sortedKeys) {
    const stEntry = entryRecord[key];
    if (stEntry) {
      entries.push(convertSTEntry(stEntry));
    }
  }

  // Name/description and book scan settings live on originalData when ST
  // extracted a character_book. Some exports also put scan settings on the root.
  const originalData = data.originalData;
  const fromOriginal = readBookScanSettings(originalData);
  const fromRoot = readBookScanSettings(data);

  return {
    name: originalData?.name || '',
    description: originalData?.description || '',
    scan_depth: fromOriginal.scan_depth ?? fromRoot.scan_depth,
    token_budget: fromOriginal.token_budget ?? fromRoot.token_budget,
    recursive_scanning: fromOriginal.recursive_scanning ?? fromRoot.recursive_scanning,
    entries,
    extensions: originalData?.extensions || {},
  };
}

/**
 * Convert a CharacterVault entry to SillyTavern format
 * @param entry - The CV entry to convert
 * @param displayIndex - The display index for ST
 * @returns The converted ST entry
 */
export function convertToSTEntry(entry: LorebookEntry, displayIndex: number): STLorebookEntry {
  const ext = entry.extensions || {};

  // Prefer original ST position only when it still maps to the entry's current position
  // (preserves AN/outlet round-trip; uses curated reverse map after user edits)
  const storedPosition = ext._st_position;
  const currentPosition = entry.position ?? 'before_char';
  const position =
    typeof storedPosition === 'number' && POSITION_MAP[storedPosition] === currentPosition
      ? storedPosition
      : REVERSE_POSITION_MAP[currentPosition] ?? 0;

  const selectiveLogic =
    entry.selectiveLogic ?? (ext.selectiveLogic as number | undefined);
  const matchWholeWords =
    entry.matchWholeWords !== undefined
      ? entry.matchWholeWords
      : (ext.matchWholeWords as boolean | null | undefined);
  const probability =
    entry.probability !== undefined
      ? entry.probability
      : (ext.probability as number | undefined);
  const useProbability =
    entry.useProbability !== undefined
      ? entry.useProbability
      : (ext.useProbability as boolean | undefined);
  const depth =
    entry.depth !== undefined ? entry.depth : (ext.depth as number | undefined);
  const role =
    entry.role !== undefined ? entry.role : (ext.role as number | null | undefined);
  const excludeRecursion =
    entry.excludeRecursion !== undefined
      ? entry.excludeRecursion
      : (ext.excludeRecursion as boolean | undefined);
  const preventRecursion =
    entry.preventRecursion !== undefined
      ? entry.preventRecursion
      : (ext.preventRecursion as boolean | undefined);
  const delayUntilRecursion =
    entry.delayUntilRecursion !== undefined
      ? entry.delayUntilRecursion
      : (ext.delayUntilRecursion as boolean | undefined);

  // Strip fields we re-emit as first-class ST properties
  const restExtensions = { ...ext };
  const stripKeys = [
    '_st_position',
    'vectorized',
    'selectiveLogic',
    'addMemo',
    'ignoreBudget',
    'excludeRecursion',
    'preventRecursion',
    'matchPersonaDescription',
    'matchCharacterDescription',
    'matchCharacterPersonality',
    'matchCharacterDepthPrompt',
    'matchScenario',
    'matchCreatorNotes',
    'delayUntilRecursion',
    'probability',
    'useProbability',
    'depth',
    'outletName',
    'group',
    'groupOverride',
    'groupWeight',
    'scanDepth',
    'matchWholeWords',
    'useGroupScoring',
    'automationId',
    'role',
    'sticky',
    'cooldown',
    'delay',
    'triggers',
    'displayIndex',
    'characterFilter',
  ] as const;
  for (const key of stripKeys) {
    delete restExtensions[key];
  }

  const vectorized = ext.vectorized as boolean | undefined;
  const addMemo = ext.addMemo as boolean | undefined;
  const ignoreBudget = ext.ignoreBudget as boolean | undefined;
  const matchPersonaDescription = ext.matchPersonaDescription as boolean | undefined;
  const matchCharacterDescription = ext.matchCharacterDescription as boolean | undefined;
  const matchCharacterPersonality = ext.matchCharacterPersonality as boolean | undefined;
  const matchCharacterDepthPrompt = ext.matchCharacterDepthPrompt as boolean | undefined;
  const matchScenario = ext.matchScenario as boolean | undefined;
  const matchCreatorNotes = ext.matchCreatorNotes as boolean | undefined;
  const outletName = ext.outletName as string | undefined;
  const group = ext.group as string | undefined;
  const groupOverride = ext.groupOverride as boolean | undefined;
  const groupWeight = ext.groupWeight as number | undefined;
  const scanDepth = ext.scanDepth as number | null | undefined;
  const useGroupScoring = ext.useGroupScoring as boolean | null | undefined;
  const automationId = ext.automationId as string | undefined;
  const sticky = ext.sticky as number | null | undefined;
  const cooldown = ext.cooldown as number | null | undefined;
  const delay = ext.delay as number | null | undefined;
  const triggers = ext.triggers as string[] | undefined;
  const characterFilter = ext.characterFilter as
    | { isExclude: boolean; names: string[]; tags: string[] }
    | undefined;

  return {
    uid: entry.id,
    key: entry.keys || [],
    keysecondary: entry.secondary_keys || [],
    comment: entry.comment || '',
    content: entry.content || '',
    constant: entry.constant ?? false,
    selective: entry.selective ?? false,
    order: getEntryOrder(entry),
    position,
    disable: !entry.enabled,
    caseSensitive: entry.case_sensitive ?? false,
    extensions: restExtensions,
    vectorized,
    selectiveLogic,
    addMemo,
    ignoreBudget,
    excludeRecursion,
    preventRecursion,
    matchPersonaDescription,
    matchCharacterDescription,
    matchCharacterPersonality,
    matchCharacterDepthPrompt,
    matchScenario,
    matchCreatorNotes,
    delayUntilRecursion,
    probability,
    useProbability,
    depth,
    outletName,
    group,
    groupOverride,
    groupWeight,
    scanDepth,
    matchWholeWords,
    useGroupScoring,
    automationId,
    role: role ?? null,
    sticky,
    cooldown,
    delay,
    triggers,
    displayIndex,
    characterFilter,
  };
}

/**
 * Convert a CharacterBook to SillyTavern export format
 * @param book - The CharacterBook to convert
 * @returns The ST export data
 */
export function convertToSTLorebook(book: CharacterBook): STLorebookExport {
  const entries: Record<string, STLorebookEntry> = {};
  const takenIds = new Set(book.entries.map((entry) => entry.id));
  const usedUids = new Set<number>();
  let freeUid = 0;

  // SillyTavern looks entries up by `data.entries[uid]`, so each key must equal its uid.
  book.entries.forEach((entry, index) => {
    const stEntry = convertToSTEntry(entry, index);
    if (!Number.isFinite(stEntry.uid) || usedUids.has(stEntry.uid)) {
      while (takenIds.has(freeUid)) freeUid += 1;
      stEntry.uid = freeUid;
      takenIds.add(freeUid);
    }
    usedUids.add(stEntry.uid);
    entries[String(stEntry.uid)] = stEntry;
  });

  return {
    entries,
    originalData: {
      name: book.name || '',
      description: book.description || '',
      scan_depth: book.scan_depth,
      token_budget: book.token_budget,
      recursive_scanning: book.recursive_scanning,
      entries: book.entries.map(entry => ({
        id: entry.id,
        keys: entry.keys,
        content: entry.content,
        extensions: entry.extensions,
        enabled: entry.enabled,
        case_sensitive: entry.case_sensitive ?? undefined,
        name: entry.name,
        priority: entry.priority,
        position: entry.position,
        comment: entry.comment,
      })),
      extensions: book.extensions,
    },
  };
}

/**
 * Generic import function that auto-detects format and converts
 * @param data - The data to import
 * @returns The converted CharacterBook or null if conversion failed
 */
export function importLorebook(data: unknown): CharacterBook | null {
  const format = detectLorebookFormat(data);

  switch (format) {
    case 'sillytavern':
      return convertSTLorebook(data as STLorebookExport);
    case 'charactervault': {
      // Bare `character_book` shape, possibly from a SillyTavern card.
      const book = data as CharacterBook;
      return { ...book, entries: book.entries.map(cardBookEntryToEntry) };
    }
    default:
      return null;
  }
}

/**
 * Export a CharacterBook to the specified format
 * @param book - The CharacterBook to export
 * @param format - The target format
 * @returns The exported data or null if export failed
 */
export function exportLorebook(
  book: CharacterBook,
  format: 'sillytavern' | 'charactervault'
): STLorebookExport | CharacterBook | null {
  switch (format) {
    case 'sillytavern':
      return convertToSTLorebook(book);
    case 'charactervault':
      return book;
    default:
      return null;
  }
}
