/**
 * @fileoverview NanoGPT OAuth callback handling for AI settings.
 * @module components/settings/hooks/useNanoGPTSignIn
 */

import { useEffect, useRef, useState } from 'react';
import {
  startSignIn,
  exchangeCode,
  isOAuthCallbackMessage,
  cancelPendingSignIn,
} from '../../../services/providers/NanoGPTAuth';
import type { AddToast, SettingsDraft } from '../types';

interface UseNanoGPTSignInOptions {
  isOpen: boolean;
  baseUrl: string;
  setDraft: React.Dispatch<React.SetStateAction<SettingsDraft>>;
  handleApiKeyChange: (apiKey: string) => void;
  fetchModelsForUrl: React.MutableRefObject<
    (baseUrl: string, apiKey: string) => Promise<import('../../../db/characterTypes').AIModelInfo[]>
  >;
  addToast: AddToast;
}

export function useNanoGPTSignIn({
  isOpen,
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
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;
  const setDraftRef = useRef(setDraft);
  setDraftRef.current = setDraft;

  const popupRef = useRef<Window | null>(null);
  const callbackReceivedRef = useRef(false);
  const mountedRef = useRef(true);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) return;
    setIsSigningIn(false);
    popupRef.current?.close();
    popupRef.current = null;
    cancelPendingSignIn();
  }, [isOpen]);

  useEffect(() => {
    return () => {
      popupRef.current?.close();
      popupRef.current = null;
      cancelPendingSignIn();
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !isSigningIn) return;

    const onMessage = (event: MessageEvent) => {
      const payload = isOAuthCallbackMessage(event);
      if (!payload) return;
      callbackReceivedRef.current = true;
      void (async () => {
        try {
          const key = await exchangeCode(payload.code, payload.state);
          if (!mountedRef.current) return;
          handleApiKeyChangeRef.current(key);
          const currentBaseUrl = draftBaseUrlRef.current;
          const models = await fetchModelsForUrl.current(currentBaseUrl, key);
          if (!mountedRef.current) return;
          if (models.length > 0) {
            setDraftRef.current((prev) => ({
              ...prev,
              ai: { ...prev.ai, availableModels: models },
            }));
            addToastRef.current('success', `Signed in. Fetched ${models.length} models.`);
          } else {
            addToastRef.current('success', 'Signed in. Choose a model!');
          }
        } catch (err) {
          if (!mountedRef.current) return;
          addToastRef.current(
            'error',
            err instanceof Error ? err.message : 'NanoGPT sign-in failed.'
          );
        } finally {
          popupRef.current = null;
          if (mountedRef.current) setIsSigningIn(false);
        }
      })();
    };
    window.addEventListener('message', onMessage);

    const pollId = window.setInterval(() => {
      const popup = popupRef.current;
      if (!popup || callbackReceivedRef.current) return;
      if (!popup.closed) return;
      popupRef.current = null;
      cancelPendingSignIn();
      if (mountedRef.current) setIsSigningIn(false);
    }, 400);

    return () => {
      window.removeEventListener('message', onMessage);
      window.clearInterval(pollId);
    };
  }, [isOpen, isSigningIn, fetchModelsForUrl]);

  return {
    isSigningIn,
    startSignIn: () => {
      callbackReceivedRef.current = false;
      setIsSigningIn(true);
      void startSignIn()
        .then((popup) => {
          if (!mountedRef.current || !isOpenRef.current) {
            popup?.close();
            cancelPendingSignIn();
            return;
          }
          if (!popup || popup.closed) {
            cancelPendingSignIn();
            setIsSigningIn(false);
            addToastRef.current('error', 'NanoGPT sign-in window was blocked or closed.');
            return;
          }
          popupRef.current = popup;
        })
        .catch((err) => {
          if (!mountedRef.current) return;
          setIsSigningIn(false);
          addToastRef.current(
            'error',
            err instanceof Error ? err.message : 'NanoGPT sign-in failed.'
          );
        });
    },
  };
}
