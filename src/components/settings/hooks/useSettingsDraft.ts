/**
 * @fileoverview Load / save / validate settings draft for the panel.
 * @module components/settings/hooks/useSettingsDraft
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { normalizeBaseUrl } from '../config/aiBaseUrlPresets';
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

  if (normalizedBaseUrl && merged.modelId) {
    merged.modelIdsByBaseUrl = {
      ...merged.modelIdsByBaseUrl,
      [normalizedBaseUrl]: merged.modelId,
    };
  }

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

interface UseSettingsDraftOptions {
  isOpen: boolean;
  reloadSettings: () => Promise<void>;
  addToast: AddToast;
}

export function useSettingsDraft({ isOpen, reloadSettings, addToast }: UseSettingsDraftOptions) {
  const [draft, setDraft] = useState<SettingsDraft>(createDefaultDraft);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [savedDraft, setSavedDraft] = useState<SettingsDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const mountedRef = useRef(true);
  const loadedContextRef = useRef<SettingsDraft['contextSectionIds']>([]);
  const loadedFavoritesRef = useRef<SettingsDraft['studioFavorites']>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  const save = useCallback(async () => {
    // The draft is defaults or stale until a load succeeds; saving it would overwrite real settings.
    if (isLoading || loadFailed) return;
    setIsSaving(true);

    const validationError = validatePrompts(draft.prompts);
    if (validationError) {
      addToast('error', validationError);
      setIsSaving(false);
      return;
    }

    const promptModelsError = validatePromptModels(draft.promptModels, draft.toolbar);
    if (promptModelsError) {
      addToast('error', promptModelsError);
      setIsSaving(false);
      return;
    }

    const toolbarError = validateToolbarConfig(draft.toolbar);
    if (toolbarError) {
      addToast('error', toolbarError);
      setIsSaving(false);
      return;
    }

    const agentModelError = validateAgentModel(draft.agentModel);
    if (agentModelError) {
      addToast('error', agentModelError);
      setIsSaving(false);
      return;
    }

    const studioPromptsError = validateStudioPrompts(draft.studio.prompts);
    if (studioPromptsError) {
      addToast('error', studioPromptsError);
      setIsSaving(false);
      return;
    }

    try {
      const clampedSampler: SamplerSettings = {
        ...draft.sampler,
        contextLength: clampContextLength(draft.sampler.contextLength),
        maxTokens: Math.min(draft.sampler.maxTokens, 8192),
      };

      const normalizedBaseUrl = normalizeBaseUrl(draft.ai.baseUrl);
      const toolbar = normalizeToolbarConfig(draft.toolbar);
      const promptModels = prunePromptModelsForToolbar(
        normalizePromptModelMap(draft.promptModels),
        toolbar,
      );
      const agentModel = normalizeModelBinding(draft.agentModel) ?? null;

      await characterSettingsService.saveAllAISettings(
        {
          ...draft.ai,
          apiKeysByBaseUrl: {
            ...(draft.ai.apiKeysByBaseUrl ?? {}),
            ...(normalizedBaseUrl && draft.ai.apiKey
              ? { [normalizedBaseUrl]: draft.ai.apiKey }
              : {}),
          },
          modelIdsByBaseUrl: {
            ...(draft.ai.modelIdsByBaseUrl ?? {}),
            ...(normalizedBaseUrl && draft.ai.modelId
              ? { [normalizedBaseUrl]: draft.ai.modelId }
              : {}),
          },
        },
        clampedSampler,
        draft.prompts,
        promptModels,
        agentModel,
        toolbar,
      );

      const currentSettings = await characterSettingsService.getSettings();
      const contextChanged =
        JSON.stringify(draft.contextSectionIds) !== JSON.stringify(loadedContextRef.current);
      await characterSettingsService.saveRoleplayHighlight(draft.roleplayHighlight);
      await characterSettingsService.saveMacroHighlight(draft.macroHighlight);
      await characterSettingsService.saveSettings({
        ...currentSettings,
        ui: {
          ...currentSettings.ui,
          showLuckyVortex: draft.showLuckyVortex,
          // The editor changes font size directly; only overwrite it when this draft changed it (backup import).
          ...(draft.editorFontSize !== savedDraft?.editorFontSize
            ? { editorFontSize: draft.editorFontSize }
            : {}),
          markdownImageOpenLinks: draft.markdownImageOpenLinks,
          defaultChatPanel: draft.defaultChatPanel,
          requireAgentReview: draft.requireAgentReview,
          creatorNotesRemoteWarning: draft.creatorNotesRemoteWarning,
          roleplayHighlight: normalizeRoleplayHighlight(draft.roleplayHighlight),
          macroHighlight: normalizeMacroHighlight(draft.macroHighlight),
          macroAutoConvert: draft.macroAutoConvert,
        },
        sectionOrder: draft.sectionOrder,
        hiddenSections: draft.hiddenSections,
        ...(contextChanged ? { contextSectionIds: draft.contextSectionIds } : {}),
        studio: normalizeStudioSettings(draft.studio),
      });
      if (contextChanged) loadedContextRef.current = [...draft.contextSectionIds];

      const favoritesChanged =
        JSON.stringify(draft.studioFavorites) !== JSON.stringify(loadedFavoritesRef.current);
      if (favoritesChanged) {
        loadedFavoritesRef.current = setFavoriteTags(draft.studioFavorites);
        notifyFavoritesChanged();
      }

      const storedSpell = await characterSettingsService.getSpellcheckSettings();
      await characterSettingsService.saveSpellcheckSettings({
        enabled: draft.spellcheckEnabled,
        language: draft.spellcheckLanguage,
        ignoredWords: [...new Set([...storedSpell.ignoredWords, ...draft.spellcheckIgnoredWords])],
        customWords: [...new Set([...storedSpell.customWords, ...draft.spellcheckCustomWords])],
      });

      if (!mountedRef.current) return;
      setSavedDraft(draft);
      await reloadSettings();
      if (!mountedRef.current) return;
      setLastSavedAt(Date.now());
      addToast('success', 'Settings saved successfully!');
    } catch {
      if (!mountedRef.current) return;
      addToast('error', 'Failed to save settings');
    } finally {
      if (mountedRef.current) setIsSaving(false);
    }
  }, [draft, savedDraft, isLoading, loadFailed, reloadSettings, addToast]);

  const clearAISettings = useCallback(async () => {
    await characterSettingsService.clearAISettings();
    const clearedAi: AIConfig = {
      ...DEFAULT_SETTINGS.ai,
      lastCustomBaseUrl: '',
    };
    setDraft((prev) => ({ ...prev, ai: clearedAi }));
    setSavedDraft((prev) => (prev ? { ...prev, ai: clearedAi } : prev));
  }, []);

  const isDirty = useMemo(
    () =>
      !isLoading &&
      !loadFailed &&
      savedDraft !== null &&
      draftFingerprint(draft) !== draftFingerprint(savedDraft),
    [draft, savedDraft, isLoading, loadFailed]
  );

  return {
    draft,
    setDraft,
    isLoading,
    loadFailed,
    retryLoad,
    isDirty,
    isSaving,
    lastSavedAt,
    save,
    clearAISettings,
  };
}
