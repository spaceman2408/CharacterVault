import { useCallback } from 'react';
import type {
  AIConfig,
  CharacterBook,
  ChatOwnerType,
  PromptSettings,
  SamplerSettings,
} from '../../db/characterTypes';
import { createLorebookHost } from '../hosts/lorebook/createHost';
import { LOREBOOK_LOOKUP_TOOLS } from './notices';
import {
  lastUserMessageIndex,
  useAgentSession,
  type UseAgentSessionReturn,
} from './useAgentSession';

export { lastUserMessageIndex };

export interface UseLorebookAgentOptions {
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  getBook: () => CharacterBook;
  setBook: (book: CharacterBook) => Promise<void>;
  getCustomContext: () => Promise<string | null>;
  flushDraft: () => void | Promise<void>;
  takeSnapshot: () => Promise<void>;
  onRunningChange?: (running: boolean) => void;
  chatOwnerType: ChatOwnerType;
  chatOwnerId: string;
}

export type UseLorebookAgentReturn = UseAgentSessionReturn;

export function useLorebookAgent(options: UseLorebookAgentOptions): UseLorebookAgentReturn {
  const {
    aiConfig,
    samplerSettings,
    promptSettings,
    getBook,
    setBook,
    getCustomContext,
    flushDraft,
    takeSnapshot,
    onRunningChange,
    chatOwnerType,
    chatOwnerId,
  } = options;

  const createHost = useCallback(
    () =>
      createLorebookHost({
        getBook,
        setBook,
        getCustomContext,
        takeSnapshot,
      }),
    [getBook, getCustomContext, setBook, takeSnapshot],
  );

  return useAgentSession({
    aiConfig,
    samplerSettings,
    promptSettings,
    flushDraft,
    lookupToolNames: LOREBOOK_LOOKUP_TOOLS,
    onRunningChange,
    createHost,
    chatOwnerType,
    chatOwnerId,
    chatPanel: 'agent',
  });
}
