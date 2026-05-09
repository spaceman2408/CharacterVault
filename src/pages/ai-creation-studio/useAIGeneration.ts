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
  reloadConfig: () => Promise<void>;
  updateGeneratedField: (field: GenerationField, value: string) => void;
}

export function useAIGeneration(): UseAIGenerationResult {
  const [state, setState] = useState<GenerationState>(INITIAL_STATE);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [concept, setConcept] = useState('');

  const aiServiceRef = useRef<AIService | null>(null);
  const configRef = useRef<{ config: AIConfig; sampler: SamplerSettings } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadConfig = useCallback(async (): Promise<boolean> => {
    try {
      const [config, sampler] = await Promise.all([
        characterSettingsService.getAISettings(),
        characterSettingsService.getSamplerSettings(),
      ]);

      const hasConfig = !!(config.apiKey && config.baseUrl && config.modelId);
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

      // Create a local abort controller for this field generation
      abortControllerRef.current = new AbortController();

      let accumulatedContent = '';

      const response = await service.chat(
        messages,
        undefined,
        (chunk: { content?: string; reasoning?: string }) => {
          if (chunk.content) {
            accumulatedContent += chunk.content;
            setState((prev) => ({
              ...prev,
              generatedData: { ...prev.generatedData, [field]: accumulatedContent },
            }));
          }
        }
      );

      return response.content || '';
    },
    [buildMessages]
  );

  const start = useCallback(
    async (newConcept: string) => {
      if (!newConcept.trim()) return;

      const trimmedConcept = newConcept.trim();
      setConcept(trimmedConcept);

      const hasConfig = await loadConfig();
      if (!hasConfig) {
        setState({
          ...INITIAL_STATE,
          status: 'error',
          error: 'AI is not configured. Please configure your AI settings first.',
        });
        return;
      }

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
          if (abortControllerRef.current?.signal.aborted) {
            throw new AIError('Request was cancelled', 'unknown');
          }

          setState((prev) => ({
            ...prev,
            currentField: field,
            generatedData: { ...generatedData },
          }));

          const result = await generateField(field, trimmedConcept, generatedData);
          generatedData[field] = result;

          setState((prev) => ({
            ...prev,
            completedFields: [...prev.completedFields, field],
            generatedData: { ...generatedData },
          }));
        }

        setState((prev) => ({
          ...prev,
          status: 'complete',
          currentField: null,
        }));
      } catch (err) {
        const errorMessage =
          err instanceof AIError ? err.message : 'An unexpected error occurred during generation';

        setState((prev) => ({
          ...prev,
          status: 'error',
          error: errorMessage,
          failedField: prev.currentField,
          currentField: null,
        }));
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [loadConfig, generateField]
  );

  const abort = useCallback(() => {
    if (aiServiceRef.current) {
      aiServiceRef.current.abort();
    }
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setState((prev) => ({
      ...prev,
      status: prev.completedFields.length > 0 ? 'error' : 'idle',
      currentField: null,
      error: 'Generation aborted by user.',
    }));
  }, []);

  const retryField = useCallback(
    async (field: GenerationField) => {
      const hasConfig = await loadConfig();
      if (!hasConfig) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'AI is not configured. Please configure your AI settings first.',
        }));
        return;
      }

      setIsLoading(true);
      setState((prev) => ({
        ...prev,
        status: 'generating',
        currentField: field,
        error: null,
        failedField: null,
      }));

      try {
        const effectiveConcept = concept || state.generatedData.name || 'Character';
        const result = await generateField(field, effectiveConcept, state.generatedData);

        setState((prev) => ({
          ...prev,
          status: 'complete',
          currentField: null,
          generatedData: { ...prev.generatedData, [field]: result },
          completedFields: Array.from(new Set([...prev.completedFields, field])),
          error: null,
          failedField: null,
        }));
      } catch (err) {
        const errorMessage =
          err instanceof AIError ? err.message : 'An unexpected error occurred during generation';

        setState((prev) => ({
          ...prev,
          status: 'error',
          error: errorMessage,
          failedField: field,
          currentField: null,
        }));
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [loadConfig, generateField, state.generatedData, concept]
  );

  const updateGeneratedField = useCallback((field: GenerationField, value: string) => {
    setState((prev) => ({
      ...prev,
      generatedData: { ...prev.generatedData, [field]: value },
    }));
  }, []);

  return {
    state,
    isConfigured,
    isLoading,
    concept,
    start,
    abort,
    retryField,
    reloadConfig,
    updateGeneratedField,
  };
}
