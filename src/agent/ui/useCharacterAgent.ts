import { useCallback } from 'react';
import type {
  AIConfig,
  CharacterBook,
  CharacterSpec,
  PromptSettings,
  SamplerSettings,
} from '../../db/characterTypes';
import { createCharacterHost } from '../hosts/character/createHost';
import type { CharacterHostPersist } from '../hosts/character/createHost';
import { CHARACTER_LOOKUP_TOOLS } from './notices';
import { useAgentSession, type UseAgentSessionReturn } from './useAgentSession';

export interface UseCharacterAgentOptions {
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  getSpec: () => CharacterSpec;
  getBook: () => CharacterBook;
  persist: (update: CharacterHostPersist) => Promise<void>;
  getCustomContext: () => Promise<string | null>;
  flushDraft: () => void | Promise<void>;
  takeSnapshot: () => Promise<void>;
  onRunningChange?: (running: boolean) => void;
}

export type UseCharacterAgentReturn = UseAgentSessionReturn;

export function useCharacterAgent(options: UseCharacterAgentOptions): UseCharacterAgentReturn {
  const {
    aiConfig,
    samplerSettings,
    promptSettings,
    getSpec,
    getBook,
    persist,
    getCustomContext,
    flushDraft,
    takeSnapshot,
    onRunningChange,
  } = options;

  const createHost = useCallback(
    () =>
      createCharacterHost({
        getSpec,
        getBook,
        persist,
        getCustomContext,
        takeSnapshot,
      }),
    [getBook, getCustomContext, getSpec, persist, takeSnapshot],
  );

  return useAgentSession({
    aiConfig,
    samplerSettings,
    promptSettings,
    flushDraft,
    lookupToolNames: CHARACTER_LOOKUP_TOOLS,
    onRunningChange,
    createHost,
  });
}
