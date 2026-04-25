/**
 * @fileoverview Character editor context provider component.
 * @module context/CharacterEditorContext
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Character, CharacterSection, SnapshotMetadata, SnapshotDiffEntry } from '../db/characterTypes';
import type { SamplerSettings, AIConfig, PromptSettings } from '../db/types';
import { DEFAULT_SETTINGS } from '../db/types';
import { useCharacterContext } from './useCharacterContext';
import { CharacterEditorContext, type CharacterEditorContextValue, type SaveStatus, type AIOperation, type ManualSnapshotResult } from './characterEditorContextTypes';
import { characterSettingsService } from '../services/CharacterSettingsService';
import { characterSnapshotService } from '../services/CharacterSnapshotService';
import { generateThumbnail } from '../utils/thumbnail';

const CENTRAL_SAVE_DEBOUNCE_MS = 500;

/**
 * Props for the CharacterEditorProvider component
 */
interface CharacterEditorProviderProps {
  children: React.ReactNode;
}

/**
 * CharacterEditorProvider - Provides character editor state and operations
 * 
 * Features:
 * - Current character management
 * - Debounced save functionality
 * - Save status tracking
 * - AI settings and context management
 * 
 * @param props - Component props
 * @returns React element
 */
export default function CharacterEditorProvider({ children }: CharacterEditorProviderProps): React.ReactElement {
  const { currentCharacter, updateCharacter: updateCharacterBase, updateSpecField: updateSpecFieldBase } = useCharacterContext();
  const currentCharacterId = currentCharacter?.id ?? null;
  
  const [activeSection, setActiveSection] = useState<CharacterSection>('name');
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [fontSize, setFontSizeState] = useState(16);
  
  // AI-related state
  const [selectedText, setSelectedText] = useState('');
  const [userAddedContextIds, setUserAddedContextIds] = useState<CharacterSection[]>([]);
  const [removedSectionIds, setRemovedSectionIds] = useState<CharacterSection[]>([]);
  const [aiConfig, setAIConfig] = useState<AIConfig>(DEFAULT_SETTINGS.ai);
  const [samplerSettings, setSamplerSettings] = useState<SamplerSettings>(DEFAULT_SETTINGS.sampler);
  const [promptSettings, setPromptSettings] = useState<PromptSettings>(DEFAULT_SETTINGS.prompts);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [snapshotMetadata, setSnapshotMetadata] = useState<SnapshotMetadata[]>([]);
  const [isSnapshotsLoading, setIsSnapshotsLoading] = useState(false);
  const specFieldRequestVersionRef = useRef<Map<string, number>>(new Map());
  const specSaveTimerRef = useRef<Map<string, number>>(new Map());
  const specPendingValueRef = useRef<Map<string, string | string[]>>(new Map());
  const specPendingResolversRef = useRef<Map<string, {
    resolve: Array<(value: Character) => void>;
    reject: Array<(reason?: unknown) => void>;
  }>>(new Map());
  const updateCharacterRequestVersionRef = useRef<Map<string, number>>(new Map());
  const updateCharacterSaveTimerRef = useRef<Map<string, number>>(new Map());
  const updateCharacterPendingInputRef = useRef<Map<string, Partial<Character>>>(new Map());
  const updateCharacterPendingResolversRef = useRef<Map<string, {
    resolve: Array<(value: Character) => void>;
    reject: Array<(reason?: unknown) => void>;
  }>>(new Map());
  const openedCharacterIdRef = useRef<string | null>(null);
  const currentCharacterRef = useRef<Character | null>(currentCharacter);
  const selectedTextRef = useRef(selectedText);
  const isHistoryOpenRef = useRef(isHistoryOpen);

  useEffect(() => {
    currentCharacterRef.current = currentCharacter;
  }, [currentCharacter]);

  useEffect(() => {
    selectedTextRef.current = selectedText;
  }, [selectedText]);

  useEffect(() => {
    isHistoryOpenRef.current = isHistoryOpen;
  }, [isHistoryOpen]);

  const refreshSnapshotsForCharacter = useCallback(async (characterId: string) => {
    setIsSnapshotsLoading(true);
    try {
      const metadata = await characterSnapshotService.listSnapshotMetadata(characterId);
      setSnapshotMetadata(metadata);
    } catch (error) {
      console.error('Failed to load snapshots:', error);
    } finally {
      setIsSnapshotsLoading(false);
    }
  }, []);

  const refreshSnapshots = useCallback(async () => {
    if (!currentCharacterId) {
      setSnapshotMetadata([]);
      return;
    }

    await refreshSnapshotsForCharacter(currentCharacterId);
  }, [currentCharacterId, refreshSnapshotsForCharacter]);

  const createSnapshotFromCharacter = useCallback(async (character: Character, source: 'manual' | 'rollback') => {
    try {
      const snapshot = await characterSnapshotService.createSnapshot(character, source);
      if (isHistoryOpenRef.current) {
        await refreshSnapshotsForCharacter(character.id);
      }
      return snapshot;
    } catch (error) {
      console.error(`Failed to create ${source} snapshot:`, error);
      return null;
    }
  }, [refreshSnapshotsForCharacter]);

  const commitQueuedCharacterUpdate = useCallback(async (requestKey: string, characterId: string): Promise<Character | null> => {
    const queuedInput = updateCharacterPendingInputRef.current.get(requestKey);
    if (!queuedInput) {
      return null;
    }

    const nextVersion = (updateCharacterRequestVersionRef.current.get(requestKey) ?? 0) + 1;
    updateCharacterRequestVersionRef.current.set(requestKey, nextVersion);

    try {
      const updated = await updateCharacterBase(characterId, queuedInput);
      const currentResolvers = updateCharacterPendingResolversRef.current.get(requestKey);
      updateCharacterPendingInputRef.current.delete(requestKey);
      updateCharacterPendingResolversRef.current.delete(requestKey);

      if (updateCharacterRequestVersionRef.current.get(requestKey) === nextVersion) {
        setIsDirty(false);
        setSaveStatus('saved');
      }

      currentResolvers?.resolve.forEach(fn => fn(updated));
      return updated;
    } catch (error) {
      const currentResolvers = updateCharacterPendingResolversRef.current.get(requestKey);
      updateCharacterPendingInputRef.current.delete(requestKey);
      updateCharacterPendingResolversRef.current.delete(requestKey);

      if (updateCharacterRequestVersionRef.current.get(requestKey) === nextVersion) {
        setSaveStatus('error');
      }

      currentResolvers?.reject.forEach(fn => fn(error));
      throw error;
    }
  }, [updateCharacterBase]);

  const commitQueuedSpecFieldUpdate = useCallback(async (
    requestKey: string,
    characterId: string,
    field: keyof Character['data']['spec'],
  ): Promise<Character | null> => {
    const queuedValue = specPendingValueRef.current.get(requestKey);
    if (queuedValue === undefined) {
      return null;
    }

    const nextVersion = (specFieldRequestVersionRef.current.get(requestKey) ?? 0) + 1;
    specFieldRequestVersionRef.current.set(requestKey, nextVersion);

    try {
      const updated = await updateSpecFieldBase(characterId, field, queuedValue);
      const currentResolvers = specPendingResolversRef.current.get(requestKey);
      specPendingValueRef.current.delete(requestKey);
      specPendingResolversRef.current.delete(requestKey);

      if (specFieldRequestVersionRef.current.get(requestKey) === nextVersion) {
        setIsDirty(false);
        setSaveStatus('saved');
      }

      currentResolvers?.resolve.forEach(fn => fn(updated));
      return updated;
    } catch (error) {
      const currentResolvers = specPendingResolversRef.current.get(requestKey);
      specPendingValueRef.current.delete(requestKey);
      specPendingResolversRef.current.delete(requestKey);

      if (specFieldRequestVersionRef.current.get(requestKey) === nextVersion) {
        console.error('Failed to save spec field:', error);
        setSaveStatus('error');
      }
      currentResolvers?.reject.forEach(fn => fn(error));
      throw error;
    }
  }, [updateSpecFieldBase]);

  const flushPendingSaves = useCallback(async (): Promise<Character | null> => {
    const character = currentCharacterRef.current;
    if (!character) {
      return null;
    }

    const characterId = character.id;
    const updates: Array<Promise<Character | null>> = [];
    const characterRequestKey = `${characterId}:updateCharacter`;

    if (updateCharacterSaveTimerRef.current.has(characterRequestKey)) {
      window.clearTimeout(updateCharacterSaveTimerRef.current.get(characterRequestKey));
      updateCharacterSaveTimerRef.current.delete(characterRequestKey);
      updates.push(commitQueuedCharacterUpdate(characterRequestKey, characterId));
    }

    for (const [requestKey, timerId] of specSaveTimerRef.current.entries()) {
      if (!requestKey.startsWith(`${characterId}:`)) {
        continue;
      }

      window.clearTimeout(timerId);
      specSaveTimerRef.current.delete(requestKey);
      const field = requestKey.slice(characterId.length + 1) as keyof Character['data']['spec'];
      updates.push(commitQueuedSpecFieldUpdate(requestKey, characterId, field));
    }

    if (updates.length === 0) {
      return character;
    }

    const results = await Promise.all(updates);
    return results.filter((result): result is Character => result !== null).at(-1) ?? character;
  }, [commitQueuedCharacterUpdate, commitQueuedSpecFieldUpdate]);

  // Context sections = active section (unless removed) + user-added sections
  const contextSectionIds = React.useMemo<CharacterSection[]>(() => {
    // Auto-add active section unless it's been removed or is image/extensions
    const autoContext = ['image', 'extensions'].includes(activeSection) || removedSectionIds.includes(activeSection)
      ? [] 
      : [activeSection];
    
    // Merge with user-added, deduplicate, exclude removed
    return [...new Set([...autoContext, ...userAddedContextIds])].filter(
      id => !removedSectionIds.includes(id)
    );
  }, [activeSection, userAddedContextIds, removedSectionIds]);

  // Function to reload settings from database
  const reloadSettings = useCallback(async () => {
    try {
      const [config, sampler, prompts, settings] = await Promise.all([
        characterSettingsService.getAISettings(),
        characterSettingsService.getSamplerSettings(),
        characterSettingsService.getPromptSettings(),
        characterSettingsService.getSettings(),
      ]);
      setAIConfig(config);
      setSamplerSettings(sampler);
      setPromptSettings(prompts);
      setFontSizeState(settings.ui.editorFontSize);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }, []);

  // Initialize settings when component mounts (defer to avoid setState in render warning)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void reloadSettings();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [reloadSettings]);

  // Update CSS variable when font size changes
  useEffect(() => {
    document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
  }, [fontSize]);

  useEffect(() => {
    if (!currentCharacter || !currentCharacterId) {
      openedCharacterIdRef.current = null;
      setSnapshotMetadata([]);
      setIsHistoryOpen(false);
      // Clear all editor state to free memory
      setActiveSection('name');
      setIsDirty(false);
      setSaveStatus('saved');
      setSelectedText('');
      setUserAddedContextIds([]);
      setRemovedSectionIds([]);
      // Clear any pending debounce timers
      specSaveTimerRef.current.forEach(timerId => window.clearTimeout(timerId));
      specSaveTimerRef.current.clear();
      specPendingValueRef.current.clear();
      specPendingResolversRef.current.clear();
      specFieldRequestVersionRef.current.clear();
      updateCharacterSaveTimerRef.current.forEach(timerId => window.clearTimeout(timerId));
      updateCharacterSaveTimerRef.current.clear();
      updateCharacterPendingInputRef.current.clear();
      updateCharacterPendingResolversRef.current.clear();
      updateCharacterRequestVersionRef.current.clear();
      return;
    }

    if (openedCharacterIdRef.current === currentCharacterId) {
      return;
    }

    openedCharacterIdRef.current = currentCharacterId;
    // Note: 'open' snapshots are created by openCharacter() in useCharacter.ts
    // We don't create them here to avoid creating snapshots for newly created blank characters
    if (isHistoryOpenRef.current) {
      void refreshSnapshots();
    } else {
      setSnapshotMetadata([]);
    }
  }, [currentCharacter, currentCharacterId, refreshSnapshots]);

  useEffect(() => {
    if (!isHistoryOpen) {
      setSnapshotMetadata([]);
      setIsSnapshotsLoading(false);
      return;
    }

    if (!currentCharacterId) {
      setSnapshotMetadata([]);
      return;
    }

    void refreshSnapshotsForCharacter(currentCharacterId);
  }, [currentCharacterId, isHistoryOpen, refreshSnapshotsForCharacter]);

  // Clear removed sections when navigating so they can be auto-added again
  // Using a ref to track previous active section to avoid cascading renders
  const prevActiveSectionRef = useRef<CharacterSection>(activeSection);
  
  useEffect(() => {
    if (prevActiveSectionRef.current !== activeSection) {
      prevActiveSectionRef.current = activeSection;
      // Use setTimeout to defer state update and avoid cascading renders
      const timeoutId = setTimeout(() => {
        setRemovedSectionIds([]);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [activeSection]);

  /**
   * Update the character
   */
  const updateCharacter = useCallback(async (input: Partial<Character>): Promise<Character> => {
    const character = currentCharacterRef.current;
    if (!character) {
      throw new Error('No character is currently open');
    }

    const characterId = character.id;
    const requestKey = `${characterId}:updateCharacter`;
    setIsDirty(true);
    setSaveStatus('saving');

    const previousInput = updateCharacterPendingInputRef.current.get(requestKey);
    const nextInput: Partial<Character> = {
      ...previousInput,
      ...input,
      data: input.data ?? previousInput?.data,
    };
    updateCharacterPendingInputRef.current.set(requestKey, nextInput);

    if (updateCharacterSaveTimerRef.current.has(requestKey)) {
      window.clearTimeout(updateCharacterSaveTimerRef.current.get(requestKey));
    }

    return new Promise<Character>((resolve, reject) => {
      const pendingResolvers = updateCharacterPendingResolversRef.current.get(requestKey) ?? { resolve: [], reject: [] };
      pendingResolvers.resolve.push(resolve);
      pendingResolvers.reject.push(reject);
      updateCharacterPendingResolversRef.current.set(requestKey, pendingResolvers);

      const timerId = window.setTimeout(async () => {
        updateCharacterSaveTimerRef.current.delete(requestKey);
        try {
          await commitQueuedCharacterUpdate(requestKey, characterId);
        } catch {
          // Errors are forwarded to pending resolvers by commitQueuedCharacterUpdate.
        }
      }, CENTRAL_SAVE_DEBOUNCE_MS);

      updateCharacterSaveTimerRef.current.set(requestKey, timerId);
    });
  }, [commitQueuedCharacterUpdate]);

  /**
   * Update a specific spec field
   */
  const updateSpecField = useCallback(async (
    field: keyof Character['data']['spec'],
    value: string | string[]
  ): Promise<Character> => {
    const character = currentCharacterRef.current;
    if (!character) {
      throw new Error('No character is currently open');
    }

    const requestKey = `${character.id}:${String(field)}`;
    const characterId = character.id;
    specPendingValueRef.current.set(requestKey, value);
    setIsDirty(true);
    setSaveStatus('saving');

    if (specSaveTimerRef.current.has(requestKey)) {
      window.clearTimeout(specSaveTimerRef.current.get(requestKey));
    }

    return new Promise<Character>((resolve, reject) => {
      const pendingResolvers = specPendingResolversRef.current.get(requestKey) ?? { resolve: [], reject: [] };
      pendingResolvers.resolve.push(resolve);
      pendingResolvers.reject.push(reject);
      specPendingResolversRef.current.set(requestKey, pendingResolvers);

      const timerId = window.setTimeout(async () => {
        specSaveTimerRef.current.delete(requestKey);
        try {
          await commitQueuedSpecFieldUpdate(requestKey, characterId, field);
        } catch {
          // Errors are forwarded to pending resolvers by commitQueuedSpecFieldUpdate.
        }
      }, CENTRAL_SAVE_DEBOUNCE_MS);

      specSaveTimerRef.current.set(requestKey, timerId);
    });
  }, [commitQueuedSpecFieldUpdate]);

  /**
   * Set font size
   */
  const setFontSize = useCallback(async (size: number) => {
    setFontSizeState(size);
    
    // Update CSS variable
    document.documentElement.style.setProperty('--editor-font-size', `${size}px`);
    
    // Persist to database
    try {
      const settings = await characterSettingsService.getSettings();
      await characterSettingsService.saveSettings({
        ...settings,
        ui: {
          ...settings.ui,
          editorFontSize: size,
        },
      });
    } catch (error) {
      console.error('Failed to save font size:', error);
    }
  }, []);

  /**
   * Set context section IDs (replaces user-added sections)
   * Note: The active section is always included automatically
   */
  const setContextSectionIdsCallback = useCallback((ids: CharacterSection[] | ((prev: CharacterSection[]) => CharacterSection[])) => {
    setUserAddedContextIds(prev => {
      const newIds = typeof ids === 'function' ? ids(prev) : ids;
      // Filter out the active section since it's auto-included
      const userIds = newIds.filter(id => id !== activeSection);
      // Persist to database
      void characterSettingsService.saveContextSectionIds(userIds);
      return userIds;
    });
  }, [activeSection]);

  /**
   * Add a context section (user-added)
   */
  const addContextSection = useCallback((sectionId: CharacterSection) => {
    // Remove from removed list (if it was previously removed)
    setRemovedSectionIds(prev => prev.filter(id => id !== sectionId));
    
    setUserAddedContextIds(prev => {
      if (prev.includes(sectionId)) return prev;
      const newIds = [...prev, sectionId];
      void characterSettingsService.addContextSection(sectionId);
      return newIds;
    });
  }, []);

  /**
   * Remove a context section (user-added or auto-added)
   */
  const removeContextSection = useCallback((sectionId: CharacterSection) => {
    // Add to removed list to prevent auto-re-adding
    setRemovedSectionIds(prev => [...new Set([...prev, sectionId])]);
    
    setUserAddedContextIds(prev => {
      const newIds = prev.filter(id => id !== sectionId);
      void characterSettingsService.removeContextSection(sectionId);
      return newIds;
    });
  }, []);

  /**
   * Update AI configuration
   */
  const updateAIConfig = useCallback((config: Partial<AIConfig>) => {
    setAIConfig(prev => {
      const newConfig = { ...prev, ...config };
      void characterSettingsService.saveAISettings(newConfig);
      return newConfig;
    });
  }, []);

  /**
   * Update sampler settings
   */
  const updateSamplerSettings = useCallback((settings: Partial<SamplerSettings>) => {
    setSamplerSettings(prev => {
      const newSettings = { ...prev, ...settings };
      void characterSettingsService.saveSamplerSettings(newSettings);
      return newSettings;
    });
  }, []);

  /**
   * Update prompt settings
   */
  const updatePromptSettings = useCallback((settings: Partial<PromptSettings>) => {
    setPromptSettings(prev => {
      const newSettings = { ...prev, ...settings };
      void characterSettingsService.savePromptSettings(newSettings);
      return newSettings;
    });
  }, []);

  const createManualSnapshot = useCallback(async (): Promise<ManualSnapshotResult> => {
    const character = currentCharacterRef.current;
    if (!character) {
      return 'skipped';
    }

    const latestCharacter = await flushPendingSaves();
    const snapshot = await createSnapshotFromCharacter(latestCharacter ?? character, 'manual');
    return snapshot ? 'created' : 'skipped';
  }, [createSnapshotFromCharacter, flushPendingSaves]);

  const getSnapshotDiff = useCallback(async (snapshotId: string): Promise<SnapshotDiffEntry[]> => {
    const character = currentCharacterRef.current;
    if (!character) {
      return [];
    }

    // Load the full snapshot payload lazily from DB
    const snapshot = await characterSnapshotService.loadSnapshotPayload(snapshotId);
    if (!snapshot) {
      return [];
    }

    // Store the selected snapshot for potential restore operations
    return characterSnapshotService.diffSnapshotAgainstCharacter(snapshot, character);
  }, []);

  const deleteSnapshot = useCallback(async (snapshotId: string) => {
    const metadata = snapshotMetadata.find(entry => entry.id === snapshotId);
    if (!metadata) {
      return;
    }

    try {
      await characterSnapshotService.deleteSnapshotById(snapshotId);
      await refreshSnapshotsForCharacter(metadata.characterId);
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
      throw error;
    }
  }, [refreshSnapshotsForCharacter, snapshotMetadata]);

  const restoreSnapshot = useCallback(async (
    snapshotId: string,
    scope: 'whole' | 'section',
    targetSection?: CharacterSection,
  ) => {
    const character = currentCharacterRef.current;
    if (!character) {
      return;
    }

    // Load the full snapshot payload lazily from DB
    const snapshot = await characterSnapshotService.loadSnapshotPayload(snapshotId);
    if (!snapshot) {
      return;
    }

    setSaveStatus('saving');

    try {
      let restoredCharacter: Character;

      if (scope === 'whole') {
        const input = await characterSnapshotService.restoreWholeCharacter(character, snapshot);
        restoredCharacter = await updateCharacterBase(character.id, input);
      } else {
        const sectionToRestore = targetSection;
        if (!sectionToRestore) {
          setSaveStatus('saved');
          return;
        }

        const action = await characterSnapshotService.restoreSection(character, snapshot, sectionToRestore);
        if (!action) {
          setSaveStatus('saved');
          return;
        }

        if (action.kind === 'image') {
          const thumbnailData = action.value ? await generateThumbnail(action.value) : '';
          restoredCharacter = await updateCharacterBase(character.id, { imageData: action.value, thumbnailData });
        } else if (action.kind === 'spec') {
          restoredCharacter = await updateSpecFieldBase(character.id, action.field, action.value);
        } else {
          restoredCharacter = await updateCharacterBase(character.id, action.input);
        }
      }

      setIsDirty(false);
      setSaveStatus('saved');
      await createSnapshotFromCharacter(restoredCharacter, 'rollback');
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
      setSaveStatus('error');
      throw error;
    }
  }, [
    createSnapshotFromCharacter,
    updateCharacterBase,
    updateSpecFieldBase,
  ]);

  /**
   * Get context content for AI from selected sections
   */
  const getContextContent = useCallback((sectionIds: CharacterSection[]): string[] => {
    const character = currentCharacterRef.current;
    if (!character) return [];
    
    return sectionIds.map(sectionId => {
      const spec = character.data.spec;
      switch (sectionId) {
        case 'name':
          return `Character Name: ${spec.name}`;
        case 'description':
          return `Description:\n${spec.description}`;
        case 'personality':
          return `Personality:\n${spec.personality}`;
        case 'scenario':
          return `Scenario:\n${spec.scenario}`;
        case 'first_mes':
          return `First Message:\n${spec.first_mes}`;
        case 'mes_example':
          return `Message Examples:\n${spec.mes_example}`;
        case 'system_prompt':
          return `System Prompt:\n${spec.system_prompt}`;
        case 'post_history_instructions':
          return `Post-History Instructions:\n${spec.post_history_instructions}`;
        case 'alternate_greetings':
          return `Alternate Greetings:\n${spec.alternate_greetings.join('\n---\n')}`;
        case 'physical_description':
          return `Physical Description:\n${spec.physical_description}`;
        // V3 spec fields
        case 'avatar':
          return spec.avatar ? `Avatar URL: ${spec.avatar}` : '';
        case 'creator_notes':
          return spec.creator_notes ? `Creator Notes:\n${spec.creator_notes}` : '';
        case 'creator':
          return spec.creator ? `Creator: ${spec.creator}` : '';
        case 'character_version':
          return spec.character_version ? `Version: ${spec.character_version}` : '';
        case 'tags':
          return spec.tags?.length ? `Tags: ${spec.tags.join(', ')}` : '';
        case 'lorebook': {
          const book = character.data.characterBook;
          if (!book || book.entries.length === 0) return '';
          
          const enabledEntries = book.entries.filter(e => e.enabled && e.extensions?.context_enabled !== false);
          if (enabledEntries.length === 0) return '';
          
          let loreContent = `Lorebook: ${book.name || 'Character Lore'}\n`;
          if (book.description) {
            loreContent += `${book.description}\n`;
          }
          loreContent += '\n';
          
          enabledEntries.forEach(entry => {
            loreContent += `[Entry ${entry.id}]`;
            if (entry.name) loreContent += ` ${entry.name}`;
            loreContent += '\n';
            loreContent += `Keys: ${entry.keys.join(', ')}\n`;
            if (entry.comment) loreContent += `Note: ${entry.comment}\n`;
            loreContent += `${entry.content}\n\n`;
          });
          
          return loreContent.trim();
        }
        default:
          return '';
      }
    }).filter(content => content.length > 0);
  }, []);

  /**
   * Handle AI operation result
   */
  const handleAIOperation = useCallback((result: string, operation: AIOperation, originalSelectedText?: string) => {
    const character = currentCharacterRef.current;
    if (!character || !activeSection) return;
    
    // Get current field value
    const spec = character.data.spec;
    let currentValue: string;
    
    switch (activeSection) {
      case 'name':
        currentValue = spec.name;
        break;
      case 'description':
        currentValue = spec.description;
        break;
      case 'personality':
        currentValue = spec.personality;
        break;
      case 'scenario':
        currentValue = spec.scenario;
        break;
      case 'first_mes':
        currentValue = spec.first_mes;
        break;
      case 'mes_example':
        currentValue = spec.mes_example;
        break;
      case 'system_prompt':
        currentValue = spec.system_prompt;
        break;
      case 'post_history_instructions':
        currentValue = spec.post_history_instructions;
        break;
      case 'alternate_greetings':
        currentValue = spec.alternate_greetings.join('\n---\n');
        break;
      case 'physical_description':
        currentValue = spec.physical_description;
        break;
      // V3 spec fields
      case 'avatar':
        currentValue = spec.avatar || '';
        break;
      case 'creator_notes':
        currentValue = spec.creator_notes || '';
        break;
      case 'creator':
        currentValue = spec.creator || '';
        break;
      case 'character_version':
        currentValue = spec.character_version || '';
        break;
      case 'tags':
        currentValue = spec.tags?.join(', ') || '';
        break;
      default:
        return;
    }
    
    // Use the passed original selected text, or fall back to state (for backwards compatibility)
    const textToReplace = originalSelectedText ?? selectedTextRef.current;
    
    let newContent: string;
    
    switch (operation) {
      case 'expand':
      case 'rewrite':
      case 'instruct':
        // Replace selected text with result
        if (textToReplace) {
          // Find the first occurrence of the selected text and replace it
          const index = currentValue.indexOf(textToReplace);
          
          if (index !== -1) {
            newContent =
              currentValue.substring(0, index) +
              result +
              currentValue.substring(index + textToReplace.length);
          } else {
            // Text not found - try with trimmed whitespace
            const trimmedSearch = textToReplace.trim();
            const trimmedIndex = currentValue.indexOf(trimmedSearch);
            
            if (trimmedIndex !== -1) {
              newContent =
                currentValue.substring(0, trimmedIndex) +
                result +
                currentValue.substring(trimmedIndex + trimmedSearch.length);
            } else {
              // Still not found - append as fallback
              console.warn('AI operation: Selected text not found in content, appending instead');
              newContent = currentValue + '\n\n' + result;
            }
          }
        } else {
          // No text selected - append result
          newContent = currentValue + '\n\n' + result;
        }
        break;
      case 'ask':
        // For ask operation, just insert at cursor or append
        newContent = currentValue + '\n\n' + result;
        break;
      default:
        newContent = currentValue;
    }
    
    // Update the spec field
    if (activeSection === 'alternate_greetings') {
      void updateSpecField(activeSection, newContent.split('\n---\n').filter(g => g.trim()));
    } else if (activeSection === 'tags') {
      // Convert comma-separated string to array for tags
      void updateSpecField(activeSection, newContent.split(',').map(t => t.trim()).filter(t => t));
    } else {
      void updateSpecField(activeSection, newContent);
    }
    
    // Clear selected text
    setSelectedText('');
  }, [activeSection, updateSpecField]);

  const value: CharacterEditorContextValue = {
    currentCharacter,
    activeSection,
    isDirty,
    saveStatus,
    fontSize,
    selectedText,
    contextSectionIds,
    userAddedContextIds,
    aiConfig,
    samplerSettings,
    promptSettings,
    isHistoryOpen,
    snapshotMetadata,
    isSnapshotsLoading,
    setActiveSection,
    updateCharacter,
    updateSpecField,
    setFontSize,
    setSelectedText,
    setContextSectionIds: setContextSectionIdsCallback,
    addContextSection,
    removeContextSection,
    updateAIConfig,
    updateSamplerSettings,
    updatePromptSettings,
    setIsHistoryOpen,
    createManualSnapshot,
    refreshSnapshots,
    deleteSnapshot,
    restoreSnapshot,
    getSnapshotDiff,
    handleAIOperation,
    getContextContent,
    reloadSettings,
  };

  return (
    <CharacterEditorContext.Provider value={value}>
      {children}
    </CharacterEditorContext.Provider>
  );
}

// Named export for the provider
export { CharacterEditorProvider };
