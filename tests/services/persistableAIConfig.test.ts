import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type AIConfig } from '../../src/db/characterTypes';
import { persistableAIConfig } from '../../src/services/CharacterSettingsService';

describe('persistableAIConfig', () => {
  it('drops availableModels so catalogs are not written to settings', () => {
    const config: AIConfig = {
      ...DEFAULT_SETTINGS.ai,
      apiKey: 'sk-test',
      modelId: 'gpt-oss-120b',
      availableModels: [
        { id: 'a', name: 'A', contextLength: 8192, pricing: { prompt: 1, completion: 2 } },
        { id: 'b', name: 'B' },
      ],
    };

    const persisted = persistableAIConfig(config);

    expect(persisted.availableModels).toEqual([]);
    expect(persisted.apiKey).toBe('sk-test');
    expect(persisted.modelId).toBe('gpt-oss-120b');
    expect(config.availableModels).toHaveLength(2);
  });

  it('fills missing AI fields from defaults', () => {
    const persisted = persistableAIConfig({
      baseUrl: 'https://example.com/v1',
      apiKey: 'k',
      modelId: 'm',
      enableStreaming: false,
    } as AIConfig);

    expect(persisted.enableReasoning).toBe(DEFAULT_SETTINGS.ai.enableReasoning);
    expect(persisted.availableModels).toEqual([]);
    expect(persisted.baseUrl).toBe('https://example.com/v1');
  });
});
