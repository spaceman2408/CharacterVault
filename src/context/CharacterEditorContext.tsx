/**
 * @fileoverview Character editor context provider component.
 * @module context/CharacterEditorContext
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Character, CharacterSection, SnapshotMetadata, SnapshotDiffEntry, CustomContextMeta } from '../db/characterTypes';
import type {
  SamplerSettings,
  AIConfig,
  PromptSettings,
  PromptModelBinding,
  PromptModelMap,
  SpellcheckSettings,
} from '../db/characterTypes';
import {
  DEFAULT_SETTINGS,
  DEFAULT_SECTION_ORDER,
  CHARACTER_SECTIONS,
  DEFAULT_SPELLCHECK_SETTINGS,
  DEFAULT_MARKDOWN_IMAGE_OPEN_LINKS,
  DEFAULT_REQUIRE_AGENT_REVIEW,
  EMPTY_CUSTOM_CONTEXT_META,
  normalizeDefaultChatPanel,
} from '../db/characterTypes';
import { applyModelBinding, normalizePromptModelMap } from '../services/resolveOperationConfig';
import type { SectionMeta } from '../db/characterTypes';
import { bindSpellcheckCallbacks } from '../editor/extensions/spellcheck';
import { useCharacterContext } from './useCharacterContext';
import { CharacterEditorContext, type CharacterEditorContextValue, type SaveStatus, type AIOperation, type ManualSnapshotResult } from './characterEditorContextTypes';
import { characterSettingsService } from '../services/CharacterSettingsService';
import { characterSnapshotService } from '../services/CharacterSnapshotService';
import {
  customContextService,
  formatCustomContextChunk,
} from '../services/CustomContextService';
import { lorebookAttachmentService } from '../services/LorebookAttachmentService';
import { loadSnapshotDiff, openHistoryAfterFlush } from '../services/historyLifecycle';
import { generateThumbnail } from '../utils/thumbnail';
import { registerPendingSaveDiscard } from '../utils/characterPendingSaveDiscard';

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
  const {
    currentCharacter,
    updateCharacter: updateCharacterBase,
    updateSpecField: updateSpecFieldBase,
    settings,
  } = useCharacterContext();
  const currentCharacterId = currentCharacter?.id ?? null;
  
  const [activeSection, setActiveSection] = useState<CharacterSection>('name');
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [fontSize, setFontSizeState] = useState(16);
  const [sectionOrder, setSectionOrder] = useState<CharacterSection[]>([...DEFAULT_SECTION_ORDER]);
  const [hiddenSections, setHiddenSections] = useState<CharacterSection[]>([]);
  const [spellcheck, setSpellcheckState] = useState<SpellcheckSettings>({ ...DEFAULT_SPELLCHECK_SETTINGS });
  const [markdownImageOpenLinks, setMarkdownImageOpenLinks] = useState(DEFAULT_MARKDOWN_IMAGE_OPEN_LINKS);
  const [defaultChatPanel, setDefaultChatPanel] = useState(() =>
    normalizeDefaultChatPanel(settings?.ui.defaultChatPanel),
  );
  const [requireAgentReview, setRequireAgentReview] = useState(
    () => settings?.ui.requireAgentReview ?? DEFAULT_REQUIRE_AGENT_REVIEW,
  );
  
  // AI-related state
  const [selectedText, setSelectedText] = useState('');
  /** User-selected AI context pins (global settings; not auto-tied to active section) */
  const [contextSectionIds, setContextSectionIdsState] = useState<CharacterSection[]>([]);
  /** Lightweight custom-context meta only (no body text in memory) */
  const [customContextMeta, setCustomContextMeta] = useState<CustomContextMeta>({
    ...EMPTY_CUSTOM_CONTEXT_META,
  });
  const [aiConfig, setAIConfig] = useState<AIConfig>(DEFAULT_SETTINGS.ai);
  const [samplerSettings, setSamplerSettings] = useState<SamplerSettings>(DEFAULT_SETTINGS.sampler);
  const [promptSettings, setPromptSettings] = useState<PromptSettings>(DEFAULT_SETTINGS.prompts);
  const [promptModels, setPromptModels] = useState<PromptModelMap>({});
  const [agentModel, setAgentModel] = useState<PromptModelBinding | undefined>(undefined);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isOpeningHistory, setIsOpeningHistory] = useState(false);
  const isOpeningHistoryRef = useRef(false);
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

  const discardPendingSaves = useCallback((characterId: string): void => {
    const prefix = `${characterId}:`;
    const rejection = new Error('Character deleted');
    for (const [requestKey, timerId] of updateCharacterSaveTimerRef.current.entries()) {
      if (!requestKey.startsWith(prefix)) continue;
      window.clearTimeout(timerId);
      updateCharacterSaveTimerRef.current.delete(requestKey);
      updateCharacterPendingInputRef.current.delete(requestKey);
      const resolvers = updateCharacterPendingResolversRef.current.get(requestKey);
      updateCharacterPendingResolversRef.current.delete(requestKey);
      resolvers?.reject.forEach(fn => fn(rejection));
    }
    for (const [requestKey, timerId] of specSaveTimerRef.current.entries()) {
      if (!requestKey.startsWith(prefix)) continue;
      window.clearTimeout(timerId);
      specSaveTimerRef.current.delete(requestKey);
      specPendingValueRef.current.delete(requestKey);
      const resolvers = specPendingResolversRef.current.get(requestKey);
      specPendingResolversRef.current.delete(requestKey);
      resolvers?.reject.forEach(fn => fn(rejection));
    }
  }, []);

  useEffect(() => registerPendingSaveDiscard(discardPendingSaves), [discardPendingSaves]);

  /**
   * Visible sections: sectionOrder minus hiddenSections.
   * Any new sections not in sectionOrder are appended.
   */
  const visibleSections = React.useMemo<SectionMeta[]>(() => {
    const visible = sectionOrder.filter(id => !hiddenSections.includes(id));
    return visible
      .map(id => CHARACTER_SECTIONS.find(s => s.id === id))
      .filter((s): s is SectionMeta => s !== undefined);
  }, [sectionOrder, hiddenSections]);

  // Function to reload settings from database
  const reloadSettings = useCallback(async () => {
    try {
      const [config, sampler, prompts, models, agentBinding, settings, secOrder, secHidden, spell, contextIds] = await Promise.all([
        characterSettingsService.getAISettings(),
        characterSettingsService.getSamplerSettings(),
        characterSettingsService.getPromptSettings(),
        characterSettingsService.getPromptModels(),
        characterSettingsService.getAgentModel(),
        characterSettingsService.getSettings(),
        characterSettingsService.getSectionOrder(),
        characterSettingsService.getHiddenSections(),
        characterSettingsService.getSpellcheckSettings(),
        characterSettingsService.getContextSectionIds(),
      ]);
      setAIConfig(config);
      setSamplerSettings(sampler);
      setPromptSettings(prompts);
      setPromptModels(models);
      setAgentModel(agentBinding);
      setFontSizeState(settings.ui.editorFontSize);
      setSectionOrder(secOrder);
      setHiddenSections(secHidden);
      setSpellcheckState(spell);
      setMarkdownImageOpenLinks(
        settings.ui.markdownImageOpenLinks ?? DEFAULT_MARKDOWN_IMAGE_OPEN_LINKS,
      );
      setDefaultChatPanel(normalizeDefaultChatPanel(settings.ui.defaultChatPanel));
      setRequireAgentReview(settings.ui.requireAgentReview ?? DEFAULT_REQUIRE_AGENT_REVIEW);
      setContextSectionIdsState(contextIds);
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
      setCustomContextMeta({ ...EMPTY_CUSTOM_CONTEXT_META });
      // Clear all editor state to free memory
      setActiveSection('name');
      setIsDirty(false);
      setSaveStatus('saved');
      setSelectedText('');
      // Context pins are global settings — leave them so they restore for the next character
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
    // Load custom-context meta only (no body) for the newly opened character
    setCustomContextMeta({ ...EMPTY_CUSTOM_CONTEXT_META });
    void customContextService.getMeta(currentCharacterId).then((meta) => {
      if (openedCharacterIdRef.current === currentCharacterId) {
        setCustomContextMeta(meta);
      }
    });
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
   * Update spellcheck settings (merged with current values).
   */
  const updateSpellcheck = useCallback((updates: Partial<SpellcheckSettings>) => {
    setSpellcheckState((prev) => {
      const next: SpellcheckSettings = {
        ...DEFAULT_SPELLCHECK_SETTINGS,
        ...prev,
        ...updates,
        ignoredWords: updates.ignoredWords ?? prev.ignoredWords,
        customWords: updates.customWords ?? prev.customWords,
      };
      void characterSettingsService.saveSpellcheckSettings(updates);
      return next;
    });
  }, []);

  const addIgnoredWord = useCallback(async (word: string) => {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) return;
    setSpellcheckState((prev) => {
      if (prev.ignoredWords.includes(trimmed)) return prev;
      const next = { ...prev, ignoredWords: [...prev.ignoredWords, trimmed] };
      void characterSettingsService.addIgnoredWord(trimmed);
      return next;
    });
  }, []);

  const addCustomWord = useCallback(async (word: string) => {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) return;
    setSpellcheckState((prev) => {
      if (prev.customWords.includes(trimmed)) return prev;
      const next = { ...prev, customWords: [...prev.customWords, trimmed] };
      void characterSettingsService.addCustomWord(trimmed);
      return next;
    });
  }, []);

  // Bind spellcheck callbacks so the editor's tooltip can push ignore/add
  // actions back into context state without a one-off prop chain per editor.
  useEffect(() => {
    void bindSpellcheckCallbacks({
      ignoreWord: (word) => {
        void addIgnoredWord(word);
      },
      addWord: (word) => {
        void addCustomWord(word);
      },
    });
  }, [addIgnoredWord, addCustomWord]);

  /**
   * Update section order and/or hidden sections (local state only; persisted on Settings Save)
   */
  const updateSectionLayout = useCallback((updates: {
    sectionOrder?: CharacterSection[];
    hiddenSections?: CharacterSection[];
  }) => {
    if (updates.sectionOrder !== undefined) {
      setSectionOrder(updates.sectionOrder);
    }
    if (updates.hiddenSections !== undefined) {
      setHiddenSections(updates.hiddenSections);
    }
  }, []);

  /**
   * Reset section layout to defaults (local state only; persisted on Settings Save)
   */
  const resetSectionLayoutLocal = useCallback(() => {
    setSectionOrder([...DEFAULT_SECTION_ORDER]);
    setHiddenSections([]);
  }, []);

  /**
   * Replace the full AI context selection (user-driven; not tied to active section)
   */
  const setContextSectionIdsCallback = useCallback((ids: CharacterSection[] | ((prev: CharacterSection[]) => CharacterSection[])) => {
    setContextSectionIdsState(prev => {
      const newIds = typeof ids === 'function' ? ids(prev) : ids;
      const unique = [...new Set(newIds)];
      void characterSettingsService.saveContextSectionIds(unique);
      return unique;
    });
  }, []);

  /**
   * Add a section to AI context
   */
  const addContextSection = useCallback((sectionId: CharacterSection) => {
    setContextSectionIdsState(prev => {
      if (prev.includes(sectionId)) return prev;
      const newIds = [...prev, sectionId];
      void characterSettingsService.addContextSection(sectionId);
      return newIds;
    });
  }, []);

  /**
   * Remove a section from AI context
   */
  const removeContextSection = useCallback((sectionId: CharacterSection) => {
    setContextSectionIdsState(prev => {
      if (!prev.includes(sectionId)) return prev;
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

  /**
   * Update per-operation model routing
   */
  const updatePromptModels = useCallback((next: PromptModelMap) => {
    const normalized = normalizePromptModelMap(next);
    setPromptModels(normalized);
    void characterSettingsService.savePromptModels(normalized);
  }, []);

  const agentAiConfig = useMemo(
    () => applyModelBinding(aiConfig, agentModel),
    [aiConfig, agentModel],
  );

  const createManualSnapshot = useCallback(async (): Promise<ManualSnapshotResult> => {
    const character = currentCharacterRef.current;
    if (!character) {
      return 'skipped';
    }

    const latestCharacter = await flushPendingSaves();
    const snapshot = await createSnapshotFromCharacter(latestCharacter ?? character, 'manual');
    return snapshot ? 'created' : 'skipped';
  }, [createSnapshotFromCharacter, flushPendingSaves]);

  const openHistory = useCallback(async (): Promise<boolean> => {
    return openHistoryAfterFlush({
      flush: flushPendingSaves,
      setOpen: setIsHistoryOpen,
      isOpening: isOpeningHistoryRef.current,
      setIsOpening: (busy) => {
        isOpeningHistoryRef.current = busy;
        setIsOpeningHistory(busy);
      },
    });
  }, [flushPendingSaves]);

  const getSnapshotDiff = useCallback(async (snapshotId: string) => {
    const character = currentCharacterRef.current;
    if (!character) {
      return { snapshot: null, entries: [] as SnapshotDiffEntry[] };
    }

    return loadSnapshotDiff(snapshotId, character, characterSnapshotService);
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

  const updateBaselineSnapshot = useCallback(async (snapshotId: string) => {
    const character = currentCharacterRef.current;
    if (!character) {
      return;
    }

    // Validate the target is actually the baseline ('open') snapshot.
    const target = snapshotMetadata.find(meta => meta.id === snapshotId);
    if (!target || target.source !== 'open') {
      return;
    }

    setSaveStatus('saving');

    try {
      const latestCharacter = await flushPendingSaves();
      await characterSnapshotService.overwriteSnapshot(snapshotId, latestCharacter ?? character);
      await refreshSnapshotsForCharacter(character.id);
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to update baseline snapshot:', error);
      setSaveStatus('error');
      throw error;
    }
  }, [flushPendingSaves, refreshSnapshotsForCharacter, snapshotMetadata]);

  /**
   * Get context content for AI from selected sections.
   *
   * Lorebook and alternate greetings are emitted as **multiple chunks** (one
   * per entry/greeting) so AIService can fit a prefix of them into the budget
   * instead of all-or-nothing dropping a 100k+ blob.
   */
  const getContextContent = useCallback((sectionIds: CharacterSection[]): string[] => {
    const character = currentCharacterRef.current;
    if (!character) return [];

    const chunks: string[] = [];
    const push = (content: string) => {
      if (content && content.trim().length > 0) chunks.push(content);
    };

    for (const sectionId of sectionIds) {
      const spec = character.data.spec;
      switch (sectionId) {
        case 'name':
          push(`Character Name: ${spec.name}`);
          break;
        case 'description':
          push(`Description:\n${spec.description}`);
          break;
        case 'personality':
          push(`Personality:\n${spec.personality}`);
          break;
        case 'scenario':
          push(`Scenario:\n${spec.scenario}`);
          break;
        case 'first_mes':
          push(`First Message:\n${spec.first_mes}`);
          break;
        case 'mes_example':
          push(`Message Examples:\n${spec.mes_example}`);
          break;
        case 'system_prompt':
          push(`System Prompt:\n${spec.system_prompt}`);
          break;
        case 'post_history_instructions':
          push(`Post-History Instructions:\n${spec.post_history_instructions}`);
          break;
        case 'alternate_greetings': {
          const greetings = spec.alternate_greetings ?? [];
          const nonEmpty = greetings.filter((g) => g && g.trim().length > 0);
          if (nonEmpty.length === 0) break;
          // Separate chunks so a long greeting list can partially fit
          push('Alternate Greetings:');
          nonEmpty.forEach((greeting, index) => {
            push(`Greeting ${index + 1}:\n${greeting}`);
          });
          break;
        }
        case 'physical_description':
          push(`Physical Description:\n${spec.physical_description}`);
          break;
        case 'avatar':
          if (spec.avatar) push(`Avatar URL: ${spec.avatar}`);
          break;
        case 'creator_notes':
          if (spec.creator_notes) push(`Creator Notes:\n${spec.creator_notes}`);
          break;
        case 'creator':
          if (spec.creator) push(`Creator: ${spec.creator}`);
          break;
        case 'character_version':
          if (spec.character_version) push(`Version: ${spec.character_version}`);
          break;
        case 'tags':
          if (spec.tags?.length) push(`Tags: ${spec.tags.join(', ')}`);
          break;
        case 'lorebook': {
          const book = character.data.characterBook;
          if (!book || book.entries.length === 0) break;

          const enabledEntries = book.entries.filter(
            (e) => e.enabled && e.extensions?.context_enabled !== false
          );
          if (enabledEntries.length === 0) break;

          // Header as its own small chunk, then one chunk per entry
          let header = `Lorebook: ${book.name || 'Character Lore'}`;
          if (book.description) header += `\n${book.description}`;
          push(header);

          for (const entry of enabledEntries) {
            let block = `[Entry ${entry.id}]`;
            if (entry.name) block += ` ${entry.name}`;
            block += '\n';
            block += `Keys: ${entry.keys.join(', ')}\n`;
            if (entry.comment) block += `Note: ${entry.comment}\n`;
            block += entry.content;
            push(block);
          }
          break;
        }
        default:
          break;
      }
    }

    return chunks;
  }, []);

  /**
   * Section chunks + enabled custom context (body loaded from IDB ephemerally).
   */
  const resolveContextForAI = useCallback(async (sectionIds: CharacterSection[]): Promise<string[]> => {
    const chunks = getContextContent(sectionIds);
    const characterId = currentCharacterRef.current?.id;
    if (!characterId) return chunks;

    try {
      // Body is loaded only for this request; callers should drop the array after use
      const customBody = await customContextService.getEnabledContent(characterId);
      if (customBody) {
        chunks.push(formatCustomContextChunk(customBody));
      }
    } catch (error) {
      console.error('Failed to load custom context for AI:', error);
    }

    // Include vault-local attached standalone lorebooks when lorebook context is selected
    if (sectionIds.includes('lorebook')) {
      try {
        const attached = await lorebookAttachmentService.loadAttachedBooks(characterId);
        for (const vaultBook of attached) {
          const book = vaultBook.book;
          const enabledEntries = (book.entries || []).filter(
            (e) => e.enabled && e.extensions?.context_enabled !== false,
          );
          if (enabledEntries.length === 0) continue;
          let header = `Attached Lorebook: ${book.name || vaultBook.name || 'World Info'}`;
          if (book.description) header += `\n${book.description}`;
          chunks.push(header);
          for (const entry of enabledEntries) {
            let block = `[Entry ${entry.id}]`;
            if (entry.comment || entry.name) block += ` ${entry.comment || entry.name}`;
            block += '\n';
            block += `Keys: ${(entry.keys || []).join(', ')}\n`;
            block += entry.content || '';
            chunks.push(block);
          }
        }
      } catch (error) {
        console.error('Failed to load attached lorebooks for AI:', error);
      }
    }

    return chunks;
  }, [getContextContent]);

  const setCustomContextEnabled = useCallback(async (enabled: boolean): Promise<void> => {
    const characterId = currentCharacterRef.current?.id;
    if (!characterId) return;

    // Optimistic meta update avoids loading the body just to flip a flag
    setCustomContextMeta((prev) => {
      if (prev.charLength === 0) return prev;
      return {
        ...prev,
        enabled,
        updatedAt: new Date().toISOString(),
      };
    });

    try {
      const updated = await customContextService.setEnabled(characterId, enabled);
      if (!updated && openedCharacterIdRef.current === characterId) {
        setCustomContextMeta({ ...EMPTY_CUSTOM_CONTEXT_META });
      }
    } catch (error) {
      console.error('Failed to update custom context enabled flag:', error);
      if (openedCharacterIdRef.current === characterId) {
        setCustomContextMeta((prev) => {
          if (prev.charLength === 0) return prev;
          return { ...prev, enabled: !enabled };
        });
      }
      throw error;
    }
  }, []);

  const saveCustomContext = useCallback(async (input: {
    content: string;
    enabled: boolean;
  }): Promise<void> => {
    const characterId = currentCharacterRef.current?.id;
    if (!characterId) return;
    try {
      const meta = await customContextService.save(characterId, input);
      if (openedCharacterIdRef.current === characterId) {
        setCustomContextMeta(meta);
      }
    } catch (error) {
      console.error('Failed to save custom context:', error);
      throw error;
    }
  }, []);

  const clearCustomContext = useCallback(async (): Promise<void> => {
    const characterId = currentCharacterRef.current?.id;
    if (!characterId) return;
    try {
      await customContextService.clear(characterId);
      if (openedCharacterIdRef.current === characterId) {
        setCustomContextMeta({ ...EMPTY_CUSTOM_CONTEXT_META });
      }
    } catch (error) {
      console.error('Failed to clear custom context:', error);
      throw error;
    }
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
    customContextMeta,
    aiConfig,
    samplerSettings,
    promptSettings,
    promptModels,
    agentModel,
    agentAiConfig,
    isHistoryOpen,
    isOpeningHistory,
    snapshotMetadata,
    isSnapshotsLoading,
    sectionOrder,
    hiddenSections,
    visibleSections,
    spellcheck,
    markdownImageOpenLinks,
    defaultChatPanel,
    requireAgentReview,
    setActiveSection,
    updateCharacter,
    updateSpecField,
    flushPendingSaves,
    setFontSize,
    setSelectedText,
    setContextSectionIds: setContextSectionIdsCallback,
    addContextSection,
    removeContextSection,
    setCustomContextEnabled,
    saveCustomContext,
    clearCustomContext,
    updateAIConfig,
    updateSamplerSettings,
    updatePromptSettings,
    updatePromptModels,
    updateSpellcheck,
    addIgnoredWord,
    addCustomWord,
    setIsHistoryOpen,
    openHistory,
    createManualSnapshot,
    refreshSnapshots,
    deleteSnapshot,
    restoreSnapshot,
    updateBaselineSnapshot,
    getSnapshotDiff,
    handleAIOperation,
    getContextContent,
    resolveContextForAI,
    reloadSettings,
    updateSectionLayout,
    resetSectionLayoutLocal,
  };

  return (
    <CharacterEditorContext.Provider value={value}>
      {children}
    </CharacterEditorContext.Provider>
  );
}

// Named export for the provider
export { CharacterEditorProvider };
