// @vitest-environment jsdom
import { useState } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AIModelInfo } from '../../../src/db/characterTypes';

const pending: Array<{ resolve: (models: AIModelInfo[]) => void; reject: (err: Error) => void }> = [];

vi.mock('../../../src/services/AIService', () => ({
  AIError: class AIError extends Error {},
  AIService: class {
    fetchModels() {
      return new Promise<AIModelInfo[]>((resolve, reject) => pending.push({ resolve, reject }));
    }
    fetchModelProviders() {
      return Promise.resolve({ supportsProviderSelection: false, providers: [] });
    }
  },
}));

const { AIError } = await import('../../../src/services/AIService');
const { useModelCatalog } = await import('../../../src/components/settings/hooks/useModelCatalog');
const { createDefaultDraft } = await import('../../../src/components/settings/hooks/useSettingsDraft');

const NANO = 'https://nano-gpt.com/api/v1';
const OPENROUTER = 'https://openrouter.ai/api/v1';

afterEach(() => {
  cleanup();
  pending.length = 0;
});

function setup() {
  return renderHook(() => {
    const [draft, setDraft] = useState(() => {
      const initial = createDefaultDraft();
      return { ...initial, ai: { ...initial.ai, baseUrl: NANO, apiKey: 'sk-nano', modelId: '' } };
    });
    const catalog = useModelCatalog({
      isOpen: true,
      isLoading: false,
      draft,
      setDraft,
      addToast: vi.fn(),
    });
    return { draft, catalog };
  });
}

describe('useModelCatalog', () => {
  it('does not show a late model list under a different base URL', async () => {
    const hook = setup();
    let fetching!: Promise<void>;
    act(() => {
      fetching = hook.result.current.catalog.fetchModels();
    });
    act(() => hook.result.current.catalog.handleBaseUrlChange(OPENROUTER, true));

    await act(async () => {
      pending[0].resolve([{ id: 'nano-model', name: 'Nano Model' }]);
      await fetching;
    });

    expect(hook.result.current.draft.ai.baseUrl).toBe(OPENROUTER);
    expect(hook.result.current.draft.ai.availableModels).toEqual([]);

    act(() => hook.result.current.catalog.handleBaseUrlChange(NANO, true));
    expect(hook.result.current.draft.ai.availableModels).toEqual([
      { id: 'nano-model', name: 'Nano Model' },
    ]);
  });

  it('reports a failed fetch for that endpoint only', async () => {
    const hook = setup();
    let fetching!: Promise<void>;
    act(() => {
      fetching = hook.result.current.catalog.fetchModelsForUrl(OPENROUTER);
    });
    await act(async () => {
      pending[0].reject(new AIError('Invalid API key', 'auth'));
      await fetching;
    });
    expect(hook.result.current.catalog.modelFetchErrorForUrl(OPENROUTER)).toBe('Invalid API key');
    expect(hook.result.current.catalog.modelFetchErrorForUrl(NANO)).toBeNull();
    expect(hook.result.current.catalog.isFetchingModelsForUrl(OPENROUTER)).toBe(false);
  });

  it('shows the list when the base URL is unchanged', async () => {
    const hook = setup();
    let fetching!: Promise<void>;
    act(() => {
      fetching = hook.result.current.catalog.fetchModels();
    });
    await act(async () => {
      pending[0].resolve([{ id: 'nano-model', name: 'Nano Model' }]);
      await fetching;
    });
    expect(hook.result.current.draft.ai.availableModels).toEqual([
      { id: 'nano-model', name: 'Nano Model' },
    ]);
  });
});
