import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/db/characterTypes';
import type { AIConfig, SamplerSettings } from '../../src/db/characterTypes';
import { AIService } from '../../src/services/AIService';
import { clearCapabilityCaches, getCapabilityCache } from '../../src/services/chatRequestRepair';

function baseConfig(overrides: Partial<AIConfig> = {}): AIConfig {
  return {
    ...DEFAULT_SETTINGS.ai,
    baseUrl: 'https://example.com/v1',
    apiKey: 'secret-api-key',
    modelId: 'test-model',
    enableStreaming: true,
    enableReasoning: false,
    ...overrides,
  };
}

function baseSampler(overrides: Partial<SamplerSettings> = {}): SamplerSettings {
  return {
    ...DEFAULT_SETTINGS.sampler,
    temperature: 0.5,
    topP: 0.9,
    minP: 0.05,
    topK: 40,
    repetitionPenalty: 1.1,
    contextLength: 4096,
    maxTokens: 512,
    ...overrides,
  };
}

describe('AIService.previewOperationRequest', () => {
  it('builds system + user messages with selected text for expand', () => {
    const service = new AIService(baseConfig(), baseSampler());
    const preview = service.previewOperationRequest('expand', 'Hello world', [
      'Description:\nA brave knight',
    ]);

    expect(preview.method).toBe('POST');
    expect(preview.endpoint).toBe('https://example.com/v1/chat/completions');
    expect(preview.body.model).toBe('test-model');
    expect(preview.body.stream).toBe(true);
    expect(preview.body.temperature).toBe(0.5);
    expect(preview.body.top_p).toBe(0.9);
    expect(preview.body.max_tokens).toBe(512);
    expect(preview.body.messages).toHaveLength(2);
    expect(preview.body.messages[0].role).toBe('system');
    expect(preview.body.messages[1].role).toBe('user');
    expect(preview.body.messages[1].content).toContain('Hello world');
    expect(preview.body.messages[0].content).toContain('A brave knight');
    expect(preview.estimatedInputTokens).toBeGreaterThan(0);
  });

  it('includes instruction for instruct operation', () => {
    const service = new AIService(baseConfig(), baseSampler());
    const preview = service.previewOperationRequest('instruct', 'Original text', [], {
      instruction: 'Make it darker',
    });

    expect(preview.body.messages[1].content).toContain('Make it darker');
    expect(preview.body.messages[1].content).toContain('Original text');
  });

  it('throws when instruct has no instruction', () => {
    const service = new AIService(baseConfig(), baseSampler());
    expect(() => service.previewOperationRequest('instruct', 'text', [])).toThrow(
      'No custom prompt provided'
    );
  });

  it('redacts Authorization header', () => {
    const service = new AIService(baseConfig({ apiKey: 'super-secret' }), baseSampler());
    const preview = service.previewOperationRequest('rewrite', 'sample', []);

    expect(preview.headers['Content-Type']).toBe('application/json');
    expect(preview.headers.Authorization).toBe('Bearer ***');
    expect(JSON.stringify(preview)).not.toContain('super-secret');
  });

  it('sets stream false when streaming is disabled', () => {
    const service = new AIService(baseConfig({ enableStreaming: false }), baseSampler());
    const preview = service.previewOperationRequest('grammar', 'fix me', []);
    expect(preview.body.stream).toBe(false);
  });

  it('includes reasoning fields when enableReasoning is on', () => {
    const service = new AIService(
      baseConfig({ enableReasoning: true, reasoningEffort: 'high' }),
      baseSampler()
    );
    const preview = service.previewOperationRequest('shorten', 'long text here', []);

    expect(preview.body.include_reasoning).toBe(true);
    expect(preview.body.reasoning_effort).toBe('high');
    expect(preview.body.reasoning).toEqual({ enabled: true, effort: 'high' });
  });

  it('reflects capability cache stripping', () => {
    clearCapabilityCaches();
    const baseUrl = 'https://example.com/v1';
    const modelId = 'cached-model';
    const cache = getCapabilityCache(baseUrl, modelId);
    cache.rejectedParams.add('min_p');
    cache.rejectedParams.add('top_k');

    const service = new AIService(baseConfig({ modelId }), baseSampler());
    const preview = service.previewOperationRequest('vivid', 'colorful scene', []);

    expect(preview.body.min_p).toBeUndefined();
    expect(preview.body.top_k).toBeUndefined();
    expect(preview.body.temperature).toBe(0.5);

    clearCapabilityCaches();
  });

  it('adds caching: true for NanoGPT baseUrl when cache provider routing is enabled', () => {
    const service = new AIService(
      baseConfig({
        baseUrl: 'https://nano-gpt.com/api/v1',
        enableCacheProviderRouting: true,
      }),
      baseSampler()
    );
    const preview = service.previewOperationRequest('expand', 'Hello world', []);

    expect(preview.body.caching).toBe(true);
  });

  it('omits caching for non-NanoGPT baseUrl or when routing is disabled', () => {
    const offService = new AIService(
      baseConfig({ baseUrl: 'https://nano-gpt.com/api/v1', enableCacheProviderRouting: false }),
      baseSampler()
    );
    expect(
      offService.previewOperationRequest('expand', 'Hello world', []).body.caching
    ).toBeUndefined();

    const otherHostService = new AIService(
      baseConfig({ baseUrl: 'https://example.com/v1', enableCacheProviderRouting: true }),
      baseSampler()
    );
    expect(
      otherHostService.previewOperationRequest('expand', 'Hello world', []).body.caching
    ).toBeUndefined();
  });

  it('does not call fetch', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const service = new AIService(baseConfig(), baseSampler());
    service.previewOperationRequest('emotion', 'sad scene', []);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
