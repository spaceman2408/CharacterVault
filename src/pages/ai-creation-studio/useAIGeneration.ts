/**
 * @fileoverview Hook for AI character generation
 * @module @pages/ai-creation-studio/useAIGeneration
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { AIService, AIError } from '../../services/AIService';
import { characterSettingsService } from '../../services/CharacterSettingsService';
import type { AIConfig, SamplerSettings } from '../../db/types';
import type { CharacterSpec } from '../../db/characterTypes';
import type { GenerationField, GenerationState } from './types';
import {
  GENERATION_SYSTEM_PROMPT,
  buildNamePrompt,
  buildDescriptionPrompt,
  buildFirstMessagePrompt,
  buildExamplesPrompt,
} from './generationPrompts';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const FIELD_ORDER: GenerationField[] = ['name', 'description', 'first_mes', 'mes_example'];

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
  start: (concept: string) => Promise<void>;
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

  const aiServiceRef = useRef<AIService | null>(null);
  const configRef = useRef<{ config: AIConfig; sampler: SamplerSettings } | null>(null);
  const stateRef = useRef<GenerationState>(state);
  const isAbortedRef = useRef<boolean>(false);
  stateRef.current = state;

  /** Cancel any in-flight request on the AIService and mark the current run as aborted. */
  const abortCurrent = useCallback(() => {
    isAbortedRef.current = true;
    aiServiceRef.current?.abort();
  }, []);

  const loadConfig = useCallback(async (): Promise<boolean> => {
    try {
      const [config, sampler] = await Promise.all([
        characterSettingsService.getAISettings(),
        characterSettingsService.getSamplerSettings(),
      ]);

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
      const systemPrompt: ChatMessage = { role: 'system', content: GENERATION_SYSTEM_PROMPT };
      let userPrompt: string;

      switch (field) {
        case 'name':
          userPrompt = buildNamePrompt(concept);
          break;
        case 'description':
          userPrompt = buildDescriptionPrompt(concept, data.name || '');
          break;
        case 'first_mes':
          userPrompt = buildFirstMessagePrompt(
            concept,
            data.name || '',
            data.description || ''
          );
          break;
        case 'mes_example':
          userPrompt = buildExamplesPrompt(
            concept,
            data.name || '',
            data.description || ''
          );
          break;
        default:
          userPrompt = '';
      }

      return [systemPrompt, { role: 'user', content: userPrompt }];
    },
    []
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

      try {
        const response = await service.chat(
          messages,
          undefined,
          (chunk: { content?: string; reasoning?: string }) => {
            if (isAbortedRef.current) return;
            
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

        const content = response.content || '';
        if (!content.trim()) {
          throw new AIError(
            `Generation returned empty content for "${field}". The model may have errored during generation.`,
            'unknown'
          );
        }

        return content;
      } catch (err) {
        // Don't update state if aborted
        if (!isAbortedRef.current) {
          setState((prev) => ({
            ...prev,
            failedField: field,
            generatedData: { ...prev.generatedData, [field]: undefined },
            generatedReasoning: { ...prev.generatedReasoning, [field]: undefined },
          }));
        }
        throw err;
      }
    },
    [buildMessages]
  );

  const start = useCallback(
    async (newConcept: string) => {
      if (!newConcept.trim()) return;

      const trimmedConcept = newConcept.trim();
      setConcept(trimmedConcept);

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
      setState({
        ...INITIAL_STATE,
        status: 'generating',
        currentField: 'name',
      });

      const generatedData: Partial<CharacterSpec> = {};

      try {
        for (const field of FIELD_ORDER) {
          // Check if aborted
          if (isAbortedRef.current) {
            throw new AIError('Request was cancelled', 'unknown');
          }

          setState((prev) => ({
            ...prev,
            currentField: field,
            generatedData: { ...generatedData },
          }));

          const result = await generateField(field, trimmedConcept, generatedData);
          
          // Check again after async operation
          if (isAbortedRef.current) {
            throw new AIError('Request was cancelled', 'unknown');
          }
          
          generatedData[field] = result;

          setState((prev) => ({
            ...prev,
            completedFields: [...prev.completedFields, field],
            generatedData: { ...generatedData },
          }));
        }

        // Don't update to complete if aborted
        if (!isAbortedRef.current) {
          setState((prev) => ({
            ...prev,
            status: 'complete',
            currentField: null,
          }));
        }
      } catch (err) {
        // Don't update state if aborted
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
    [loadConfig, generateField, abortCurrent]
  );

  const abort = useCallback(() => {
    abortCurrent();
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

      isAbortedRef.current = false;
      setIsLoading(true);
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

        // Don't update state if aborted
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
        // Don't update state if aborted
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
        setIsLoading(false);
      }
    },
    [loadConfig, generateField, concept, abortCurrent]
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

      isAbortedRef.current = false;
      setIsLoading(true);
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

        // Don't update state if aborted
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
        // Don't update state if aborted
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
        setIsLoading(false);
      }
    },
    [loadConfig, generateField, concept, abortCurrent]
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
    const remaining = FIELD_ORDER.filter((f) => !currentState.completedFields.includes(f));
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
      for (const field of remaining) {
        if (isAbortedRef.current) {
          throw new AIError('Request was cancelled', 'unknown');
        }

        setState((prev) => ({
          ...prev,
          currentField: field,
          generatedData: { ...generatedData },
        }));

        const result = await generateField(field, trimmedConcept, generatedData);
        
        // Check again after async operation
        if (isAbortedRef.current) {
          throw new AIError('Request was cancelled', 'unknown');
        }
        
        generatedData[field] = result;

        setState((prev) => ({
          ...prev,
          completedFields: Array.from(new Set([...prev.completedFields, field])),
          generatedData: { ...generatedData },
        }));
      }

      // Don't update to complete if aborted
      if (!isAbortedRef.current) {
        setState((prev) => ({
          ...prev,
          status: 'complete',
          currentField: null,
        }));
      }
    } catch (err) {
      // Don't update state if aborted
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
  }, [loadConfig, generateField, concept, abortCurrent]);

  const updateGeneratedField = useCallback((field: GenerationField, value: string) => {
    setState((prev) => ({
      ...prev,
      generatedData: { ...prev.generatedData, [field]: value },
    }));
  }, []);

  const reset = useCallback(() => {
    abortCurrent();
    setState(INITIAL_STATE);
    setIsLoading(false);
    setConcept('');
  }, [abortCurrent]);

  return {
    state,
    isConfigured,
    isLoading,
    concept,
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
