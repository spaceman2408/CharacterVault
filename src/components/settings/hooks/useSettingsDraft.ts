/**
 * @fileoverview Load / save / validate settings draft for the panel.
 * @module components/settings/hooks/useSettingsDraft
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  AIConfig,
  PromptModelBinding,
  PromptModelMap,
  PromptSettings,
  SamplerSettings,
  ToolbarConfig,
} from '../../../db/characterTypes';
import {
  DEFAULT_CHARACTER_VAULT_SETTINGS,
  DEFAULT_SETTINGS,
  DEFAULT_SECTION_ORDER,
  DEFAULT_SPELLCHECK_SETTINGS,
  DEFAULT_MARKDOWN_IMAGE_OPEN_LINKS,
  DEFAULT_CHAT_PANEL,
  DEFAULT_REQUIRE_AGENT_REVIEW,
  DEFAULT_AGENT_KEEP_EDITS,
  DEFAULT_AGENT_SKILLS_ENABLED,
  DEFAULT_CREATOR_NOTES_REMOTE_WARNING,
  DEFAULT_MACRO_AUTO_CONVERT,
  DEFAULT_MACRO_HIGHLIGHT_SETTINGS,
  DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS,
  DEFAULT_STUDIO_SETTINGS,
  normalizeMacroHighlight,
  normalizeRoleplayHighlight,
  normalizeStudioSettings,
  normalizeToolbarConfig,
  clampContextLength,
  normalizeDefaultChatPanel,
} from '../../../db/characterTypes';
import {
  cloneDefaultAgentSkills,
  isDefaultAgentSkills,
  resolveAgentSkills,
  validateAgentSkills,
} from '../../../services/agentSkills';
import {
  characterSettingsService,
  persistableAIConfig,
} from '../../../services/CharacterSettingsService';
import { normalizeModelBinding, normalizePromptModelMap } from '../../../services/resolveOperationConfig';
import {
  prunePromptModelsForToolbar,
  toolbarButtonLabel,
  validateToolbarConfig,
} from '../../../services/toolbarConfig';
import { validateStudioPrompts } from '../../../pages/ai-creation-studio/generationPrompts';
import {
  getFavoriteTags,
  notifyFavoritesChanged,
  setFavoriteTags,
} from '../../../pages/ai-creation-studio/tags/tagData';
import { normalizeBaseUrl, rememberModelForUrl } from '../config/aiBaseUrlPresets';
import type { AddToast, SettingsDraft } from '../types';

export function createDefaultDraft(): SettingsDraft {
  return {
    ai: {
      ...DEFAULT_SETTINGS.ai,
      lastCustomBaseUrl: '',
    },
    sampler: { ...DEFAULT_SETTINGS.sampler },
    prompts: { ...DEFAULT_SETTINGS.prompts },
    promptModels: {},
    toolbar: normalizeToolbarConfig(DEFAULT_SETTINGS.toolbar),
    agentModel: undefined,
    showLuckyVortex: true,
    editorFontSize: DEFAULT_CHARACTER_VAULT_SETTINGS.ui.editorFontSize,
    markdownImageOpenLinks: DEFAULT_MARKDOWN_IMAGE_OPEN_LINKS,
    defaultChatPanel: DEFAULT_CHAT_PANEL,
    requireAgentReview: DEFAULT_REQUIRE_AGENT_REVIEW,
    agentKeepEdits: DEFAULT_AGENT_KEEP_EDITS,
    agentSkillsEnabled: DEFAULT_AGENT_SKILLS_ENABLED,
    agentSkills: cloneDefaultAgentSkills(),
    creatorNotesRemoteWarning: DEFAULT_CREATOR_NOTES_REMOTE_WARNING,
    roleplayHighlight: { ...DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS },
    macroHighlight: { ...DEFAULT_MACRO_HIGHLIGHT_SETTINGS },
    macroAutoConvert: DEFAULT_MACRO_AUTO_CONVERT,
    spellcheckEnabled: DEFAULT_SPELLCHECK_SETTINGS.enabled,
    spellcheckLanguage: DEFAULT_SPELLCHECK_SETTINGS.language,
    spellcheckIgnoredWords: [],
    spellcheckCustomWords: [],
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hiddenSections: [],
    contextSectionIds: [],
    studioFavorites: [],
    studio: {
      enabledFields: { ...DEFAULT_STUDIO_SETTINGS.enabledFields },
      prompts: { ...DEFAULT_STUDIO_SETTINGS.prompts },
      tags: {
        hideNsfw: false,
        hiddenCategories: [],
        customTags: {},
      },
    },
  };
}

function sortObjectKeys(_key: string, value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
}

/** Comparable form of a draft; the model list is a fetched cache, not a setting. */
function draftFingerprint(draft: SettingsDraft): string {
  return JSON.stringify({ ...draft, ai: { ...draft.ai, availableModels: [] } }, sortObjectKeys);
}

function mergeLoadedAIConfig(config: AIConfig): AIConfig {
  const sanitized = persistableAIConfig(config);
  const merged: AIConfig = {
    ...sanitized,
    apiKeysByBaseUrl: { ...(sanitized.apiKeysByBaseUrl ?? {}) },
    modelIdsByBaseUrl: { ...(sanitized.modelIdsByBaseUrl ?? {}) },
    availableModels: [],
  };
  const normalizedBaseUrl = normalizeBaseUrl(merged.baseUrl);

  if (normalizedBaseUrl && merged.apiKey) {
    merged.apiKeysByBaseUrl = {
      ...merged.apiKeysByBaseUrl,
      [normalizedBaseUrl]: merged.apiKey,
    };
  }

  merged.modelIdsByBaseUrl = rememberModelForUrl(
    merged.modelIdsByBaseUrl,
    merged.customBaseUrlPresets,
    normalizedBaseUrl,
    merged.modelId,
  );

  return merged;
}

function mergeLoadedSampler(sampler: SamplerSettings): SamplerSettings {
  return {
    temperature: sampler?.temperature ?? DEFAULT_SETTINGS.sampler.temperature,
    minP: sampler?.minP ?? DEFAULT_SETTINGS.sampler.minP,
    topK: sampler?.topK ?? DEFAULT_SETTINGS.sampler.topK,
    repetitionPenalty: sampler?.repetitionPenalty ?? DEFAULT_SETTINGS.sampler.repetitionPenalty,
    topP: sampler?.topP ?? DEFAULT_SETTINGS.sampler.topP,
    contextLength: clampContextLength(
      sampler?.contextLength ?? DEFAULT_SETTINGS.sampler.contextLength
    ),
    maxTokens: Math.min(sampler?.maxTokens ?? DEFAULT_SETTINGS.sampler.maxTokens, 8192),
  };
}

export function validatePrompts(prompts: PromptSettings): string | null {
  const errors: string[] = [];

  if (!prompts.expand.includes('${text}')) {
    errors.push('Expand prompt must contain ${text}');
  }
  if (!prompts.rewrite.includes('${text}')) {
    errors.push('Rewrite prompt must contain ${text}');
  }
  if (!prompts.instruct.includes('${text}')) {
    errors.push('Instruct prompt must contain ${text}');
  }
  if (!prompts.instruct.includes('${instruction}')) {
    errors.push('Instruct prompt must contain ${instruction}');
  }

  const polishPrompts = ['shorten', 'lengthen', 'vivid', 'emotion', 'grammar'] as const;
  for (const promptType of polishPrompts) {
    if (!prompts[promptType].includes('${text}')) {
      errors.push(
        `${promptType.charAt(0).toUpperCase() + promptType.slice(1)} prompt must contain \${text}`
      );
    }
  }

  return errors.length > 0 ? errors.join('\n') : null;
}

function bindingError(name: string, binding: PromptModelBinding): string | null {
  if (!binding.baseUrl?.trim()) {
    return `${name}: model routing is missing an endpoint`;
  }
  if (!binding.modelId?.trim()) {
    return `${name}: choose a model, or set the endpoint back to Default`;
  }
  return null;
}

/** Only bindings that survive save-time pruning are checked, so a deleted button can't block Save. */
export function validatePromptModels(
  promptModels: PromptModelMap,
  toolbar: ToolbarConfig
): string | null {
  const normalized = normalizeToolbarConfig(toolbar);
  const errors: string[] = [];
  for (const [key, binding] of Object.entries(prunePromptModelsForToolbar(promptModels, normalized))) {
    if (!binding) continue;
    const error = bindingError(`${toolbarButtonLabel(key, normalized.customOps)} prompt`, binding);
    if (error) errors.push(error);
  }
  return errors.length > 0 ? errors.join('\n') : null;
}

export function validateAgentModel(agentModel: PromptModelBinding | undefined): string | null {
  return agentModel ? bindingError('Agent', agentModel) : null;
}

export function validateDraft(draft: SettingsDraft): string | null {
  return (
    validatePrompts(draft.prompts) ??
    validatePromptModels(draft.promptModels, draft.toolbar) ??
    validateToolbarConfig(draft.toolbar) ??
    validateAgentModel(draft.agentModel) ??
    validateAgentSkills(draft.agentSkills) ??
    validateStudioPrompts(draft.studio.prompts)
  );
}

const AUTOSAVE_DELAY_MS = 700;

interface UseSettingsDraftOptions {
  isOpen: boolean;
  reloadSettings: () => Promise<void>;
  addToast: AddToast;
  /** Textareas inside this element save on blur instead of on the debounce. */
  panelRef: React.RefObject<HTMLElement | null>;
}

export function useSettingsDraft({ isOpen, reloadSettings, addToast, panelRef }: UseSettingsDraftOptions) {
  const [draft, setDraft] = useState<SettingsDraft>(createDefaultDraft);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [savedDraft, setSavedDraft] = useState<SettingsDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  /** Tied to the draft it was raised for, so an edit hides it until the next save attempt. */
  const [saveError, setSaveError] = useState<{ fingerprint: string; message: string } | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const mountedRef = useRef(true);
  const loadedContextRef = useRef<SettingsDraft['contextSectionIds']>([]);
  const loadedFavoritesRef = useRef<SettingsDraft['studioFavorites']>([]);
  const draftRef = useRef(draft);
  const savedDraftRef = useRef(savedDraft);
  const readyRef = useRef(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useLayoutEffect(() => {
    savedDraftRef.current = savedDraft;
  }, [savedDraft]);

  useLayoutEffect(() => {
    readyRef.current = !isLoading && !loadFailed;
  }, [isLoading, loadFailed]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadSettings = async () => {
      setIsLoading(true);
      setLoadFailed(false);
      try {
        const [config, sampler, prompts, promptModels, toolbar, agentModel, fullSettings, secOrder, secHidden, spell, studio, contextIds, roleplayHighlight, macroHighlight] =
          await Promise.all([
            characterSettingsService.getAISettings(),
            characterSettingsService.getSamplerSettings(),
            characterSettingsService.getPromptSettings(),
            characterSettingsService.getPromptModels(),
            characterSettingsService.getToolbarConfig(),
            characterSettingsService.getAgentModel(),
            characterSettingsService.getSettings(),
            characterSettingsService.getSectionOrder(),
            characterSettingsService.getHiddenSections(),
            characterSettingsService.getSpellcheckSettings(),
            characterSettingsService.getStudioSettings(),
            characterSettingsService.getContextSectionIds(),
            characterSettingsService.getRoleplayHighlight(),
            characterSettingsService.getMacroHighlight(),
          ]);

        if (cancelled || !mountedRef.current) return;

        loadedContextRef.current = [...contextIds];
        loadedFavoritesRef.current = getFavoriteTags();

        const loaded: SettingsDraft = {
          ai: mergeLoadedAIConfig(config),
          sampler: mergeLoadedSampler(sampler),
          prompts,
          promptModels,
          toolbar,
          agentModel,
          showLuckyVortex: fullSettings.ui?.showLuckyVortex ?? true,
          editorFontSize:
            fullSettings.ui?.editorFontSize ?? DEFAULT_CHARACTER_VAULT_SETTINGS.ui.editorFontSize,
          markdownImageOpenLinks:
            fullSettings.ui?.markdownImageOpenLinks ?? DEFAULT_MARKDOWN_IMAGE_OPEN_LINKS,
          defaultChatPanel: normalizeDefaultChatPanel(fullSettings.ui?.defaultChatPanel),
          requireAgentReview:
            fullSettings.ui?.requireAgentReview ?? DEFAULT_REQUIRE_AGENT_REVIEW,
          agentKeepEdits: fullSettings.ui?.agentKeepEdits ?? DEFAULT_AGENT_KEEP_EDITS,
          agentSkillsEnabled: fullSettings.ui?.agentSkillsEnabled ?? DEFAULT_AGENT_SKILLS_ENABLED,
          agentSkills: resolveAgentSkills(fullSettings.agentSkills),
          creatorNotesRemoteWarning:
            fullSettings.ui?.creatorNotesRemoteWarning ?? DEFAULT_CREATOR_NOTES_REMOTE_WARNING,
          roleplayHighlight: normalizeRoleplayHighlight(roleplayHighlight),
          macroHighlight: normalizeMacroHighlight(macroHighlight),
          macroAutoConvert: fullSettings.ui?.macroAutoConvert ?? DEFAULT_MACRO_AUTO_CONVERT,
          spellcheckEnabled: spell.enabled,
          spellcheckLanguage: spell.language,
          spellcheckIgnoredWords: [...(spell.ignoredWords ?? [])],
          spellcheckCustomWords: [...(spell.customWords ?? [])],
          sectionOrder: secOrder,
          hiddenSections: secHidden,
          contextSectionIds: [...contextIds],
          studioFavorites: loadedFavoritesRef.current,
          studio: normalizeStudioSettings(studio),
        };
        setDraft(loaded);
        setSavedDraft(loaded);
        setSaveError(null);
        setLastSavedAt(null);
        setIsEditingText(false);
      } catch (err) {
        if (cancelled || !mountedRef.current) return;
        console.error('Failed to load settings:', err);
        setLoadFailed(true);
        addToast('error', 'Failed to load settings');
      } finally {
        if (!cancelled && mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [isOpen, addToast, loadAttempt]);

  const retryLoad = useCallback(() => setLoadAttempt((n) => n + 1), []);

  const persist = useCallback(async (target: SettingsDraft, previous: SettingsDraft) => {
    const clampedSampler: SamplerSettings = {
      ...target.sampler,
      contextLength: clampContextLength(target.sampler.contextLength),
      maxTokens: Math.min(target.sampler.maxTokens, 8192),
    };

    const normalizedBaseUrl = normalizeBaseUrl(target.ai.baseUrl);
    const toolbar = normalizeToolbarConfig(target.toolbar);
    const promptModels = prunePromptModelsForToolbar(
      normalizePromptModelMap(target.promptModels),
      toolbar,
    );
    const agentModel = normalizeModelBinding(target.agentModel) ?? null;

    await characterSettingsService.saveAllAISettings(
      {
        ...target.ai,
        apiKeysByBaseUrl: {
          ...(target.ai.apiKeysByBaseUrl ?? {}),
          ...(normalizedBaseUrl && target.ai.apiKey
            ? { [normalizedBaseUrl]: target.ai.apiKey }
            : {}),
        },
        modelIdsByBaseUrl: rememberModelForUrl(
          target.ai.modelIdsByBaseUrl,
          target.ai.customBaseUrlPresets,
          normalizedBaseUrl,
          target.ai.modelId,
        ),
      },
      clampedSampler,
      target.prompts,
      promptModels,
      agentModel,
      toolbar,
    );

    const currentSettings = await characterSettingsService.getSettings();
    const contextChanged =
      JSON.stringify(target.contextSectionIds) !== JSON.stringify(loadedContextRef.current);
    await characterSettingsService.saveRoleplayHighlight(target.roleplayHighlight);
    await characterSettingsService.saveMacroHighlight(target.macroHighlight);
    await characterSettingsService.saveSettings({
      ...currentSettings,
      ui: {
        ...currentSettings.ui,
        showLuckyVortex: target.showLuckyVortex,
        // The editor changes font size directly; only overwrite it when this draft changed it (backup import).
        ...(target.editorFontSize !== previous.editorFontSize
          ? { editorFontSize: target.editorFontSize }
          : {}),
        markdownImageOpenLinks: target.markdownImageOpenLinks,
        defaultChatPanel: target.defaultChatPanel,
        requireAgentReview: target.requireAgentReview,
        agentKeepEdits: target.agentKeepEdits,
        agentSkillsEnabled: target.agentSkillsEnabled,
        creatorNotesRemoteWarning: target.creatorNotesRemoteWarning,
        roleplayHighlight: normalizeRoleplayHighlight(target.roleplayHighlight),
        macroHighlight: normalizeMacroHighlight(target.macroHighlight),
        macroAutoConvert: target.macroAutoConvert,
      },
      sectionOrder: target.sectionOrder,
      hiddenSections: target.hiddenSections,
      ...(contextChanged ? { contextSectionIds: target.contextSectionIds } : {}),
      studio: normalizeStudioSettings(target.studio),
      agentSkills: isDefaultAgentSkills(target.agentSkills) ? undefined : target.agentSkills,
    });
    if (contextChanged) loadedContextRef.current = [...target.contextSectionIds];

    const favoritesChanged =
      JSON.stringify(target.studioFavorites) !== JSON.stringify(loadedFavoritesRef.current);
    if (favoritesChanged) {
      loadedFavoritesRef.current = setFavoriteTags(target.studioFavorites);
      notifyFavoritesChanged();
    }

    const storedSpell = await characterSettingsService.getSpellcheckSettings();
    await characterSettingsService.saveSpellcheckSettings({
      enabled: target.spellcheckEnabled,
      language: target.spellcheckLanguage,
      ignoredWords: [...new Set([...storedSpell.ignoredWords, ...target.spellcheckIgnoredWords])],
      customWords: [...new Set([...storedSpell.customWords, ...target.spellcheckCustomWords])],
    });

    await reloadSettings();
  }, [reloadSettings]);

  const runSave = useCallback(async () => {
    const target = draftRef.current;
    const previous = savedDraftRef.current;
    // The draft is defaults or stale until a load succeeds; saving it would overwrite real settings.
    if (!readyRef.current || !previous) return;
    const fingerprint = draftFingerprint(target);
    if (fingerprint === draftFingerprint(previous)) return;

    const validationError = validateDraft(target);
    if (validationError) {
      if (mountedRef.current) setSaveError({ fingerprint, message: validationError });
      return;
    }

    if (mountedRef.current) setIsSaving(true);
    try {
      await persist(target, previous);
      savedDraftRef.current = target;
      if (!mountedRef.current) return;
      setSavedDraft(target);
      setSaveError(null);
      setLastSavedAt(Date.now());
    } catch (err) {
      console.error('Failed to save settings:', err);
      if (mountedRef.current) {
        setSaveError({ fingerprint, message: 'Could not save settings. Your next change will try again.' });
      }
    } finally {
      if (mountedRef.current) setIsSaving(false);
    }
  }, [persist]);

  /** Queued so saves never overlap; each one reads the latest draft when it starts. */
  const saveNow = useCallback((): Promise<void> => {
    const next = saveQueueRef.current.then(runSave);
    saveQueueRef.current = next;
    return next;
  }, [runSave]);

  const isTextareaInPanel = useCallback(
    (el: EventTarget | null): el is HTMLTextAreaElement =>
      el instanceof HTMLTextAreaElement && !!panelRef.current?.contains(el),
    [panelRef]
  );

  const clearAISettings = useCallback(async () => {
    await characterSettingsService.clearAISettings();
    const clearedAi = (ai: AIConfig): AIConfig => ({
      ...DEFAULT_SETTINGS.ai,
      lastCustomBaseUrl: '',
      customBaseUrlPresets: ai.customBaseUrlPresets ?? [],
    });
    setDraft((prev) => ({ ...prev, ai: clearedAi(prev.ai) }));
    setSavedDraft((prev) => (prev ? { ...prev, ai: clearedAi(prev.ai) } : prev));
  }, []);

  const currentFingerprint = useMemo(() => draftFingerprint(draft), [draft]);
  const isDirty = useMemo(
    () =>
      !isLoading &&
      !loadFailed &&
      savedDraft !== null &&
      currentFingerprint !== draftFingerprint(savedDraft),
    [currentFingerprint, savedDraft, isLoading, loadFailed]
  );

  useEffect(() => {
    if (!isOpen || !isDirty) return;
    const timeoutId = window.setTimeout(() => {
      // Prompts save on blur so half-typed text never reaches storage or flashes an error.
      if (isTextareaInPanel(document.activeElement)) return;
      void saveNow();
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen, isDirty, draft, saveNow, isTextareaInPanel]);

  useEffect(() => {
    if (!isOpen) return;
    const handleFocusIn = (e: FocusEvent) => setIsEditingText(isTextareaInPanel(e.target));
    const handleFocusOut = (e: FocusEvent) => {
      if (!isTextareaInPanel(e.target)) return;
      setIsEditingText(false);
      void saveNow();
    };
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [isOpen, saveNow, isTextareaInPanel]);

  return {
    draft,
    setDraft,
    isLoading,
    loadFailed,
    retryLoad,
    isDirty,
    isSaving,
    isEditingText,
    saveError: isDirty && saveError?.fingerprint === currentFingerprint ? saveError.message : null,
    lastSavedAt,
    flush: saveNow,
    clearAISettings,
  };
}
