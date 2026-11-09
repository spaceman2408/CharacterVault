// @vitest-environment jsdom
import { useState } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AIConfig, AIModelInfo } from '../../../src/db/characterTypes';
import type { SettingsDraft } from '../../../src/components/settings/types';

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

function setup(ai: Partial<AIConfig> = {}) {
  return renderHook(() => {
    const [draft, setDraft] = useState<SettingsDraft>(() => {
      const initial = createDefaultDraft();
      return {
        ...initial,
        ai: { ...initial.ai, baseUrl: NANO, apiKey: 'sk-nano', modelId: '', ...ai },
      };
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

  it('hides paid OpenRouter models when free models only is on', async () => {
    const hook = setup({ baseUrl: OPENROUTER, openRouter: { freeModelsOnly: true } });
    const models: AIModelInfo[] = [
      { id: 'paid/model', name: 'Paid', pricing: { prompt: 0.000001, completion: 0.000002 } },
      { id: 'free/model:free', name: 'Free', pricing: { prompt: 0, completion: 0 } },
    ];
    let fetching!: Promise<void>;
    act(() => {
      fetching = hook.result.current.catalog.fetchModelsForUrl(OPENROUTER);
    });
    await act(async () => {
      pending[0].resolve(models);
      await fetching;
    });

    const { catalog } = hook.result.current;
    expect(catalog.modelsByBaseUrl[OPENROUTER].map((m) => m.id)).toEqual(['free/model:free']);
    expect(catalog.filterModelsForUrl(OPENROUTER, models)).toHaveLength(1);
    expect(catalog.filterModelsForUrl(NANO, models)).toHaveLength(2);
  });

  it('hides OpenRouter models without a ZDR host once the ZDR list loads', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ model_id: 'zdr/model' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const hook = setup({ baseUrl: OPENROUTER, openRouter: { zdrOnly: true } });
      const models: AIModelInfo[] = [
        { id: 'zdr/model', name: 'ZDR' },
        { id: 'retains/model', name: 'Retains' },
      ];

      await vi.waitFor(() =>
        expect(hook.result.current.catalog.filterModelsForUrl(OPENROUTER, models)).toHaveLength(1)
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/endpoints/zdr',
        expect.anything()
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  describe('editing the custom URL', () => {
    const OLD = 'https://my.host/v1';
    const NEW = 'https://my.host/v2';

    it('moves the key and model to the edited URL without fetching', () => {
      const hook = setup({
        baseUrl: OLD,
        apiKey: 'sk-custom',
        modelId: 'my-model',
        apiKeysByBaseUrl: { [OLD]: 'sk-custom' },
        modelIdsByBaseUrl: { [OLD]: 'my-model' },
      });
      act(() => hook.result.current.catalog.handleCustomUrlChange(`${NEW}/`));

      const { ai } = hook.result.current.draft;
      expect(ai.apiKey).toBe('sk-custom');
      expect(ai.modelId).toBe('my-model');
      expect(ai.apiKeysByBaseUrl).toEqual({ [NEW]: 'sk-custom' });
      expect(ai.modelIdsByBaseUrl).toEqual({ [NEW]: 'my-model' });
      expect(pending).toHaveLength(0);
    });

    it('never carries a preset key to a typed URL', () => {
      const hook = setup({ apiKeysByBaseUrl: { [NANO]: 'sk-nano' } });
      act(() => hook.result.current.catalog.handleCustomUrlChange('https://elsewhere.example/v1'));

      const { ai } = hook.result.current.draft;
      expect(ai.apiKey).toBe('');
      expect(ai.apiKeysByBaseUrl).toEqual({ [NANO]: 'sk-nano' });
    });

    it('does not carry a key left in the field when starting from an empty URL', () => {
      const hook = setup({ baseUrl: '', apiKey: 'sk-nano', apiKeysByBaseUrl: { [NANO]: 'sk-nano' } });
      act(() => hook.result.current.catalog.handleCustomUrlChange(NEW));

      const { ai } = hook.result.current.draft;
      expect(ai.apiKey).toBe('');
      expect(ai.apiKeysByBaseUrl).toEqual({ [NANO]: 'sk-nano' });
    });

    it('switches to the key already stored for the new URL and keeps the old one', () => {
      const hook = setup({
        baseUrl: OLD,
        apiKey: 'sk-old',
        apiKeysByBaseUrl: { [OLD]: 'sk-old', [NEW]: 'sk-new' },
      });
      act(() => hook.result.current.catalog.handleCustomUrlChange(NEW));

      const { ai } = hook.result.current.draft;
      expect(ai.apiKey).toBe('sk-new');
      expect(ai.apiKeysByBaseUrl).toEqual({ [OLD]: 'sk-old', [NEW]: 'sk-new' });
    });

    it('keeps the stored key when the field is cleared and retyped', () => {
      const hook = setup({ baseUrl: OLD, apiKey: 'sk-custom', apiKeysByBaseUrl: { [OLD]: 'sk-custom' } });
      act(() => hook.result.current.catalog.handleCustomUrlChange(''));
      expect(hook.result.current.draft.ai.apiKeysByBaseUrl).toEqual({ [OLD]: 'sk-custom' });

      act(() => hook.result.current.catalog.handleCustomUrlChange(OLD));
      expect(hook.result.current.draft.ai.apiKey).toBe('sk-custom');
    });
  });

  describe('saved presets', () => {
    const MINE = 'https://my.host/v1';

    it('saves the current custom URL and selects it by name', () => {
      const hook = setup({ baseUrl: `${MINE}/`, apiKey: 'sk-mine' });
      expect(hook.result.current.catalog.selectedBaseUrlPreset).toBe('custom');

      act(() => hook.result.current.catalog.saveCustomPreset('  Mine  '));

      expect(hook.result.current.draft.ai.customBaseUrlPresets).toEqual([
        { label: 'Mine', baseUrl: MINE },
      ]);
      expect(hook.result.current.catalog.selectedBaseUrlPreset).toBe('saved:0');
    });

    it('saves a preset per model on a built-in endpoint, sharing its key', () => {
      const KIMI = 'moonshotai/kimi-k3';
      const GLM = 'z-ai/glm-5.3';
      const hook = setup({
        baseUrl: OPENROUTER,
        apiKey: 'sk-or',
        modelId: KIMI,
        apiKeysByBaseUrl: { [OPENROUTER]: 'sk-or' },
      });
      expect(hook.result.current.catalog.selectedBaseUrlPreset).toBe('openrouter');

      act(() => hook.result.current.catalog.saveCustomPreset(''));
      expect(hook.result.current.catalog.selectedBaseUrlPreset).toBe('saved:0');

      act(() => hook.result.current.catalog.handleModelChange(GLM));
      expect(hook.result.current.catalog.selectedBaseUrlPreset).toBe('openrouter');
      act(() => hook.result.current.catalog.saveCustomPreset('GLM'));

      const presets = hook.result.current.draft.ai.customBaseUrlPresets ?? [];
      expect(presets).toEqual([
        { label: 'OpenRouter · kimi-k3', baseUrl: OPENROUTER, modelId: KIMI },
        { label: 'GLM', baseUrl: OPENROUTER, modelId: GLM },
      ]);
      expect(hook.result.current.catalog.selectedBaseUrlPreset).toBe('saved:1');

      act(() => hook.result.current.catalog.handleBaseUrlChange(NANO, true));
      act(() => hook.result.current.catalog.selectSavedPreset(presets[0]));
      const { ai } = hook.result.current.draft;
      expect(ai.baseUrl).toBe(OPENROUTER);
      expect(ai.apiKey).toBe('sk-or');
      expect(ai.modelId).toBe(KIMI);
      expect(hook.result.current.catalog.selectedBaseUrlPreset).toBe('saved:0');
    });

    it('names a preset after its host when the name is blank, and never saves a built-in', () => {
      const hook = setup({ baseUrl: MINE });
      act(() => hook.result.current.catalog.saveCustomPreset(''));
      expect(hook.result.current.draft.ai.customBaseUrlPresets).toEqual([
        { label: 'my.host', baseUrl: MINE },
      ]);

      act(() => hook.result.current.catalog.handleBaseUrlChange(NANO, true));
      act(() => hook.result.current.catalog.saveCustomPreset('Nano again'));
      expect(hook.result.current.draft.ai.customBaseUrlPresets).toHaveLength(1);
    });

    it('restores the saved key and model when the preset is picked again', () => {
      const hook = setup({
        customBaseUrlPresets: [{ label: 'Mine', baseUrl: MINE }],
        apiKeysByBaseUrl: { [NANO]: 'sk-nano', [MINE]: 'sk-mine' },
        modelIdsByBaseUrl: { [MINE]: 'mine-model' },
      });
      act(() => hook.result.current.catalog.handleBaseUrlChange(MINE, true));

      const { ai } = hook.result.current.draft;
      expect(ai.apiKey).toBe('sk-mine');
      expect(ai.modelId).toBe('mine-model');
    });

    it('keeps the built-in selected when picked, even if its model matches a saved preset', () => {
      const KIMI = 'moonshotai/kimi-k3';
      const hook = setup({
        baseUrl: OPENROUTER,
        apiKey: 'sk-or',
        modelId: KIMI,
        apiKeysByBaseUrl: { [OPENROUTER]: 'sk-or' },
        modelIdsByBaseUrl: { [OPENROUTER]: KIMI },
      });
      act(() => hook.result.current.catalog.saveCustomPreset('Kimi'));
      expect(hook.result.current.catalog.selectedBaseUrlPreset).toBe('saved:0');

      act(() => hook.result.current.catalog.selectBuiltinPreset('nano-gpt'));
      act(() => hook.result.current.catalog.selectBuiltinPreset('openrouter'));
      expect(hook.result.current.draft.ai.modelId).toBe(KIMI);
      expect(hook.result.current.catalog.selectedBaseUrlPreset).toBe('openrouter');

      act(() => hook.result.current.catalog.handleModelChange('z-ai/glm-5.3'));
      act(() => hook.result.current.catalog.handleModelChange(KIMI));
      expect(hook.result.current.catalog.selectedBaseUrlPreset).toBe('openrouter');

      const [kimi] = hook.result.current.draft.ai.customBaseUrlPresets ?? [];
      act(() => hook.result.current.catalog.selectSavedPreset(kimi));
      expect(hook.result.current.catalog.selectedBaseUrlPreset).toBe('saved:0');
    });

    it('keeps the built-in model after visiting a saved preset on the same URL', () => {
      const KIMI = 'moonshotai/kimi-k3';
      const DEEPSEEK = 'deepseek/deepseek-v4.1-flash';
      const hook = setup({
        baseUrl: OPENROUTER,
        apiKey: 'sk-or',
        modelId: KIMI,
        customBaseUrlPresets: [{ label: 'Kimi', baseUrl: OPENROUTER, modelId: KIMI }],
        apiKeysByBaseUrl: { [OPENROUTER]: 'sk-or' },
        modelIdsByBaseUrl: { [OPENROUTER]: KIMI },
      });
      act(() => hook.result.current.catalog.selectBuiltinPreset('openrouter'));
      act(() => hook.result.current.catalog.handleModelChange(DEEPSEEK));

      const [kimi] = hook.result.current.draft.ai.customBaseUrlPresets ?? [];
      act(() => hook.result.current.catalog.selectSavedPreset(kimi));
      expect(hook.result.current.draft.ai.modelId).toBe(KIMI);
      expect(hook.result.current.draft.ai.modelIdsByBaseUrl?.[OPENROUTER]).toBe(DEEPSEEK);

      act(() => hook.result.current.catalog.selectBuiltinPreset('openrouter'));
      expect(hook.result.current.draft.ai.modelId).toBe(DEEPSEEK);
      expect(hook.result.current.catalog.selectedBaseUrlPreset).toBe('openrouter');
    });

    it('never carries a saved preset key to an edited URL', () => {
      const hook = setup({
        baseUrl: MINE,
        apiKey: 'sk-mine',
        customBaseUrlPresets: [{ label: 'Mine', baseUrl: MINE }],
        apiKeysByBaseUrl: { [MINE]: 'sk-mine' },
      });
      act(() => hook.result.current.catalog.handleCustomUrlChange('https://my.host/v2'));

      const { ai } = hook.result.current.draft;
      expect(ai.apiKey).toBe('');
      expect(ai.apiKeysByBaseUrl).toEqual({ [MINE]: 'sk-mine' });
    });

    it('does not remember a saved preset as the last custom URL', () => {
      const hook = setup({
        baseUrl: MINE,
        lastCustomBaseUrl: 'https://other.host/v1',
        customBaseUrlPresets: [{ label: 'Mine', baseUrl: MINE }],
      });
      act(() => hook.result.current.catalog.handleBaseUrlChange(NANO, true));
      expect(hook.result.current.draft.ai.lastCustomBaseUrl).toBe('https://other.host/v1');
    });

    it('removes a preset but keeps its stored key', () => {
      const hook = setup({
        baseUrl: MINE,
        apiKey: 'sk-mine',
        customBaseUrlPresets: [{ label: 'Mine', baseUrl: MINE }],
        apiKeysByBaseUrl: { [MINE]: 'sk-mine' },
      });
      act(() =>
        hook.result.current.catalog.removeCustomPreset({ label: 'Mine', baseUrl: `${MINE}/` })
      );

      const { ai } = hook.result.current.draft;
      expect(ai.customBaseUrlPresets).toEqual([]);
      expect(ai.apiKeysByBaseUrl).toEqual({ [MINE]: 'sk-mine' });
      expect(hook.result.current.catalog.selectedBaseUrlPreset).toBe('custom');
    });
  });
});
