/**
 * @fileoverview NanoGPT OAuth callback handling for AI settings.
 * @module components/settings/hooks/useNanoGPTSignIn
 */

import { useEffect, useRef, useState } from 'react';
import {
  startSignIn,
  exchangeCode,
  isOAuthCallbackMessage,
} from '../../../services/providers/NanoGPTAuth';
import type { AddToast, SettingsDraft } from '../types';

interface UseNanoGPTSignInOptions {
  baseUrl: string;
  setDraft: React.Dispatch<React.SetStateAction<SettingsDraft>>;
  handleApiKeyChange: (apiKey: string) => void;
  fetchModelsForUrl: React.MutableRefObject<
    (baseUrl: string, apiKey: string) => Promise<import('../../../db/characterTypes').AIModelInfo[]>
  >;
  addToast: AddToast;
}

export function useNanoGPTSignIn({
  baseUrl,
  setDraft,
  handleApiKeyChange,
  fetchModelsForUrl,
  addToast,
}: UseNanoGPTSignInOptions) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const draftBaseUrlRef = useRef(baseUrl);
  draftBaseUrlRef.current = baseUrl;

  const handleApiKeyChangeRef = useRef(handleApiKeyChange);
  handleApiKeyChangeRef.current = handleApiKeyChange;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const payload = isOAuthCallbackMessage(event);
      if (!payload) return;
      void (async () => {
        setIsSigningIn(true);
        try {
          const key = await exchangeCode(payload.code, payload.state);
          handleApiKeyChangeRef.current(key);
          const currentBaseUrl = draftBaseUrlRef.current;
          const models = await fetchModelsForUrl.current(currentBaseUrl, key);
          if (models.length > 0) {
            setDraft((prev) => ({
              ...prev,
              ai: { ...prev.ai, availableModels: models },
            }));
            addToast('success', `Signed in. Fetched ${models.length} models.`);
          } else {
            addToast('success', 'Signed in. Choose a model!');
          }
        } catch (err) {
          addToast('error', err instanceof Error ? err.message : 'NanoGPT sign-in failed.');
        } finally {
          setIsSigningIn(false);
        }
      })();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [addToast, fetchModelsForUrl, setDraft]);

  return {
    isSigningIn,
    startSignIn: () => {
      void startSignIn();
    },
  };
}
