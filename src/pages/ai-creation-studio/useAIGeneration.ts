/**
 * @fileoverview Hook for AI character generation
 * @module @pages/ai-creation-studio/useAIGeneration
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { AIService, AIError } from '../../services/AIService';
import { characterSettingsService } from '../../services/CharacterSettingsService';
import type { AIConfig, SamplerSettings, StudioPrompts, StudioSettings } from '../../db/characterTypes';
import { DEFAULT_STUDIO_SETTINGS, normalizeStudioSettings } from '../../db/characterTypes';
import type { CharacterSpec } from '../../db/characterTypes';
import type { GenerationField, GenerationState } from './types';
import type { GenerationStyleTags } from './tags/tagData';
import {
  buildDescriptionStyleInstructions,
  buildGenerationStyleInstructions,
  buildNarrationFormatInstruction,
  renderStudioTemplate,
} from './generationPrompts';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const FIELD_ORDER: GenerationField[] = ['name', 'description', 'first_mes', 'mes_example'];

function isEnabledField(
  enabled: StudioSettings['enabledFields'],
  field: GenerationField
): boolean {
  return enabled[field] !== false;
}

const INITIAL_STATE: GenerationState = {
  status: 'idle',
  currentField: null,
  completedFields: [],
  generatedData: {},
  generatedReasoning: {},
  error: null,
  failedField: null,
};

export interface UseAIGenerationResult {
  state: GenerationState;
  isConfigured: boolean;
  isLoading: boolean;
  concept: string;
  generationTags: GenerationStyleTags;
  enabledFields: StudioSettings['enabledFields'];
  start: (concept: string, tags: GenerationStyleTags) => Promise<void>;
  abort: () => void;
  retryField: (field: GenerationField) => Promise<void>;
  regenerateField: (field: GenerationField) => Promise<void>;
  continueGeneration: () => Promise<void>;
  reloadConfig: () => Promise<void>;
  updateGeneratedField: (field: GenerationField, value: string) => void;
  reset: () => void;
}

export function useAIGeneration(): UseAIGenerationResult {
  const [state, setState] = useState<GenerationState>(INITIAL_STATE);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [concept, setConcept] = useState('');
  const [generationTags, setGenerationTags] = useState<GenerationStyleTags>({ perspective: null, tense: null });
  const [enabledFields, setEnabledFields] = useState<StudioSettings['enabledFields']>(
    DEFAULT_STUDIO_SETTINGS.enabledFields
  );
  const generationTagsRef = useRef<GenerationStyleTags>({ perspective: null, tense: null });
  const enabledFieldsRef = useRef<StudioSettings['enabledFields']>(DEFAULT_STUDIO_SETTINGS.enabledFields);
  const studioPromptsRef = useRef<StudioPrompts>({ ...DEFAULT_STUDIO_SETTINGS.prompts });

  const aiServiceRef = useRef<AIService | null>(null);
  const inFlightServiceRef = useRef<AIService | null>(null);
  const currentFieldRef = useRef<GenerationField | null>(null);
  const configRef = useRef<{ config: AIConfig; sampler: SamplerSettings } | null>(null);
  const stateRef = useRef<GenerationState>(state);
  const isAbortedRef = useRef<boolean>(false);
  stateRef.current = state;

  /** Cancel any in-flight request on the AIService and mark the current run as aborted. */
  const abortCurrent = useCallback(() => {
    isAbortedRef.current = true;
    inFlightServiceRef.current?.abort();
    aiServiceRef.current?.abort();
  }, []);

  const loadConfig = useCallback(async (): Promise<boolean> => {
    try {
      const [config, sampler, studio] = await Promise.all([
        characterSettingsService.getAISettings(),
        characterSettingsService.getSamplerSettings(),
        characterSettingsService.getStudioSettings(),
      ]);

      const normalizedStudio = normalizeStudioSettings(studio);
      enabledFieldsRef.current = normalizedStudio.enabledFields;
      setEnabledFields(normalizedStudio.enabledFields);
      studioPromptsRef.current = normalizedStudio.prompts;

      const currentField = currentFieldRef.current;
      if (currentField && !isEnabledField(enabledFieldsRef.current, currentField)) {
        inFlightServiceRef.current?.abort();
      }

      // For local endpoints (localhost, 127.0.0.1), API key is optional
      const isLocalEndpoint = config.baseUrl && (
        config.baseUrl.includes('localhost') ||
        config.baseUrl.includes('127.0.0.1') ||
        config.baseUrl.includes('0.0.0.0')
      );

      const hasConfig = !!(
        config.baseUrl && 
        config.modelId && 
        (config.apiKey || isLocalEndpoint)
      );
      setIsConfigured(hasConfig);

      if (hasConfig) {
        configRef.current = { config, sampler };
        aiServiceRef.current = new AIService(config, sampler);
      }

      return hasConfig;
    } catch (err) {
      console.error('[useAIGeneration] Failed to load config:', err);
      setIsConfigured(false);
      return false;
    }
  }, []);

  const reloadConfig = useCallback(async () => {
    await loadConfig();
  }, [loadConfig]);

  // Pre-check saved config on mount so `isConfigured` reflects reality immediately
  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  // Abort any in-flight generation when the hook unmounts (e.g. navigating away)
  useEffect(() => {
    return () => {
      abortCurrent();
    };
  }, [abortCurrent]);

  const buildMessages = useCallback(
    (field: GenerationField, concept: string, data: Partial<CharacterSpec>): ChatMessage[] => {
      const prompts = studioPromptsRef.current;
      const systemPrompt: ChatMessage = { role: 'system', content: prompts.system };
      const { perspective, tense } = generationTagsRef.current;
      const styleBlock = buildGenerationStyleInstructions(perspective, tense);
      const descriptionStyleBlock = buildDescriptionStyleInstructions(perspective, tense);
      const narrationRule = buildNarrationFormatInstruction(perspective);
      const name = data.name || '';
      const description = data.description || '';
      let userPrompt: string;

      switch (field) {
        case 'name':
          userPrompt = renderStudioTemplate(prompts.name, { concept });
          break;
        case 'description':
          userPrompt = renderStudioTemplate(prompts.description, {
            concept,
            name,
            styleBlock: descriptionStyleBlock,
          });
          break;
        case 'first_mes':
        case 'mes_example':
          userPrompt = renderStudioTemplate(prompts[field], {
            concept,
            name,
            description,
            styleBlock,
            narrationRule,
          });
          break;
        default:
          userPrompt = '';
      }

      return [systemPrompt, { role: 'user', content: userPrompt }];
    },
    [] // ref reads are always current — no dependency needed
  );

  const generateField = useCallback(
    async (
      field: GenerationField,
      concept: string,
      currentData: Partial<CharacterSpec>
    ): Promise<string> => {
      const service = aiServiceRef.current;
      if (!service) throw new Error('AI service not initialized');

      const messages = buildMessages(field, concept, currentData);

      let accumulatedContent = '';
      let accumulatedReasoning = '';
      inFlightServiceRef.current = service;

      try {
        const response = await service.chat(
          messages,
          undefined,
          (chunk: { content?: string; reasoning?: string }) => {
            if (isAbortedRef.current) return;
            if (!isEnabledField(enabledFieldsRef.current, field)) {
              service.abort();
              return;
            }

            if (chunk.content) {
              accumulatedContent += chunk.content;
            }
            if (chunk.reasoning) {
              accumulatedReasoning += chunk.reasoning;
            }

            setState((prev) => ({
              ...prev,
              generatedData: { ...prev.generatedData, [field]: accumulatedContent },
              generatedReasoning: { ...prev.generatedReasoning, [field]: accumulatedReasoning },
            }));
          }
        );

        if (!isEnabledField(enabledFieldsRef.current, field)) {
          throw new AIError('Request was cancelled', 'unknown');
        }

        const content = response.content || '';
        if (!content.trim()) {
          throw new AIError(
            `Generation returned empty content for "${field}". The model may have errored during generation.`,
            'unknown'
          );
        }

        return content;
      } catch (err) {
        const skipped = !isEnabledField(enabledFieldsRef.current, field);
        if (!isAbortedRef.current && !skipped) {
          setState((prev) => ({
            ...prev,
            failedField: field,
            generatedData: { ...prev.generatedData, [field]: undefined },
            generatedReasoning: { ...prev.generatedReasoning, [field]: undefined },
          }));
        }
        throw err;
      } finally {
        if (inFlightServiceRef.current === service) {
          inFlightServiceRef.current = null;
        }
      }
    },
    [buildMessages]
  );

  const discardFieldOutput = useCallback((
    generatedData: Partial<CharacterSpec>,
    field: GenerationField
  ) => {
    delete generatedData[field];
    setState((prev) => {
      const nextData = { ...prev.generatedData };
      const nextReasoning = { ...prev.generatedReasoning };
      delete nextData[field];
      delete nextReasoning[field];
      return {
        ...prev,
        generatedData: nextData,
        generatedReasoning: nextReasoning,
        completedFields: prev.completedFields.filter((f) => f !== field),
      };
    });
  }, []);

  const runFieldSequence = useCallback(
    async (
      fields: GenerationField[],
      generatedData: Partial<CharacterSpec>,
      trimmedConcept: string
    ) => {
      for (const field of fields) {
        if (isAbortedRef.current) {
          throw new AIError('Request was cancelled', 'unknown');
        }
        if (!isEnabledField(enabledFieldsRef.current, field)) {
          discardFieldOutput(generatedData, field);
          continue;
        }

        currentFieldRef.current = field;
        setState((prev) => ({
          ...prev,
          currentField: field,
          generatedData: { ...generatedData },
        }));

        try {
          const result = await generateField(field, trimmedConcept, generatedData);
          if (isAbortedRef.current) {
            throw new AIError('Request was cancelled', 'unknown');
          }
          if (!isEnabledField(enabledFieldsRef.current, field)) {
            discardFieldOutput(generatedData, field);
            continue;
          }

          generatedData[field] = result;
          setState((prev) => ({
            ...prev,
            completedFields: Array.from(new Set([...prev.completedFields, field])),
            generatedData: { ...generatedData },
          }));
        } catch (err) {
          if (isAbortedRef.current) {
            throw new AIError('Request was cancelled', 'unknown');
          }
          if (!isEnabledField(enabledFieldsRef.current, field)) {
            discardFieldOutput(generatedData, field);
            continue;
          }
          throw err;
        } finally {
          if (currentFieldRef.current === field) {
            currentFieldRef.current = null;
          }
        }
      }
    },
    [generateField, discardFieldOutput]
  );

  const start = useCallback(
    async (newConcept: string, tags: GenerationStyleTags) => {
      if (!newConcept.trim()) return;
      if (!tags.perspective || !tags.tense) {
        setState({
          ...INITIAL_STATE,
          status: 'error',
          error: 'Choose one perspective and one tense before generating.',
        });
        return;
      }

      const trimmedConcept = newConcept.trim();
      setConcept(trimmedConcept);

      generationTagsRef.current = tags;
      setGenerationTags(tags);

      // Cancel any in-flight request before starting a new one
      abortCurrent();

      const hasConfig = await loadConfig();
      if (!hasConfig) {
        setState({
          ...INITIAL_STATE,
          status: 'error',
          error: 'AI is not configured. Please configure your AI settings first.',
        });
        return;
      }

      isAbortedRef.current = false;
      setIsLoading(true);
      const activeFields = FIELD_ORDER.filter((f) => isEnabledField(enabledFieldsRef.current, f));
      setState({
        ...INITIAL_STATE,
        status: 'generating',
        currentField: activeFields[0] ?? null,
      });

      const generatedData: Partial<CharacterSpec> = {};

      try {
        await runFieldSequence(activeFields, generatedData, trimmedConcept);

        if (!isAbortedRef.current) {
          setState((prev) => ({
            ...prev,
            status: 'complete',
            currentField: null,
          }));
        }
      } catch (err) {
        if (!isAbortedRef.current) {
          const errorMessage =
            err instanceof AIError ? err.message : 'An unexpected error occurred during generation';

          setState((prev) => ({
            ...prev,
            status: 'error',
            error: errorMessage,
            failedField: prev.failedField ?? prev.currentField,
            currentField: null,
          }));
        }
      } finally {
        setIsLoading(false);
      }
    },
    [loadConfig, runFieldSequence, abortCurrent]
  );

  const abort = useCallback(() => {
    abortCurrent();
    currentFieldRef.current = null;
    setIsLoading(false);
    setState((prev) => ({
      ...prev,
      status: 'error',
      currentField: null,
      error: 'Generation stopped by user.',
    }));
  }, [abortCurrent]);

  const retryField = useCallback(
    async (field: GenerationField) => {
      // Cancel any in-flight request before starting a new one
      abortCurrent();

      const hasConfig = await loadConfig();
      if (!hasConfig) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'AI is not configured. Please configure your AI settings first.',
        }));
        return;
      }

      if (!isEnabledField(enabledFieldsRef.current, field)) {
        return;
      }

      isAbortedRef.current = false;
      setIsLoading(true);
      currentFieldRef.current = field;
      setState((prev) => ({
        ...prev,
        status: 'generating',
        currentField: field,
        error: null,
        failedField: null,
      }));

      try {
        const currentData = stateRef.current.generatedData;
        const effectiveConcept = concept || currentData.name || 'Character';
        const result = await generateField(field, effectiveConcept, currentData);

        if (isAbortedRef.current) return;
        if (!isEnabledField(enabledFieldsRef.current, field)) {
          discardFieldOutput({ ...stateRef.current.generatedData }, field);
          setState((prev) => ({ ...prev, currentField: null, status: 'complete' }));
          return;
        }

        if (!isAbortedRef.current) {
          setState((prev) => ({
            ...prev,
            status: 'complete',
            currentField: null,
            generatedData: { ...prev.generatedData, [field]: result },
            completedFields: Array.from(new Set([...prev.completedFields, field])),
            error: null,
            failedField: null,
          }));
        }
      } catch (err) {
        if (isAbortedRef.current) return;
        if (!isEnabledField(enabledFieldsRef.current, field)) {
          discardFieldOutput({ ...stateRef.current.generatedData }, field);
          setState((prev) => ({ ...prev, currentField: null, status: 'complete' }));
          return;
        }
        if (!isAbortedRef.current) {
          const errorMessage =
            err instanceof AIError ? err.message : 'An unexpected error occurred during generation';

          setState((prev) => ({
            ...prev,
            status: 'error',
            error: errorMessage,
            failedField: field,
            currentField: null,
          }));
        }
      } finally {
        if (currentFieldRef.current === field) currentFieldRef.current = null;
        setIsLoading(false);
      }
    },
    [loadConfig, generateField, concept, abortCurrent, discardFieldOutput]
  );

  const regenerateField = useCallback(
    async (field: GenerationField) => {
      // Cancel any in-flight request before starting a new one
      abortCurrent();

      const hasConfig = await loadConfig();
      if (!hasConfig) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'AI is not configured. Please configure your AI settings first.',
        }));
        return;
      }

      if (!isEnabledField(enabledFieldsRef.current, field)) {
        return;
      }

      isAbortedRef.current = false;
      setIsLoading(true);
      currentFieldRef.current = field;
      setState((prev) => ({
        ...prev,
        status: 'generating',
        currentField: field,
        error: null,
        failedField: null,
        completedFields: prev.completedFields.filter((f) => f !== field),
        generatedData: { ...prev.generatedData, [field]: undefined },
        generatedReasoning: { ...prev.generatedReasoning, [field]: undefined },
      }));

      try {
        const currentData = stateRef.current.generatedData;
        const effectiveConcept = concept || currentData.name || 'Character';
        const contextData = { ...currentData, [field]: undefined };
        const result = await generateField(field, effectiveConcept, contextData);

        if (isAbortedRef.current) return;
        if (!isEnabledField(enabledFieldsRef.current, field)) {
          discardFieldOutput({ ...stateRef.current.generatedData }, field);
          setState((prev) => ({ ...prev, currentField: null, status: 'complete' }));
          return;
        }

        if (!isAbortedRef.current) {
          setState((prev) => ({
            ...prev,
            status: 'complete',
            currentField: null,
            generatedData: { ...prev.generatedData, [field]: result },
            completedFields: Array.from(new Set([...prev.completedFields, field])),
            error: null,
            failedField: null,
          }));
        }
      } catch (err) {
        if (isAbortedRef.current) return;
        if (!isEnabledField(enabledFieldsRef.current, field)) {
          discardFieldOutput({ ...stateRef.current.generatedData }, field);
          setState((prev) => ({ ...prev, currentField: null, status: 'complete' }));
          return;
        }
        if (!isAbortedRef.current) {
          const errorMessage =
            err instanceof AIError ? err.message : 'An unexpected error occurred during generation';

          setState((prev) => ({
            ...prev,
            status: 'error',
            error: errorMessage,
            failedField: field,
            currentField: null,
          }));
        }
      } finally {
        if (currentFieldRef.current === field) currentFieldRef.current = null;
        setIsLoading(false);
      }
    },
    [loadConfig, generateField, concept, abortCurrent, discardFieldOutput]
  );

  const continueGeneration = useCallback(async () => {
    // Cancel any in-flight request before starting a new one
    abortCurrent();

    const hasConfig = await loadConfig();
    if (!hasConfig) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: 'AI is not configured. Please configure your AI settings first.',
      }));
      return;
    }

    const currentState = stateRef.current;
    const remaining = FIELD_ORDER.filter(
      (f) => isEnabledField(enabledFieldsRef.current, f) && !currentState.completedFields.includes(f)
    );
    if (remaining.length === 0) return;

    isAbortedRef.current = false;
    setIsLoading(true);
    setState((prev) => ({
      ...prev,
      status: 'generating',
      error: null,
      failedField: null,
    }));

    const generatedData: Partial<CharacterSpec> = { ...currentState.generatedData };
    const trimmedConcept = concept || currentState.generatedData.name || 'Character';

    try {
      await runFieldSequence(remaining, generatedData, trimmedConcept);

      if (!isAbortedRef.current) {
        setState((prev) => ({
          ...prev,
          status: 'complete',
          currentField: null,
        }));
      }
    } catch (err) {
      if (!isAbortedRef.current) {
        const errorMessage =
          err instanceof AIError ? err.message : 'An unexpected error occurred during generation';

        setState((prev) => ({
          ...prev,
          status: 'error',
          error: errorMessage,
          failedField: prev.failedField ?? prev.currentField,
          currentField: null,
        }));
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadConfig, runFieldSequence, concept, abortCurrent]);

  const updateGeneratedField = useCallback((field: GenerationField, value: string) => {
    setState((prev) => ({
      ...prev,
      generatedData: { ...prev.generatedData, [field]: value },
    }));
  }, []);

  const reset = useCallback(() => {
    abortCurrent();
    currentFieldRef.current = null;
    setState(INITIAL_STATE);
    setIsLoading(false);
    setConcept('');
    generationTagsRef.current = { perspective: null, tense: null };
    setGenerationTags({ perspective: null, tense: null });
  }, [abortCurrent]);

  return {
    state,
    isConfigured,
    isLoading,
    concept,
    generationTags,
    enabledFields,
    start,
    abort,
    retryField,
    regenerateField,
    continueGeneration,
    reloadConfig,
    updateGeneratedField,
    reset,
  };
}
