/**
 * @fileoverview Types and context for the character editor.
 * @module context/characterEditorContextTypes
 */

import { createContext } from 'react';
import type {
  Character,
  CharacterSection,
  CharacterSnapshot,
  SnapshotMetadata,
  SnapshotDiffEntry,
  CustomContextMeta,
} from '../db/characterTypes';
import type {
  SamplerSettings,
  AIConfig,
  PromptSettings,
  PromptModelMap,
  SectionMeta,
  SpellcheckSettings,
} from '../db/characterTypes';

/**
 * Save status types
 */
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

/**
 * AI operation types - expanded for character creation workflow
 */
export type AIOperation =
  | 'expand'
  | 'rewrite'
  | 'instruct'
  | 'ask'
  | 'shorten'
  | 'lengthen'
  | 'vivid'
  | 'emotion'
  | 'grammar';

/**
 * Context section for AI context (character spec fields)
 */
export interface ContextSection {
  id: CharacterSection;
  label: string;
  content: string;
}

export type ManualSnapshotResult = 'created' | 'skipped';

/**
 * Character editor context value interface
 */
export interface CharacterEditorContextValue {
  /** Current character being edited */
  currentCharacter: Character | null;
  /** Currently active section */
  activeSection: CharacterSection;
  /** Whether the current character has unsaved changes */
  isDirty: boolean;
  /** Current save status */
  saveStatus: SaveStatus;
  /** Editor font size in pixels */
  fontSize: number;
  
  /** Currently selected text in editor */
  selectedText: string;
  /** User-selected section IDs included in AI context (persisted, not tied to active tab) */
  contextSectionIds: CharacterSection[];
  /**
   * Lightweight custom-context metadata for the open character (no body text).
   * Full content is loaded from IndexedDB only when editing or building AI requests.
   */
  customContextMeta: CustomContextMeta;
  /** AI configuration */
  aiConfig: AIConfig;
  /** Sampler settings */
  samplerSettings: SamplerSettings;
  /** Prompt settings */
  promptSettings: PromptSettings;
  /** Per-operation model routing for toolbar AI prompts */
  promptModels: PromptModelMap;
  /** Whether the history modal is open */
  isHistoryOpen: boolean;
  /** Persisted snapshot metadata for the current character (lightweight, no payloads) */
  snapshotMetadata: SnapshotMetadata[];
  /** Snapshot loading state */
  isSnapshotsLoading: boolean;
  
  /** Custom section tab order (full list including hidden) */
  sectionOrder: CharacterSection[];
  /** Sections hidden from the tab strip */
  hiddenSections: CharacterSection[];
  /** Computed: visible sections in display order (SectionMeta objects) */
  visibleSections: SectionMeta[];

  /** Spellcheck settings */
  spellcheck: SpellcheckSettings;
  /** When true, clicking Markdown image syntax can open the URL (with a warning). */
  markdownImageOpenLinks: boolean;
  /** Update a spellcheck field (e.g. enabled, language) */
  updateSpellcheck: (updates: Partial<SpellcheckSettings>) => void;
  /** Add a word to the user's ignore list */
  addIgnoredWord: (word: string) => Promise<void>;
  /** Add a word to the user's personal dictionary */
  addCustomWord: (word: string) => Promise<void>;
  
  /** Set the active section */
  setActiveSection: (section: CharacterSection) => void;
  /** Update the current character */
  updateCharacter: (input: Partial<Character>) => Promise<Character>;
  /** Update a specific spec field */
  updateSpecField: (field: keyof Character['data']['spec'], value: string | string[]) => Promise<Character>;
  
  /** Set font size */
  setFontSize: (size: number) => void;
  
  /** Set selected text */
  setSelectedText: (text: string) => void;
  /** Set context section IDs */
  setContextSectionIds: (ids: CharacterSection[] | ((prev: CharacterSection[]) => CharacterSection[])) => void;
  /** Add a context section */
  addContextSection: (sectionId: CharacterSection) => void;
  /** Remove a context section */
  removeContextSection: (sectionId: CharacterSection) => void;
  /** Enable/disable custom context for the open character (persists meta only) */
  setCustomContextEnabled: (enabled: boolean) => Promise<void>;
  /** Save custom context body + enabled flag; updates meta and drops body from memory */
  saveCustomContext: (input: { content: string; enabled: boolean }) => Promise<void>;
  /** Clear custom context for the open character */
  clearCustomContext: () => Promise<void>;
  /** Update AI configuration */
  updateAIConfig: (config: Partial<AIConfig>) => void;
  /** Update sampler settings */
  updateSamplerSettings: (settings: Partial<SamplerSettings>) => void;
  /** Update prompt settings */
  updatePromptSettings: (settings: Partial<PromptSettings>) => void;
  /** Replace per-operation model routing map */
  updatePromptModels: (promptModels: PromptModelMap) => void;
  /** Toggle history modal */
  setIsHistoryOpen: (open: boolean) => void;
  /** Flush pending saves then open the history modal */
  openHistory: () => Promise<boolean>;
  /** True while openHistory is flushing */
  isOpeningHistory: boolean;
  /** Create a manual snapshot */
  createManualSnapshot: () => Promise<ManualSnapshotResult>;
  /** Refresh snapshots for current character */
  refreshSnapshots: () => Promise<void>;
  /** Delete a snapshot if allowed */
  deleteSnapshot: (snapshotId: string) => Promise<void>;
  /** Restore a snapshot */
  restoreSnapshot: (snapshotId: string, scope: 'whole' | 'section', targetSection?: CharacterSection) => Promise<void>;
  /** Overwrite the baseline ('open') snapshot in place with the current draft */
  updateBaselineSnapshot: (snapshotId: string) => Promise<void>;
  /**
   * Load snapshot payload once and compute diff entries (lazy payload load).
   * Prefer this over separate load + diff calls to avoid double fetch.
   */
  getSnapshotDiff: (snapshotId: string) => Promise<{
    snapshot: CharacterSnapshot | null;
    entries: SnapshotDiffEntry[];
  }>;
  /** Handle AI operation result */
  handleAIOperation: (result: string, operation: AIOperation, originalSelectedText?: string) => void;
  /** Get section context content for AI (sync; no custom context body) */
  getContextContent: (sectionIds: CharacterSection[]) => string[];
  /**
   * Resolve full AI context: section chunks + enabled custom context (loaded from IDB).
   * Custom body is not retained after the promise resolves.
   */
  resolveContextForAI: (sectionIds: CharacterSection[]) => Promise<string[]>;
  /** Reload settings from database */
  reloadSettings: () => Promise<void>;
  /** Update section layout (order + hidden) in local state */
  updateSectionLayout: (updates: { sectionOrder?: CharacterSection[]; hiddenSections?: CharacterSection[] }) => void;
  /** Reset section layout to defaults in local state */
  resetSectionLayoutLocal: () => void;
}

/**
 * Character editor context
 */
export const CharacterEditorContext = createContext<CharacterEditorContextValue | null>(null);
