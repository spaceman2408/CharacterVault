import { describe, expect, it, vi } from 'vitest';
import {
  isRetryableError,
  retryDelayMs,
  withTransientRetry,
} from '../../../src/agent/core/retry';
import type { CompleterResult } from '../../../src/agent/core/types';

function aiError(type: string, extra: Record<string, unknown> = {}) {
  return { name: 'AIError', message: `${type} failure`, type, ...extra };
}

function okResult(): CompleterResult {
  return { content: 'done' };
}

describe('isRetryableError', () => {
  it.each(['rate_limit', 'server', 'network'])('retries AIError type %s', (type) => {
    expect(isRetryableError(aiError(type))).toBe(true);
  });

  it.each(['auth', 'invalid_request', 'content_policy_violation', 'tools_unsupported', 'unknown'])(
    'does not retry AIError type %s',
    (type) => {
      expect(isRetryableError(aiError(type))).toBe(false);
    },
  );

  it('does not retry the cancellation error', () => {
    expect(isRetryableError(aiError('unknown', { message: 'Request was cancelled' }))).toBe(false);
    expect(isRetryableError(new Error('Request was cancelled'))).toBe(false);
    expect(Object.assign(new Error('x'), { name: 'AbortError' })).toSatisfy(
      (err) => !isRetryableError(err),
    );
  });

  it('falls back to status codes for non-AIError shapes', () => {
    expect(isRetryableError({ name: 'Error', statusCode: 429 })).toBe(true);
    expect(isRetryableError({ name: 'Error', statusCode: 500 })).toBe(true);
    expect(isRetryableError({ name: 'Error', statusCode: 503 })).toBe(true);
    expect(isRetryableError({ name: 'Error', statusCode: 400 })).toBe(false);
    expect(isRetryableError({ name: 'Error', statusCode: 404 })).toBe(false);
  });

  it('rejects non-objects and unshaped errors', () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
    expect(isRetryableError('rate_limit')).toBe(false);
    expect(isRetryableError(new Error('boom'))).toBe(false);
  });
});

describe('retryDelayMs', () => {
  it('backs off exponentially with jitter inside the cap', () => {
    for (const index of [0, 1, 2, 3]) {
      const base = 1000 * 2 ** index;
      const delay = retryDelayMs(index, aiError('server'), 1000, 20000);
      expect(delay).toBeGreaterThanOrEqual(base * 0.75);
      expect(delay).toBeLessThanOrEqual(Math.min(20000, base * 1.25));
    }
  });

  it('caps runaway backoff at maxDelayMs', () => {
    expect(retryDelayMs(10, aiError('server'), 1000, 20000)).toBeLessThanOrEqual(20000);
  });

  it('honors retryAfterMs clamped to the cap without jitter', () => {
    expect(retryDelayMs(0, aiError('rate_limit', { retryAfterMs: 5000 }), 1000, 20000)).toBe(5000);
    expect(retryDelayMs(3, aiError('rate_limit', { retryAfterMs: 60000 }), 1000, 20000)).toBe(20000);
  });

  it('ignores invalid retryAfterMs hints', () => {
    for (const hint of [undefined, -100, Number.NaN, Number.POSITIVE_INFINITY, 'soon']) {
      const delay = retryDelayMs(0, aiError('rate_limit', { retryAfterMs: hint }), 1000, 20000);
      expect(delay).toBeGreaterThanOrEqual(750);
      expect(delay).toBeLessThanOrEqual(1250);
    }
  });
});

describe('withTransientRetry', () => {
  it('passes a first-try success through with no sleeping', async () => {
    const complete = vi.fn(async () => okResult());
    const sleep = vi.fn(async () => undefined);
    const result = await withTransientRetry(complete, {
      shouldAbort: () => false,
      sleep,
    })([]);
    expect(result).toEqual(okResult());
    expect(complete).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries transient failures with growing delays then succeeds', async () => {
    const complete = vi
      .fn<() => Promise<CompleterResult>>()
      .mockRejectedValueOnce(aiError('rate_limit'))
      .mockRejectedValueOnce(aiError('server'))
      .mockResolvedValueOnce(okResult());
    const delays: number[] = [];
    const result = await withTransientRetry(complete, {
      shouldAbort: () => false,
      sleep: async (ms) => {
        delays.push(ms);
      },
    })([]);
    expect(result).toEqual(okResult());
    expect(complete).toHaveBeenCalledTimes(3);
    expect(delays).toHaveLength(2);
    expect(delays[0]).toBeGreaterThanOrEqual(750);
    expect(delays[0]).toBeLessThanOrEqual(1250);
    expect(delays[1]).toBeGreaterThanOrEqual(1500);
    expect(delays[1]).toBeLessThanOrEqual(2500);
  });

  it('retries network failures and forwards messages and chunks', async () => {
    const messages = [{ role: 'user' as const, content: 'hi' }];
    const onChunk = vi.fn();
    const complete = vi
      .fn()
      .mockRejectedValueOnce(aiError('network'))
      .mockImplementationOnce(async (gotMessages: unknown, gotChunk: unknown) => {
        expect(gotMessages).toBe(messages);
        expect(gotChunk).toBe(onChunk);
        return okResult();
      });
    const result = await withTransientRetry(complete, {
      shouldAbort: () => false,
      sleep: async () => undefined,
    })(messages, onChunk);
    expect(result).toEqual(okResult());
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('stops after maxRetries and rethrows the last error', async () => {
    const last = aiError('rate_limit');
    const complete = vi.fn(async () => {
      throw last;
    });
    await expect(
      withTransientRetry(complete, {
        shouldAbort: () => false,
        maxRetries: 2,
        sleep: async () => undefined,
      })([]),
    ).rejects.toBe(last);
    expect(complete).toHaveBeenCalledTimes(3);
  });

  it('makes zero attempts when maxRetries is 0', async () => {
    const failure = aiError('server');
    const complete = vi.fn(async () => {
      throw failure;
    });
    await expect(
      withTransientRetry(complete, {
        shouldAbort: () => false,
        maxRetries: 0,
        sleep: async () => undefined,
      })([]),
    ).rejects.toBe(failure);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it.each(['auth', 'invalid_request', 'content_policy_violation', 'tools_unsupported', 'unknown'])(
    'does not retry %s and rethrows the same error',
    async (type) => {
      const failure = aiError(type);
      const complete = vi.fn(async () => {
        throw failure;
      });
      await expect(
        withTransientRetry(complete, {
          shouldAbort: () => false,
          sleep: async () => undefined,
        })([]),
      ).rejects.toBe(failure);
      expect(complete).toHaveBeenCalledTimes(1);
    },
  );

  it('does not attempt when already aborted', async () => {
    const complete = vi.fn(async () => okResult());
    await expect(
      withTransientRetry(complete, {
        shouldAbort: () => true,
        sleep: async () => undefined,
      })([]),
    ).rejects.toThrow('Request was cancelled');
    expect(complete).not.toHaveBeenCalled();
  });

  it('aborts during backoff and reports cancellation, not the provider error', async () => {
    let aborted = false;
    const complete = vi.fn(async () => {
      throw aiError('rate_limit');
    });
    await expect(
      withTransientRetry(complete, {
        shouldAbort: () => aborted,
        sleep: async () => {
          aborted = true;
        },
      })([]),
    ).rejects.toThrow('Request was cancelled');
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('aborting mid-retry surfaces cancellation even for retryable errors', async () => {
    const calls = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    const complete = vi.fn(async () => {
      throw aiError('server');
    });
    await expect(
      withTransientRetry(complete, {
        shouldAbort: () => calls(),
        sleep: async () => undefined,
      })([]),
    ).rejects.toThrow('Request was cancelled');
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('default sleep wakes early on abort instead of waiting out the delay', async () => {
    let aborted = false;
    const complete = vi.fn(async () => {
      throw aiError('rate_limit');
    });
    setTimeout(() => {
      aborted = true;
    }, 50);
    const started = Date.now();
    await expect(
      withTransientRetry(complete, {
        shouldAbort: () => aborted,
        baseDelayMs: 30000,
        maxDelayMs: 30000,
      })([]),
    ).rejects.toThrow('Request was cancelled');
    expect(Date.now() - started).toBeLessThan(5000);
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
