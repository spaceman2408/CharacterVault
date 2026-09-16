import { describe, expect, it, vi, afterEach } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/db/characterTypes';
import type { AIConfig, CustomToolbarOp, SamplerSettings } from '../../src/db/characterTypes';
import { AIService } from '../../src/services/AIService';

const PIRATE: CustomToolbarOp = {
  id: 'custom:pirate',
  label: 'Pirate',
  icon: '🏴',
  prompt: 'Rewrite the following like a pirate:\n\n"""\n${text}\n"""',
};

function baseConfig(overrides: Partial<AIConfig> = {}): AIConfig {
  return {
    ...DEFAULT_SETTINGS.ai,
    baseUrl: 'https://example.com/v1',
    apiKey: 'secret-api-key',
    modelId: 'test-model',
    enableStreaming: false,
    enableReasoning: false,
    ...overrides,
  };
}

function baseSampler(overrides: Partial<SamplerSettings> = {}): SamplerSettings {
  return {
    ...DEFAULT_SETTINGS.sampler,
    contextLength: 4096,
    maxTokens: 512,
    ...overrides,
  };
}

describe('AIService custom toolbar operations', () => {
  it('builds the user message from the custom template', () => {
    const service = new AIService(baseConfig(), baseSampler(), undefined, [PIRATE]);
    const preview = service.previewOperationRequest('custom:pirate', 'Hello sailor', []);
    expect(preview.body.messages).toHaveLength(2);
    expect(preview.body.messages[1].content).toContain('like a pirate');
    expect(preview.body.messages[1].content).toContain('Hello sailor');
  });

  it('runs custom ops without an instruction', () => {
    const service = new AIService(baseConfig(), baseSampler(), undefined, [PIRATE]);
    const preview = service.previewOperationRequest('custom:pirate', 'Hello sailor', [], {
      instruction: undefined,
    });
    expect(preview.body.messages[1].content).toContain('Hello sailor');
  });

  it('accepts custom ops passed per-preview', () => {
    const service = new AIService(baseConfig(), baseSampler());
    const preview = service.previewOperationRequest('custom:pirate', 'Hello sailor', [], {
      customOps: [PIRATE],
    });
    expect(preview.body.messages[1].content).toContain('like a pirate');
  });

  it('throws for unknown custom operations', () => {
    const service = new AIService(baseConfig(), baseSampler(), undefined, [PIRATE]);
    expect(() => service.previewOperationRequest('custom:ghost', 'text', [])).toThrow(
      'Unknown toolbar operation: custom:ghost',
    );
  });

  it('keeps builtin behavior unchanged alongside customs', () => {
    const service = new AIService(baseConfig(), baseSampler(), undefined, [PIRATE]);
    const preview = service.previewOperationRequest('expand', 'Hello world', []);
    expect(preview.body.messages[1].content).toContain('Hello world');
  });

  it('still requires an instruction for instruct', () => {
    const service = new AIService(baseConfig(), baseSampler(), undefined, [PIRATE]);
    expect(() => service.previewOperationRequest('instruct', 'text', [])).toThrow(
      'No custom prompt provided',
    );
  });

  it('runTextOperation sends the custom template end to end', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'x',
          object: 'chat.completion',
          created: 0,
          model: 'test-model',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Yarr!' }, finish_reason: 'stop' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const service = new AIService(baseConfig(), baseSampler(), undefined, [PIRATE]);
      const response = await service.runTextOperation('custom:pirate', 'Hello sailor', []);
      expect(response.content).toBe('Yarr!');
      const firstCall = fetchMock.mock.calls[0] as unknown as [unknown, { body: string }];
      const sentBody = JSON.parse(firstCall[1].body) as {
        messages: { role: string; content: string }[];
      };
      expect(sentBody.messages[1].content).toContain('like a pirate');
      expect(sentBody.messages[1].content).toContain('Hello sailor');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('runTextOperation rejects unknown operations without network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      const service = new AIService(baseConfig(), baseSampler(), undefined, [PIRATE]);
      await expect(service.runTextOperation('custom:ghost', 'text', [])).rejects.toThrow(
        'Unknown toolbar operation: custom:ghost',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
