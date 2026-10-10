import { useCallback } from 'react';
import type {
  AIConfig,
  CharacterBook,
  CharacterSpec,
  ChatOwnerType,
  PromptSettings,
  SamplerSettings,
} from '../../db/characterTypes';
import { createCharacterHost } from '../hosts/character/createHost';
import type { CharacterHostPersist } from '../hosts/character/createHost';
import { cloneSpec } from '../hosts/character/fields';
import { applyCharacterReview, defaultDecisions, diffCharacterReview } from '../review/diff';
import type { CharacterReviewPayload } from '../review/types';
import { CHARACTER_LOOKUP_TOOLS } from './notices';
import { useAgentSession, type UseAgentSessionReturn } from './useAgentSession';

/** Receives the latest saved card and returns what to write on top of it. */
export type PersistAgentCard = (
  build: (latest: { spec: CharacterSpec; book: CharacterBook }) => CharacterHostPersist,
) => Promise<void>;

export interface UseCharacterAgentOptions {
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  getSpec: () => CharacterSpec;
  getBook: () => CharacterBook;
  persist: PersistAgentCard;
  getCustomContext: () => Promise<string | null>;
  flushDraft: () => void | Promise<void>;
  takeSnapshot: () => Promise<void>;
  shouldReview?: () => boolean;
  onPendingReview?: (pending: CharacterReviewPayload) => void;
  onRunningChange?: (running: boolean) => void;
  chatOwnerType: ChatOwnerType;
  chatOwnerId: string;
  keepEditsInContext?: boolean;
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
    shouldReview,
    onPendingReview,
    onRunningChange,
    chatOwnerType,
    chatOwnerId,
    keepEditsInContext,
  } = options;

  const checkShouldReview = useCallback(() => shouldReview?.() ?? false, [shouldReview]);
  const forwardPendingReview = useCallback(
    (pending: CharacterReviewPayload) => onPendingReview?.(pending),
    [onPendingReview],
  );

  const createHost = useCallback(() => {
    const originalSpec = cloneSpec(getSpec());
    const originalBook = structuredClone(getBook());
    return createCharacterHost({
      getSpec,
      getBook,
      persist: (update) =>
        persist((latest) => {
          const payload: CharacterReviewPayload = {
            originalSpec,
            proposedSpec: update.spec,
            originalBook,
            proposedBook: update.book,
          };
          return applyCharacterReview(payload, defaultDecisions(diffCharacterReview(payload)), latest);
        }),
      getCustomContext,
      takeSnapshot,
      shouldReview: checkShouldReview,
      onPendingReview: forwardPendingReview,
    });
  }, [getBook, getCustomContext, getSpec, persist, takeSnapshot, checkShouldReview, forwardPendingReview]);

  return useAgentSession({
    aiConfig,
    samplerSettings,
    promptSettings,
    flushDraft,
    lookupToolNames: CHARACTER_LOOKUP_TOOLS,
    onRunningChange,
    createHost,
    chatOwnerType,
    chatOwnerId,
    chatPanel: 'agent',
    keepEditsInContext,
  });
}
