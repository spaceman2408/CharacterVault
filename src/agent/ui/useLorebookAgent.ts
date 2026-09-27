import { useCallback } from 'react';
import type {
  AIConfig,
  CharacterBook,
  ChatOwnerType,
  PromptSettings,
  SamplerSettings,
} from '../../db/characterTypes';
import { createLorebookHost } from '../hosts/lorebook/createHost';
import { applyLorebookReview, defaultDecisions, diffLorebookReview } from '../review/diff';
import type { LorebookReviewPayload } from '../review/types';
import { LOREBOOK_LOOKUP_TOOLS } from './notices';
import {
  lastUserMessageIndex,
  useAgentSession,
  type UseAgentSessionReturn,
} from './useAgentSession';

export { lastUserMessageIndex };

/** Receives the latest saved book and returns the book to write, or null to skip. */
export type SetAgentBook = (build: (latest: CharacterBook) => CharacterBook | null) => Promise<void>;

export interface UseLorebookAgentOptions {
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  getBook: () => CharacterBook;
  setBook: SetAgentBook;
  getCustomContext: () => Promise<string | null>;
  flushDraft: () => void | Promise<void>;
  takeSnapshot: () => Promise<void>;
  shouldReview?: () => boolean;
  onPendingReview?: (pending: LorebookReviewPayload) => void;
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
    shouldReview,
    onPendingReview,
    onRunningChange,
    chatOwnerType,
    chatOwnerId,
  } = options;

  const checkShouldReview = useCallback(() => shouldReview?.() ?? false, [shouldReview]);
  const forwardPendingReview = useCallback(
    (pending: LorebookReviewPayload) => onPendingReview?.(pending),
    [onPendingReview],
  );

  const createHost = useCallback(() => {
    const originalBook = structuredClone(getBook());
    return createLorebookHost({
      getBook,
      setBook: (proposedBook) =>
        setBook((latest) => {
          const payload: LorebookReviewPayload = { originalBook, proposedBook };
          return applyLorebookReview(payload, defaultDecisions(diffLorebookReview(payload)), latest);
        }),
      getCustomContext,
      takeSnapshot,
      shouldReview: checkShouldReview,
      onPendingReview: forwardPendingReview,
    });
  }, [getBook, getCustomContext, setBook, takeSnapshot, checkShouldReview, forwardPendingReview]);

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
