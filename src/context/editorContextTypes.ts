/**
 * @fileoverview Types and context for the editor.
 * @module context/editorContextTypes
 */

import { createContext } from 'react';
import type { Entry, CreateEntryInput, UpdateEntryInput, SamplerSettings, AIConfig, PromptSettings } from '../db/types';

/**
 * Save status types
 */
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

/**
 * AI operation types
 */
export type AIOperation = 'expand' | 'rewrite' | 'instruct';

/**
 * Editor context value interface
 */
export interface EditorContextValue {
  /** Current entry being edited */
  currentEntry: Entry | null;
  /** Whether the current entry has unsaved changes */
  isDirty: boolean;
  /** Current save status */
  saveStatus: SaveStatus;
  /** Whether the editor is in plaintext mode */
  plaintextMode: boolean;
  /** Editor font size in pixels */
  fontSize: number;
  
  /** Currently selected text in editor */
  selectedText: string;
  /** Context entry IDs for AI */
  contextEntryIds: string[];
  /** AI configuration */
  aiConfig: AIConfig;
  /** Sampler settings */
  samplerSettings: SamplerSettings;
  /** Prompt settings */
  promptSettings: PromptSettings;
  
  /** Set the current entry */
  setCurrentEntry: (entry: Entry | null) => void;
  /** Create a new entry */
  createEntry: (input: CreateEntryInput) => Promise<Entry>;
  /** Update the current entry */
  updateEntry: (id: string, input: UpdateEntryInput) => Promise<Entry>;
  /** Delete an entry */
  deleteEntry: (id: string) => Promise<void>;
  
  /** Update content of current entry */
  updateContent: (content: string) => void;
  /** Save the current entry */
  saveCurrentEntry: () => Promise<void>;
  
  /** Toggle plaintext mode */
  togglePlaintextMode: () => void;
  /** Set plaintext mode explicitly */
  setPlaintextMode: (enabled: boolean) => void;
  /** Set font size */
  setFontSize: (size: number) => void;
  
  /** Set selected text */
  setSelectedText: (text: string) => void;
  /** Set context entry IDs */
  setContextEntryIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  /** Add a context entry */
  addContextEntry: (entryId: string) => void;
  /** Remove a context entry */
  removeContextEntry: (entryId: string) => void;
  /** Update AI configuration */
  updateAIConfig: (config: Partial<AIConfig>) => void;
  /** Update sampler settings */
  updateSamplerSettings: (settings: Partial<SamplerSettings>) => void;
  /** Update prompt settings */
  updatePromptSettings: (settings: Partial<PromptSettings>) => void;
  /** Handle AI operation result */
  handleAIOperation: (result: string, operation: AIOperation, originalSelectedText?: string) => void;
  /** Reload settings from database */
  reloadSettings: () => Promise<void>;
}

/**
 * Editor context
 */
export const EditorContext = createContext<EditorContextValue | null>(null);
