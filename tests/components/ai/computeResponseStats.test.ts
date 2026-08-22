import { describe, expect, it } from 'vitest';
import { estimateTokens } from '../../../src/services/AIService';
import {
  abortResponseStats,
  accumulateResponseStats,
  computeResponseStats,
  toResponseStats,
} from '../../../src/components/ai/utils';

describe('computeResponseStats', () => {
  it('uses first-token TTFT and generation speed', () => {
    const content = 'abcd';
    const stats = computeResponseStats({
      requestStartTime: 1000,
      firstTokenTime: 1300,
      endTime: 2300,
      content,
      reasoning: '',
      modelId: 'm',
      providerId: 'p',
    });
    expect(stats.ttft).toBe(300);
    expect(stats.tokensPerSecond).toBe(estimateTokens(content) / 1);
    expect(stats.modelId).toBe('m');
    expect(stats.providerId).toBe('p');
  });

  it('treats the full wait as TTFT when no chunk arrives', () => {
    const content = 'abcdefgh';
    const stats = computeResponseStats({
      requestStartTime: 0,
      firstTokenTime: null,
      endTime: 500,
      content,
      modelId: 'm',
    });
    expect(stats.ttft).toBe(500);
    expect(stats.tokensPerSecond).toBe(estimateTokens(content) / 0.5);
  });

  it('omits t/s when asked', () => {
    const stats = computeResponseStats(
      {
        requestStartTime: 0,
        firstTokenTime: 10,
        endTime: 110,
        content: 'abcd',
        modelId: 'm',
      },
      { includeTokensPerSecond: false },
    );
    expect(stats.ttft).toBe(10);
    expect(stats.tokensPerSecond).toBeUndefined();
  });
});

describe('abortResponseStats', () => {
  it('keeps TTFT only when a token arrived', () => {
    expect(
      abortResponseStats({
        requestStartTime: 0,
        firstTokenTime: 80,
        modelId: 'm',
        providerId: 'prov',
      }),
    ).toEqual({ ttft: 80, modelId: 'm', providerId: 'prov' });
  });

  it('omits TTFT and t/s when nothing streamed', () => {
    const stats = abortResponseStats({
      requestStartTime: 0,
      firstTokenTime: null,
      modelId: 'm',
    });
    expect(stats.ttft).toBeUndefined();
    expect(stats.tokensPerSecond).toBeUndefined();
    expect(stats.modelId).toBe('m');
  });
});

describe('accumulateResponseStats', () => {
  it('keeps the first TTFT and combines t/s across a continuation', () => {
    const content = 'abcd';
    const first = accumulateResponseStats(undefined, {
      requestStartTime: 0,
      firstTokenTime: 100,
      endTime: 1100,
      content,
      modelId: 'm',
    });
    const merged = accumulateResponseStats(first, {
      requestStartTime: 2000,
      firstTokenTime: 2050,
      endTime: 2550,
      content,
      modelId: 'other',
    });
    const stats = toResponseStats(merged);
    expect(stats.ttft).toBe(100);
    expect(stats.modelId).toBe('m');
    const tokens = estimateTokens(content) * 2;
    expect(stats.tokensPerSecond).toBeCloseTo(tokens / 1.5);
  });
});
