/**
 * @fileoverview Load / save / validate settings draft for the panel.
 * @module components/settings/hooks/useSettingsDraft
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AIConfig,
  PromptModelBinding,
  PromptModelMap,
  PromptSettings,
  SamplerSettings,
} from '../../../db/characterTypes';
import {
  DEFAULT_SETTINGS,
  DEFAULT_SECTION_ORDER,
  DEFAULT_SPELLCHECK_SETTINGS,
  DEFAULT_MARKDOWN_IMAGE_OPEN_LINKS,
  DEFAULT_CHAT_PANEL,
  clampContextLength,
  normalizeDefaultChatPanel,
} from '../../../db/characterTypes';
import {
  characterSettingsService,
  persistableAIConfig,
} from '../../../services/CharacterSettingsService';
import { normalizeModelBinding, normalizePromptModelMap } from '../../../services/resolveOperationConfig';
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
    agentModel: undefined,
    showLuckyVortex: true,
    markdownImageOpenLinks: DEFAULT_MARKDOWN_IMAGE_OPEN_LINKS,
    defaultChatPanel: DEFAULT_CHAT_PANEL,
    spellcheckEnabled: DEFAULT_SPELLCHECK_SETTINGS.enabled,
    spellcheckLanguage: DEFAULT_SPELLCHECK_SETTINGS.language,
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hiddenSections: [],
  };
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

export function validatePromptModels(promptModels: PromptModelMap): string | null {
  const errors: string[] = [];
  for (const [key, binding] of Object.entries(promptModels)) {
    if (!binding) continue;
    if (!binding.baseUrl?.trim()) {
      errors.push(`${key}: model binding is missing an endpoint`);
    }
    if (!binding.modelId?.trim()) {
      errors.push(`${key}: model binding is missing a model ID`);
    }
  }
  return errors.length > 0 ? errors.join('\n') : null;
}

export function validateAgentModel(agentModel: PromptModelBinding | undefined): string | null {
  if (!agentModel) return null;
  if (!agentModel.baseUrl?.trim()) {
    return 'Agent: model binding is missing an endpoint';
  }
  if (!agentModel.modelId?.trim()) {
    return 'Agent: model binding is missing a model ID';
  }
  return null;
}

interface UseSettingsDraftOptions {
  isOpen: boolean;
  reloadSettings: () => Promise<void>;
  addToast: AddToast;
}

export function useSettingsDraft({ isOpen, reloadSettings, addToast }: UseSettingsDraftOptions) {
  const [draft, setDraft] = useState<SettingsDraft>(createDefaultDraft);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const mountedRef = useRef(true);

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
      try {
        const [config, sampler, prompts, promptModels, agentModel, fullSettings, secOrder, secHidden, spell] =
          await Promise.all([
            characterSettingsService.getAISettings(),
            characterSettingsService.getSamplerSettings(),
            characterSettingsService.getPromptSettings(),
            characterSettingsService.getPromptModels(),
            characterSettingsService.getAgentModel(),
            characterSettingsService.getSettings(),
            characterSettingsService.getSectionOrder(),
            characterSettingsService.getHiddenSections(),
            characterSettingsService.getSpellcheckSettings(),
          ]);

        if (cancelled || !mountedRef.current) return;

        setDraft({
          ai: mergeLoadedAIConfig(config),
          sampler: mergeLoadedSampler(sampler),
          prompts,
          promptModels,
          agentModel,
          showLuckyVortex: fullSettings.ui?.showLuckyVortex ?? true,
          markdownImageOpenLinks:
            fullSettings.ui?.markdownImageOpenLinks ?? DEFAULT_MARKDOWN_IMAGE_OPEN_LINKS,
          defaultChatPanel: normalizeDefaultChatPanel(fullSettings.ui?.defaultChatPanel),
          spellcheckEnabled: spell.enabled,
          spellcheckLanguage: spell.language,
          sectionOrder: secOrder,
          hiddenSections: secHidden,
        });
      } catch (err) {
        if (cancelled || !mountedRef.current) return;
        console.error('Failed to load settings:', err);
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
  }, [isOpen, addToast]);

  const save = useCallback(async () => {
    setIsSaving(true);

    const validationError = validatePrompts(draft.prompts);
    if (validationError) {
      addToast('error', validationError);
      setIsSaving(false);
      return;
    }

    const promptModelsError = validatePromptModels(draft.promptModels);
    if (promptModelsError) {
      addToast('error', promptModelsError);
      setIsSaving(false);
      return;
    }

    const agentModelError = validateAgentModel(draft.agentModel);
    if (agentModelError) {
      addToast('error', agentModelError);
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
      const promptModels = normalizePromptModelMap(draft.promptModels);
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
      );

      const currentSettings = await characterSettingsService.getSettings();
      await characterSettingsService.saveSettings({
        ...currentSettings,
        ui: {
          ...currentSettings.ui,
          showLuckyVortex: draft.showLuckyVortex,
          markdownImageOpenLinks: draft.markdownImageOpenLinks,
          defaultChatPanel: draft.defaultChatPanel,
        },
        sectionOrder: draft.sectionOrder,
        hiddenSections: draft.hiddenSections,
      });

      await characterSettingsService.saveSpellcheckSettings({
        enabled: draft.spellcheckEnabled,
        language: draft.spellcheckLanguage,
      });

      if (!mountedRef.current) return;
      await reloadSettings();
      if (!mountedRef.current) return;
      addToast('success', 'Settings saved successfully!');
    } catch {
      if (!mountedRef.current) return;
      addToast('error', 'Failed to save settings');
    } finally {
      if (mountedRef.current) setIsSaving(false);
    }
  }, [draft, reloadSettings, addToast]);

  const clearAISettings = useCallback(async () => {
    await characterSettingsService.clearAISettings();
    setDraft((prev) => ({
      ...prev,
      ai: {
        ...DEFAULT_SETTINGS.ai,
        lastCustomBaseUrl: '',
      },
    }));
  }, []);

  return {
    draft,
    setDraft,
    isLoading,
    isSaving,
    save,
    clearAISettings,
  };
}
