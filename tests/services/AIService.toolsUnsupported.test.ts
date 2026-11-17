import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/db/characterTypes';
import { AIService, TOOLS_UNSUPPORTED_MESSAGE } from '../../src/services/AIService';
import { clearCapabilityCaches } from '../../src/services/chatRequestRepair';

const tools = [{ name: 'read_field', description: 'Read', parameters: { type: 'object', properties: {} } }];

function service(): AIService {
  return new AIService(
    {
      ...DEFAULT_SETTINGS.ai,
      baseUrl: 'https://tools-unsupported.test/v1',
      apiKey: 'secret-api-key',
      modelId: 'old-model',
      enableStreaming: false,
      enableReasoning: false,
    },
    DEFAULT_SETTINGS.sampler,
  );
}

function rejectTools(): Response {
  return new Response(JSON.stringify({ error: { message: 'Unknown parameter: tools', param: 'tools' } }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('AIService without tool calling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearCapabilityCaches();
  });

  it('fails with a clear error, then fails fast for that model without sending', async () => {
    const fetchMock = vi.fn(async () => rejectTools());
    vi.stubGlobal('fetch', fetchMock);
    const messages = [{ role: 'user' as const, content: 'hi' }];

    await expect(service().chat(messages, undefined, undefined, { tools })).rejects.toMatchObject({
      type: 'tools_unsupported',
      message: TOOLS_UNSUPPORTED_MESSAGE,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(service().chat(messages, undefined, undefined, { tools })).rejects.toMatchObject({
      type: 'tools_unsupported',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
