/**
 * @fileoverview Types and context for the character editor.
 * @module context/characterEditorContextTypes
 */

import { createContext } from 'react';
import type { Character, CharacterSection, CharacterSnapshot, SnapshotDiffEntry } from '../db/characterTypes';
import type { SamplerSettings, AIConfig, PromptSettings } from '../db/types';

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
  /** Selected context section IDs for AI */
  contextSectionIds: CharacterSection[];
  /** Sections manually added by the user (persisted even when active) */
  userAddedContextIds: CharacterSection[];
  /** AI configuration */
  aiConfig: AIConfig;
  /** Sampler settings */
  samplerSettings: SamplerSettings;
  /** Prompt settings */
  promptSettings: PromptSettings;
  /** Whether the history modal is open */
  isHistoryOpen: boolean;
  /** Persisted snapshots for the current character */
  snapshots: CharacterSnapshot[];
  /** Snapshot loading state */
  isSnapshotsLoading: boolean;
  
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
  /** Update AI configuration */
  updateAIConfig: (config: Partial<AIConfig>) => void;
  /** Update sampler settings */
  updateSamplerSettings: (settings: Partial<SamplerSettings>) => void;
  /** Update prompt settings */
  updatePromptSettings: (settings: Partial<PromptSettings>) => void;
  /** Toggle history modal */
  setIsHistoryOpen: (open: boolean) => void;
  /** Create a manual snapshot */
  createManualSnapshot: () => Promise<ManualSnapshotResult>;
  /** Refresh snapshots for current character */
  refreshSnapshots: () => Promise<void>;
  /** Restore a snapshot */
  restoreSnapshot: (snapshotId: string, scope: 'whole' | 'section') => Promise<void>;
  /** Get diff entries for a snapshot */
  getSnapshotDiff: (snapshotId: string) => SnapshotDiffEntry[];
  /** Handle AI operation result */
  handleAIOperation: (result: string, operation: AIOperation, originalSelectedText?: string) => void;
  /** Get context content for AI */
  getContextContent: (sectionIds: CharacterSection[]) => string[];
  /** Reload settings from database */
  reloadSettings: () => Promise<void>;
}

/**
 * Character editor context
 */
export const CharacterEditorContext = createContext<CharacterEditorContextValue | null>(null);
