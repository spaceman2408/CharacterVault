import { describe, expect, it } from 'vitest';
import type { AIConfig } from '../../src/db/characterTypes';
import { DEFAULT_SETTINGS } from '../../src/db/characterTypes';
import {
  applyModelBinding,
  normalizeModelBinding,
  normalizePromptModelMap,
  resolveConfigForOperation,
} from '../../src/services/resolveOperationConfig';

function baseConfig(overrides: Partial<AIConfig> = {}): AIConfig {
  return {
    ...DEFAULT_SETTINGS.ai,
    baseUrl: 'https://nano-gpt.com/api/v1',
    apiKey: 'nano-key',
    modelId: 'global-model',
    apiKeysByBaseUrl: {
      'https://nano-gpt.com/api/v1': 'nano-key',
      'https://openrouter.ai/api/v1': 'or-key',
    },
    providerByModelId: {
      'gpt-oss-120b': 'provider-a',
      'other-model': 'provider-b',
    },
    selectedProvider: 'global-provider',
    ...overrides,
  };
}

describe('resolveConfigForOperation', () => {
  it('returns the original config when there is no binding', () => {
    const config = baseConfig();
    const result = resolveConfigForOperation(config, 'grammar', {});
    expect(result).toBe(config);
  });

  it('returns the original config when binding modelId is whitespace', () => {
    const config = baseConfig();
    const result = resolveConfigForOperation(config, 'grammar', {
      grammar: { baseUrl: 'https://nano-gpt.com/api/v1', modelId: '   ' },
    });
    expect(result).toBe(config);
  });

  it('overrides model on the same endpoint and keeps the active key', () => {
    const config = baseConfig();
    const result = resolveConfigForOperation(config, 'grammar', {
      grammar: { baseUrl: 'https://nano-gpt.com/api/v1/', modelId: ' gpt-oss-120b ' },
    });

    expect(result).not.toBe(config);
    expect(result.baseUrl).toBe('https://nano-gpt.com/api/v1');
    expect(result.modelId).toBe('gpt-oss-120b');
    expect(result.apiKey).toBe('nano-key');
    expect(result.selectedProvider).toBe('provider-a');
  });

  it('switches endpoint and uses the stored key for that URL', () => {
    const config = baseConfig();
    const result = resolveConfigForOperation(config, 'rewrite', {
      rewrite: {
        baseUrl: 'https://openrouter.ai/api/v1',
        modelId: 'deepseek/deepseek-v4-pro',
      },
    });

    expect(result.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(result.modelId).toBe('deepseek/deepseek-v4-pro');
    expect(result.apiKey).toBe('or-key');
    expect(result.selectedProvider).toBeUndefined();
  });

  it('uses empty apiKey when the other endpoint has no stored key', () => {
    const config = baseConfig({
      apiKeysByBaseUrl: {
        'https://nano-gpt.com/api/v1': 'nano-key',
      },
    });
    const result = resolveConfigForOperation(config, 'expand', {
      expand: {
        baseUrl: 'https://openrouter.ai/api/v1',
        modelId: 'some-model',
      },
    });

    expect(result.apiKey).toBe('');
    expect(result.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(result.modelId).toBe('some-model');
  });

  it('falls back to active apiKey when same endpoint has no map entry yet', () => {
    const config = baseConfig({
      apiKeysByBaseUrl: {},
      apiKey: 'live-key',
    });
    const result = resolveConfigForOperation(config, 'shorten', {
      shorten: {
        baseUrl: 'https://nano-gpt.com/api/v1',
        modelId: 'alt-model',
      },
    });

    expect(result.apiKey).toBe('live-key');
    expect(result.modelId).toBe('alt-model');
  });

  it('applies providerByModelId for cross-endpoint NanoGPT-style maps', () => {
    const config = baseConfig({
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'or-key',
      modelId: 'or-model',
      selectedProvider: undefined,
    });
    const result = resolveConfigForOperation(config, 'grammar', {
      grammar: {
        baseUrl: 'https://nano-gpt.com/api/v1',
        modelId: 'gpt-oss-120b',
      },
    });

    expect(result.selectedProvider).toBe('provider-a');
  });
});

describe('applyModelBinding', () => {
  it('returns the original config when the binding is missing', () => {
    const config = baseConfig();
    expect(applyModelBinding(config)).toBe(config);
    expect(applyModelBinding(config, null)).toBe(config);
    expect(applyModelBinding(config, { baseUrl: 'https://nano-gpt.com/api/v1', modelId: '  ' })).toBe(
      config,
    );
  });

  it('overrides model on the same endpoint and keeps the active key', () => {
    const config = baseConfig();
    const result = applyModelBinding(config, {
      baseUrl: 'https://nano-gpt.com/api/v1/',
      modelId: ' gpt-oss-120b ',
    });
    expect(result.modelId).toBe('gpt-oss-120b');
    expect(result.apiKey).toBe('nano-key');
    expect(result.selectedProvider).toBe('provider-a');
  });

  it('switches endpoint and uses the stored key for that URL', () => {
    const config = baseConfig();
    const result = applyModelBinding(config, {
      baseUrl: 'https://openrouter.ai/api/v1',
      modelId: 'deepseek/deepseek-v4-pro',
    });
    expect(result.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(result.modelId).toBe('deepseek/deepseek-v4-pro');
    expect(result.apiKey).toBe('or-key');
  });
});

describe('normalizeModelBinding', () => {
  it('returns undefined for incomplete bindings', () => {
    expect(normalizeModelBinding(null)).toBeUndefined();
    expect(normalizeModelBinding({ baseUrl: '', modelId: 'a' })).toBeUndefined();
    expect(normalizeModelBinding({ baseUrl: 'https://x.com/v1', modelId: '  ' })).toBeUndefined();
  });

  it('trims modelId and normalizes baseUrl', () => {
    expect(
      normalizeModelBinding({
        baseUrl: 'https://nano-gpt.com/api/v1/',
        modelId: '  a  ',
      }),
    ).toEqual({
      baseUrl: 'https://nano-gpt.com/api/v1',
      modelId: 'a',
    });
  });
});

describe('normalizePromptModelMap', () => {
  it('returns empty object for nullish input', () => {
    expect(normalizePromptModelMap(null)).toEqual({});
    expect(normalizePromptModelMap(undefined)).toEqual({});
  });

  it('normalizes baseUrl and trims modelId; drops invalid entries', () => {
    const result = normalizePromptModelMap({
      grammar: { baseUrl: 'https://nano-gpt.com/api/v1/', modelId: '  a  ' },
      rewrite: { baseUrl: '', modelId: 'b' },
      expand: { baseUrl: 'https://x.com/v1', modelId: '' },
    });

    expect(result).toEqual({
      grammar: { baseUrl: 'https://nano-gpt.com/api/v1', modelId: 'a' },
    });
  });
});
