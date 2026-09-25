import type { Completer } from './types';

/** AIError types worth another attempt. Everything else fails the run fast. */
export const RETRYABLE_ERROR_TYPES = new Set(['rate_limit', 'server', 'network']);

export const DEFAULT_MAX_RETRIES = 4;
export const DEFAULT_BASE_DELAY_MS = 1000;
export const DEFAULT_MAX_DELAY_MS = 20000;

const ABORT_POLL_MS = 100;
const JITTER_RATIO = 0.25;

export interface TransientRetryOptions {
  shouldAbort: () => boolean;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Injectable for tests; the default sleep wakes early on abort. */
  sleep?: (ms: number) => Promise<void>;
}

interface ErrorShape {
  name?: unknown;
  type?: unknown;
  statusCode?: unknown;
  message?: unknown;
  retryAfterMs?: unknown;
}

function asShape(error: unknown): ErrorShape | null {
  if (!error || typeof error !== 'object') return null;
  return error as ErrorShape;
}

/**
 * Whether a completer failure deserves another attempt. Matches the
 * `AIError` shape from services structurally so `core/` stays
 * self-contained; anything else (auth, bad request, policy, cancelled,
 * unknown) rethrows immediately.
 */
export function isRetryableError(error: unknown): boolean {
  const err = asShape(error);
  if (!err) return false;
  if (err.name === 'AIError') {
    return typeof err.type === 'string' && RETRYABLE_ERROR_TYPES.has(err.type);
  }
  if (typeof err.message === 'string' && /abort|cancel/i.test(err.message)) return false;
  if (typeof err.statusCode === 'number') {
    return err.statusCode === 429 || (err.statusCode >= 500 && err.statusCode <= 599);
  }
  return false;
}

function retryAfterHint(error: unknown): number | undefined {
  const err = asShape(error);
  const hint = err?.retryAfterMs;
  if (typeof hint !== 'number' || !Number.isFinite(hint) || hint < 0) return undefined;
  return hint;
}

/** Delay before retry `retryIndex` (0-based): honored hint or jittered backoff, capped. */
export function retryDelayMs(
  retryIndex: number,
  error: unknown,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const hint = retryAfterHint(error);
  if (hint !== undefined) return Math.min(maxDelayMs, hint);
  const backoff = baseDelayMs * 2 ** retryIndex;
  const jittered = backoff * (1 - JITTER_RATIO + Math.random() * JITTER_RATIO * 2);
  return Math.min(maxDelayMs, jittered);
}

function cancelledError(): Error {
  return new Error('Request was cancelled');
}

async function abortableSleep(ms: number, shouldAbort: () => boolean): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (shouldAbort()) throw cancelledError();
    const remaining = ms - (Date.now() - start);
    await new Promise((resolve) => setTimeout(resolve, Math.min(ABORT_POLL_MS, remaining)));
  }
  if (shouldAbort()) throw cancelledError();
}

/**
 * Wrap a `Completer` with bounded exponential backoff for transient
 * provider failures. Abort always wins: no first attempt, no further
 * retries, and no sleeping past cancellation.
 */
export function withTransientRetry(complete: Completer, options: TransientRetryOptions): Completer {
  const {
    shouldAbort,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    sleep,
  } = options;
  return async (messages, onChunk) => {
    let retryIndex = 0;
    for (;;) {
      if (shouldAbort()) throw cancelledError();
      try {
        return await complete(messages, onChunk);
      } catch (err) {
        if (shouldAbort()) throw cancelledError();
        if (!isRetryableError(err) || retryIndex >= maxRetries) throw err;
        const delay = retryDelayMs(retryIndex, err, baseDelayMs, maxDelayMs);
        retryIndex += 1;
        if (sleep) {
          await sleep(delay);
        } else {
          await abortableSleep(delay, shouldAbort);
        }
      }
    }
  };
}
