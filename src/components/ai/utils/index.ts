/**
 * @fileoverview Utility functions for AI chat components.
 * @module components/ai/utils
 */

import { estimateTokens } from '../../../services/AIService';
import type { ResponseStats } from '../types';

/**
 * Format timestamp for display
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Unique message id. Prefers UUID; falls back to timestamp + random. */
export function generateMessageId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return `msg_${cryptoObj.randomUUID()}`;
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export const LIVE_REASONING_FLUSH_MS = 80;
export const LIVE_REASONING_MAX_CHARS = 6000;
export const LIVE_CONTENT_MAX_CHARS = 8000;

export const COMMIT_REASONING_MAX_CHARS = 20000;

export function clipLiveReasoning(text: string): string {
  if (text.length <= LIVE_REASONING_MAX_CHARS) return text;
  return `…${text.slice(-LIVE_REASONING_MAX_CHARS)}`;
}

/** Live Orion draft only; committed history keeps the full buffer. */
export function clipLiveContent(text: string): string {
  if (text.length <= LIVE_CONTENT_MAX_CHARS) return text;
  return `…${text.slice(-LIVE_CONTENT_MAX_CHARS)}`;
}

/** Committed thinking is display-only (never resent to the model); keep a generous tail. */
export function clipCommitReasoning(text?: string): string | undefined {
  if (!text) return undefined;
  if (text.length <= COMMIT_REASONING_MAX_CHARS) return text;
  return `…${text.slice(-COMMIT_REASONING_MAX_CHARS)}`;
}

export function canRetryEmptySend(
  chatHistory: ReadonlyArray<{ role: string; content?: string }>,
  showRegenerate: boolean,
): boolean {
  if (!showRegenerate || chatHistory.length === 0) return false;
  const last = chatHistory[chatHistory.length - 1];
  if (last.role === 'user') return true;
  return last.role === 'assistant' && !(last.content ?? '').trim();
}

export interface ResponseTiming {
  requestStartTime: number;
  firstTokenTime: number | null;
  endTime?: number;
  content: string;
  reasoning?: string;
  modelId: string;
  providerId?: string;
}

export interface AccumulatedResponseStats {
  ttft: number;
  tokens: number;
  generationMs: number;
  modelId: string;
  providerId?: string;
}

export function accumulateResponseStats(
  pending: AccumulatedResponseStats | undefined,
  timing: ResponseTiming,
): AccumulatedResponseStats {
  const endTime = timing.endTime ?? Date.now();
  const generationMs =
    timing.firstTokenTime !== null
      ? endTime - timing.firstTokenTime
      : endTime - timing.requestStartTime;
  const ttft =
    timing.firstTokenTime !== null
      ? timing.firstTokenTime - timing.requestStartTime
      : generationMs;
  const tokens = estimateTokens(timing.content) + estimateTokens(timing.reasoning ?? '');

  if (!pending) {
    return {
      ttft,
      tokens,
      generationMs,
      modelId: timing.modelId,
      providerId: timing.providerId,
    };
  }

  return {
    ttft: pending.ttft,
    tokens: pending.tokens + tokens,
    generationMs: pending.generationMs + generationMs,
    modelId: pending.modelId,
    providerId: pending.providerId,
  };
}

export function toResponseStats(
  accumulated: AccumulatedResponseStats,
  options?: { includeTokensPerSecond?: boolean },
): ResponseStats {
  const stats: ResponseStats = {
    ttft: accumulated.ttft,
    modelId: accumulated.modelId,
    providerId: accumulated.providerId,
  };
  if (options?.includeTokensPerSecond !== false && accumulated.generationMs > 0) {
    stats.tokensPerSecond = accumulated.tokens / (accumulated.generationMs / 1000);
  }
  return stats;
}

export function computeResponseStats(
  timing: ResponseTiming,
  options?: { includeTokensPerSecond?: boolean },
): ResponseStats {
  return toResponseStats(accumulateResponseStats(undefined, timing), options);
}

export function abortResponseStats(options: {
  requestStartTime: number;
  firstTokenTime: number | null;
  modelId: string;
  providerId?: string;
}): ResponseStats {
  return {
    ttft:
      options.firstTokenTime !== null
        ? options.firstTokenTime - options.requestStartTime
        : undefined,
    modelId: options.modelId,
    providerId: options.providerId,
  };
}
