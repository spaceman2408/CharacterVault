// @vitest-environment jsdom
import { useState } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AIModelInfo } from '../../../src/db/characterTypes';
import type { SettingsDraft } from '../../../src/components/settings/types';

vi.mock('../../../src/services/providers/NanoGPTAuth', () => ({
  startSignIn: vi.fn(async () => ({ closed: false, close: vi.fn() })),
  exchangeCode: vi.fn(async () => 'sk-new'),
  isOAuthCallbackMessage: (event: MessageEvent) => event.data as { code: string; state: string },
  cancelPendingSignIn: vi.fn(),
}));

const { useNanoGPTSignIn } = await import('../../../src/components/settings/hooks/useNanoGPTSignIn');
const { createDefaultDraft } = await import('../../../src/components/settings/hooks/useSettingsDraft');

const NANO = 'https://nano-gpt.com/api/v1';
const OPENROUTER = 'https://openrouter.ai/api/v1';
const MODELS: AIModelInfo[] = [{ id: 'nano-model', name: 'Nano Model' }];

afterEach(cleanup);

function setup() {
  const fetchModelsForUrl = { current: vi.fn(async () => MODELS) };
  const hook = renderHook(() => {
    const [draft, setDraft] = useState<SettingsDraft>(() => {
      const initial = createDefaultDraft();
      return {
        ...initial,
        ai: {
          ...initial.ai,
          baseUrl: NANO,
          apiKey: '',
          apiKeysByBaseUrl: { [OPENROUTER]: 'sk-or' },
        },
      };
    });
    const signIn = useNanoGPTSignIn({
      isOpen: true,
      baseUrl: draft.ai.baseUrl,
      setDraft,
      fetchModelsForUrl,
      addToast: vi.fn(),
    });
    return { draft, setDraft, signIn };
  });
  return { hook, fetchModelsForUrl };
}

async function completeSignIn(hook: ReturnType<typeof setup>['hook']) {
  await act(async () => {
    window.dispatchEvent(new MessageEvent('message', { data: { code: 'c', state: 's' } }));
  });
  await waitFor(() => expect(hook.result.current.signIn.isSigningIn).toBe(false));
}

describe('useNanoGPTSignIn', () => {
  it('stores the key for NanoGPT when the user switched provider mid sign-in', async () => {
    const { hook, fetchModelsForUrl } = setup();
    await act(async () => hook.result.current.signIn.startSignIn());
    act(() =>
      hook.result.current.setDraft((prev) => ({
        ...prev,
        ai: { ...prev.ai, baseUrl: OPENROUTER, apiKey: 'sk-or' },
      }))
    );

    await completeSignIn(hook);

    const { ai } = hook.result.current.draft;
    expect(ai.apiKeysByBaseUrl).toEqual({ [NANO]: 'sk-new', [OPENROUTER]: 'sk-or' });
    expect(ai.apiKey).toBe('sk-or');
    expect(ai.availableModels).toEqual([]);
    expect(fetchModelsForUrl.current).toHaveBeenCalledWith(NANO, 'sk-new');
  });

  it('fills in the key and models when still on NanoGPT', async () => {
    const { hook } = setup();
    await act(async () => hook.result.current.signIn.startSignIn());

    await completeSignIn(hook);

    const { ai } = hook.result.current.draft;
    expect(ai.apiKey).toBe('sk-new');
    expect(ai.apiKeysByBaseUrl?.[NANO]).toBe('sk-new');
    expect(ai.availableModels).toEqual(MODELS);
  });
});
