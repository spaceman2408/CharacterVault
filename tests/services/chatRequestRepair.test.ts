import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyCapabilityCache,
  clearCapabilityCaches,
  getCapabilityCache,
  isNativeToolsRejected,
  mapEffortToSupported,
  matchRejectedParams,
  parseSupportedValues,
  recordRepairInCache,
  repairChatRequest,
  sanitizeSamplerParams,
  shouldOmitNonStandardSamplers,
  stripAllNonStandardParams,
  type ChatRequestLike,
} from '../../src/services/chatRequestRepair';

describe('parseSupportedValues', () => {
  it('parses DeepSeek-style supported values list', () => {
    const msg =
      'Invalid value for reasoning_effort on model "deepseek/x": "medium". Supported values are: none, high, max.';
    expect(parseSupportedValues(msg)).toEqual(['none', 'high', 'max']);
  });

  it('returns null when no list present', () => {
    expect(parseSupportedValues('Unknown error')).toBeNull();
  });
});

describe('mapEffortToSupported', () => {
  it('maps medium to high when only none/high/max allowed', () => {
    expect(mapEffortToSupported('medium', ['none', 'high', 'max'], { allowNone: false })).toBe(
      'high'
    );
  });

  it('never picks none when allowNone is false', () => {
    expect(mapEffortToSupported('minimal', ['none', 'high'], { allowNone: false })).toBe('high');
  });

  it('peer-maps max to xhigh when only xhigh is allowed', () => {
    expect(mapEffortToSupported('max', ['none', 'high', 'xhigh'], { allowNone: false })).toBe(
      'xhigh'
    );
  });

  it('peer-maps xhigh to max when only max is allowed', () => {
    expect(mapEffortToSupported('xhigh', ['none', 'high', 'max'], { allowNone: false })).toBe(
      'max'
    );
  });

  it('returns exact match when already supported', () => {
    expect(mapEffortToSupported('high', ['none', 'high', 'max'])).toBe('high');
  });
});

describe('matchRejectedParams', () => {
  it('uses error.param exactly', () => {
    const keys = ['min_p', 'reasoning_effort', 'reasoning', 'temperature'];
    const found = matchRejectedParams(
      { error: { param: 'reasoning_effort', message: 'bad' } },
      keys
    );
    expect(found).toContain('reasoning_effort');
  });

  it('does not strip reasoning when message only mentions reasoning_effort', () => {
    const keys = ['reasoning', 'reasoning_effort', 'min_p'];
    const found = matchRejectedParams(
      {
        error: {
          message:
            'Invalid value for reasoning_effort on model "x": "medium". Supported values are: none, high, max.',
          param: 'reasoning_effort',
          code: 'unsupported_reasoning_effort',
        },
      },
      keys
    );
    expect(found).toContain('reasoning_effort');
    expect(found).not.toContain('reasoning');
  });

  it('matches min_p from message without false positives', () => {
    const keys = ['min_p', 'top_p', 'temperature'];
    const found = matchRejectedParams(
      { error: { message: 'Unknown parameter: min_p' } },
      keys
    );
    expect(found).toEqual(['min_p']);
  });
});

describe('repairChatRequest', () => {
  const baseRequest = (): ChatRequestLike => ({
    model: 'deepseek/deepseek-v4-pro-cheaper:thinking',
    temperature: 0.7,
    top_p: 1,
    min_p: 0.05,
    top_k: 40,
    repetition_penalty: 1.1,
    include_reasoning: true,
    reasoning: { enabled: true, effort: 'medium' },
    reasoning_effort: 'medium',
  });

  it('remaps medium → high for DeepSeek-style effort error without stripping reasoning', () => {
    const result = repairChatRequest(baseRequest(), {
      error: {
        message:
          'Invalid value for reasoning_effort on model "deepseek/deepseek-v4-pro-cheaper:thinking": "medium". Supported values are: none, high, max.',
        type: 'invalid_request_error',
        param: 'reasoning_effort',
        code: 'unsupported_reasoning_effort',
      },
    });

    expect(result).not.toBeNull();
    expect(result!.remapped.reasoning_effort).toBe('high');
    expect(result!.request.reasoning_effort).toBe('high');
    expect(result!.request.reasoning).toEqual({ enabled: true, effort: 'high' });
    expect(result!.removed).not.toContain('reasoning');
    expect(result!.removed).not.toContain('reasoning_effort');
    expect(result!.request.min_p).toBe(0.05);
  });

  it('strips only named sampler params', () => {
    const result = repairChatRequest(baseRequest(), {
      error: { message: 'Unsupported parameter: min_p' },
    });
    expect(result).not.toBeNull();
    expect(result!.removed).toEqual(['min_p']);
    expect(result!.request.min_p).toBeUndefined();
    expect(result!.request.temperature).toBe(0.7);
    expect(result!.request.top_p).toBe(1);
    expect(result!.request.reasoning_effort).toBe('medium');
  });

  it('returns null for unknown 400 with no matching params', () => {
    const result = repairChatRequest(
      { model: 'x', temperature: 0.5 },
      { error: { message: 'Something completely unrelated went wrong' } }
    );
    expect(result).toBeNull();
  });

  it('strips tools and tool_choice when the provider rejects function calling', () => {
    const result = repairChatRequest(
      {
        model: 'x',
        tools: [{ type: 'function', function: { name: 'add_entry' } }],
        tool_choice: 'auto',
      },
      { error: { message: 'Unknown parameter: tools is not supported on this model' } },
    );
    expect(result).not.toBeNull();
    expect(result!.removed).toEqual(expect.arrayContaining(['tools', 'tool_choice']));
    expect(result!.request.tools).toBeUndefined();
    expect(result!.request.tool_choice).toBeUndefined();
  });
});

describe('isNativeToolsRejected', () => {
  beforeEach(() => {
    clearCapabilityCaches();
  });

  it('is true after a tools rejection is cached for that model', () => {
    const cache = getCapabilityCache('https://api.example.com', 'model-a');
    recordRepairInCache(cache, { request: {}, removed: ['tools', 'tool_choice'], remapped: {} });
    expect(isNativeToolsRejected('https://api.example.com', 'model-a')).toBe(true);
    expect(isNativeToolsRejected('https://api.example.com', 'model-b')).toBe(false);
  });
});

describe('stripAllNonStandardParams', () => {
  it('removes non-standard params and keeps core sampling', () => {
    const result = stripAllNonStandardParams({
      model: 'm',
      temperature: 0.7,
      top_p: 1,
      min_p: 0.05,
      top_k: 40,
      repetition_penalty: 1.1,
      reasoning_effort: 'high',
      reasoning: { enabled: true, effort: 'high' },
    });
    expect(result.removed).toEqual(
      expect.arrayContaining(['min_p', 'top_k', 'repetition_penalty', 'reasoning_effort', 'reasoning'])
    );
    expect(result.request.temperature).toBe(0.7);
    expect(result.request.min_p).toBeUndefined();
  });
});

describe('sanitizeSamplerParams / strict hosts', () => {
  it('detects openai as strict and leaves Synthetic on the standard path', () => {
    expect(shouldOmitNonStandardSamplers('https://api.openai.com/v1')).toBe(true);
    expect(shouldOmitNonStandardSamplers('https://api.synthetic.new/v1')).toBe(false);
    expect(shouldOmitNonStandardSamplers('https://nano-gpt.com/api/v1')).toBe(false);
  });

  it('omits non-standard samplers on strict hosts', () => {
    const cleaned = sanitizeSamplerParams(
      { min_p: 0.05, top_k: 40, repetition_penalty: 1.1, temperature: 0.7 },
      'https://api.openai.com/v1'
    );
    expect(cleaned.min_p).toBeUndefined();
    expect(cleaned.top_k).toBeUndefined();
    expect(cleaned.repetition_penalty).toBeUndefined();
    expect(cleaned.temperature).toBe(0.7);
  });

  it('keeps Synthetic-supported extras (top_k, repetition_penalty) and drops no-op min_p', () => {
    const cleaned = sanitizeSamplerParams(
      { min_p: 0, top_k: 40, repetition_penalty: 1.1, temperature: 0.7 },
      'https://api.synthetic.new/v1'
    );
    expect(cleaned.min_p).toBeUndefined();
    expect(cleaned.top_k).toBe(40);
    expect(cleaned.repetition_penalty).toBe(1.1);
    expect(cleaned.temperature).toBe(0.7);
  });

  it('omits no-op sampler values on non-strict hosts', () => {
    const cleaned = sanitizeSamplerParams(
      { min_p: 0, top_k: 0, repetition_penalty: 1, temperature: 0.7 },
      'https://nano-gpt.com/api/v1'
    );
    expect(cleaned.min_p).toBeUndefined();
    expect(cleaned.top_k).toBeUndefined();
    expect(cleaned.repetition_penalty).toBeUndefined();
  });
});

describe('capability cache', () => {
  beforeEach(() => {
    clearCapabilityCaches();
  });

  it('applies rejected params and effort allowlist on later requests', () => {
    const cache = getCapabilityCache('https://example.com/v1', 'model-a');
    recordRepairInCache(cache, {
      request: {},
      removed: ['min_p', 'top_k'],
      remapped: { reasoning_effort: 'high' },
    });
    cache.effortAllowlist = ['none', 'high', 'max'];

    const next = applyCapabilityCache(
      {
        min_p: 0.05,
        top_k: 40,
        reasoning_effort: 'medium',
        reasoning: { enabled: true, effort: 'medium' },
      },
      cache
    );

    expect(next.min_p).toBeUndefined();
    expect(next.top_k).toBeUndefined();
    expect(next.reasoning_effort).toBe('high');
    expect(next.reasoning).toEqual({ enabled: true, effort: 'high' });
  });
});
