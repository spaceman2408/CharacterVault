/**
 * @fileoverview Lorebook format converter for importing/exporting character books
 * from/to various frontends (SillyTavern, etc.)
 * @module services/LorebookConverter
 */

import type { CharacterBook, LorebookEntry } from '../db/characterTypes';

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
  position: number; // 0=before_char, 1=after_char, 2=before_example, 3=after_example
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
  originalData?: {
    name?: string;
    description?: string;
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
 * Mapping from ST numeric position to CharacterVault string position
 */
const POSITION_MAP: Record<number, LorebookEntry['position']> = {
  0: 'before_char',
  1: 'after_char',
  2: 'before_example',
  3: 'after_example',
};

/**
 * Reverse mapping from CharacterVault string position to ST numeric position
 */
const REVERSE_POSITION_MAP: Record<NonNullable<LorebookEntry['position']>, number> = {
  before_char: 0,
  after_char: 1,
  before_example: 2,
  after_example: 3,
};

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
  // Extract ST-specific fields to store in extensions
  const stSpecificFields: Record<string, unknown> = {
    vectorized: entry.vectorized,
    selectiveLogic: entry.selectiveLogic,
    addMemo: entry.addMemo,
    ignoreBudget: entry.ignoreBudget,
    excludeRecursion: entry.excludeRecursion,
    preventRecursion: entry.preventRecursion,
    matchPersonaDescription: entry.matchPersonaDescription,
    matchCharacterDescription: entry.matchCharacterDescription,
    matchCharacterPersonality: entry.matchCharacterPersonality,
    matchCharacterDepthPrompt: entry.matchCharacterDepthPrompt,
    matchScenario: entry.matchScenario,
    matchCreatorNotes: entry.matchCreatorNotes,
    delayUntilRecursion: entry.delayUntilRecursion,
    probability: entry.probability,
    useProbability: entry.useProbability,
    depth: entry.depth,
    outletName: entry.outletName,
    group: entry.group,
    groupOverride: entry.groupOverride,
    groupWeight: entry.groupWeight,
    scanDepth: entry.scanDepth,
    matchWholeWords: entry.matchWholeWords,
    useGroupScoring: entry.useGroupScoring,
    automationId: entry.automationId,
    role: entry.role,
    sticky: entry.sticky,
    cooldown: entry.cooldown,
    delay: entry.delay,
    triggers: entry.triggers,
    displayIndex: entry.displayIndex,
    characterFilter: entry.characterFilter,
  };

  // Filter out undefined values
  const filteredStFields = Object.fromEntries(
    Object.entries(stSpecificFields).filter(([, v]) => v !== undefined)
  );

  return {
    id: entry.uid,
    keys: entry.key || [],
    secondary_keys: entry.keysecondary || [],
    comment: entry.comment || '',
    content: entry.content || '',
    constant: entry.constant ?? false,
    selective: entry.selective ?? false,
    priority: entry.order ?? 0,
    position: POSITION_MAP[entry.position] ?? 'before_char',
    enabled: !entry.disable,
    case_sensitive: entry.caseSensitive ?? false,
    name: '', // ST doesn't have a separate name field, use comment
    extensions: {
      ...entry.extensions,
      ...filteredStFields,
      // Store the original ST position for round-trip fidelity
      _st_position: entry.position,
    },
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

  // Try to get name/description from originalData if available, otherwise empty
  const originalData = data.originalData;

  return {
    name: originalData?.name || '',
    description: originalData?.description || '',
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
  // Get ST-specific fields from extensions if they exist
  const ext = entry.extensions || {};

  return {
    uid: entry.id,
    key: entry.keys || [],
    keysecondary: entry.secondary_keys || [],
    comment: entry.comment || '',
    content: entry.content || '',
    constant: entry.constant ?? false,
    selective: entry.selective ?? false,
    order: entry.priority ?? 0,
    position: REVERSE_POSITION_MAP[entry.position ?? 'before_char'] ?? 0,
    disable: !entry.enabled,
    caseSensitive: entry.case_sensitive ?? false,
    extensions: {
      ...ext,
      // Remove ST-specific fields we restored
      _st_position: undefined,
      vectorized: undefined,
      selectiveLogic: undefined,
      addMemo: undefined,
      ignoreBudget: undefined,
      excludeRecursion: undefined,
      preventRecursion: undefined,
      matchPersonaDescription: undefined,
      matchCharacterDescription: undefined,
      matchCharacterPersonality: undefined,
      matchCharacterDepthPrompt: undefined,
      matchScenario: undefined,
      matchCreatorNotes: undefined,
      delayUntilRecursion: undefined,
      probability: undefined,
      useProbability: undefined,
      depth: undefined,
      outletName: undefined,
      group: undefined,
      groupOverride: undefined,
      groupWeight: undefined,
      scanDepth: undefined,
      matchWholeWords: undefined,
      useGroupScoring: undefined,
      automationId: undefined,
      role: undefined,
      sticky: undefined,
      cooldown: undefined,
      delay: undefined,
      triggers: undefined,
      displayIndex: undefined,
      characterFilter: undefined,
    },
    // Restore ST-specific fields from extensions if present
    vectorized: ext.vectorized as boolean | undefined,
    selectiveLogic: ext.selectiveLogic as number | undefined,
    addMemo: ext.addMemo as boolean | undefined,
    ignoreBudget: ext.ignoreBudget as boolean | undefined,
    excludeRecursion: ext.excludeRecursion as boolean | undefined,
    preventRecursion: ext.preventRecursion as boolean | undefined,
    matchPersonaDescription: ext.matchPersonaDescription as boolean | undefined,
    matchCharacterDescription: ext.matchCharacterDescription as boolean | undefined,
    matchCharacterPersonality: ext.matchCharacterPersonality as boolean | undefined,
    matchCharacterDepthPrompt: ext.matchCharacterDepthPrompt as boolean | undefined,
    matchScenario: ext.matchScenario as boolean | undefined,
    matchCreatorNotes: ext.matchCreatorNotes as boolean | undefined,
    delayUntilRecursion: ext.delayUntilRecursion as boolean | undefined,
    probability: ext.probability as number | undefined,
    useProbability: ext.useProbability as boolean | undefined,
    depth: ext.depth as number | undefined,
    outletName: ext.outletName as string | undefined,
    group: ext.group as string | undefined,
    groupOverride: ext.groupOverride as boolean | undefined,
    groupWeight: ext.groupWeight as number | undefined,
    scanDepth: ext.scanDepth as number | null | undefined,
    matchWholeWords: ext.matchWholeWords as boolean | null | undefined,
    useGroupScoring: ext.useGroupScoring as boolean | null | undefined,
    automationId: ext.automationId as string | undefined,
    role: ext.role as number | null | undefined,
    sticky: ext.sticky as number | null | undefined,
    cooldown: ext.cooldown as number | null | undefined,
    delay: ext.delay as number | null | undefined,
    triggers: ext.triggers as string[] | undefined,
    displayIndex,
    characterFilter: ext.characterFilter as { isExclude: boolean; names: string[]; tags: string[] } | undefined,
  };
}

/**
 * Convert a CharacterBook to SillyTavern export format
 * @param book - The CharacterBook to convert
 * @returns The ST export data
 */
export function convertToSTLorebook(book: CharacterBook): STLorebookExport {
  const entries: Record<string, STLorebookEntry> = {};

  book.entries.forEach((entry, index) => {
    entries[String(index)] = convertToSTEntry(entry, index);
  });

  return {
    entries,
    originalData: {
      name: book.name || '',
      description: book.description || '',
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
    case 'charactervault':
      // Already in our format, just validate and return
      return data as CharacterBook;
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
