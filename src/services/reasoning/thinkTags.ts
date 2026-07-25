/**
 * Inline think-tag reasoning (content-embedded).
 *
 * To support a new tag pair (e.g. another channel marker):
 * 1. Add start/end to {@link THINK_TAG_PAIRS}.
 * 2. Add a fixture test for full and split-across-chunks streams.
 */

import type { InlineTagParseResult } from './types';

export interface ThinkTagPair {
  start: string;
  end: string;
}

/**
 * Known think / channel markers. Matching is case-insensitive for XML-like tags.
 * Gemma-style channel tokens are matched as lowercase substrings of a lowercased buffer.
 */
export const THINK_TAG_PAIRS: readonly ThinkTagPair[] = [
  { start: '<think>', end: '</think>' },
  { start: '<thinking>', end: '</thinking>' },
  { start: '<reasoning>', end: '</reasoning>' },
  { start: '<thought>', end: '</thought>' },
  { start: '<|channel>thought', end: '<channel|>' },
];

export const THINK_START_VARIATIONS = THINK_TAG_PAIRS.map((p) => p.start);
export const THINK_END_VARIATIONS = THINK_TAG_PAIRS.map((p) => p.end);

export function findThinkTag(
  buffer: string,
  startIndex = 0
): { index: number; tag: string } | null {
  const lowerBuffer = buffer.toLowerCase();
  let bestMatch: { index: number; tag: string } | null = null;

  for (const tag of THINK_START_VARIATIONS) {
    const index = lowerBuffer.indexOf(tag.toLowerCase(), startIndex);
    if (index !== -1 && (bestMatch === null || index < bestMatch.index)) {
      bestMatch = { index, tag };
    }
  }

  return bestMatch;
}

export function findCloseTag(
  buffer: string,
  startIndex = 0
): { index: number; tag: string } | null {
  const lowerBuffer = buffer.toLowerCase();
  let bestMatch: { index: number; tag: string } | null = null;

  for (const tag of THINK_END_VARIATIONS) {
    const index = lowerBuffer.indexOf(tag.toLowerCase(), startIndex);
    if (index !== -1 && (bestMatch === null || index < bestMatch.index)) {
      bestMatch = { index, tag };
    }
  }

  return bestMatch;
}

/** Complete-string parse (non-stream / strip tags from content). */
export function parseInlineTags(text: string): InlineTagParseResult {
  let resultText = '';
  let resultReasoning = '';
  let remaining = text;

  while (remaining.length > 0) {
    const openMatch = findThinkTag(remaining);

    if (openMatch === null) {
      resultText += remaining;
      break;
    }

    resultText += remaining.slice(0, openMatch.index);

    const closeMatch = findCloseTag(remaining, openMatch.index + openMatch.tag.length);

    if (closeMatch === null) {
      resultReasoning += remaining.slice(openMatch.index + openMatch.tag.length);
      break;
    }

    resultReasoning += remaining.slice(
      openMatch.index + openMatch.tag.length,
      closeMatch.index
    );

    remaining = remaining.slice(closeMatch.index + closeMatch.tag.length);
  }

  return {
    text: resultText,
    reasoning: resultReasoning,
  };
}

export interface ThinkTagStreamState {
  buffer: string;
  isInThinkBlock: boolean;
  mainContent: string;
  reasoningContent: string;
}

export function createThinkTagStreamState(): ThinkTagStreamState {
  return {
    buffer: '',
    isInThinkBlock: false,
    mainContent: '',
    reasoningContent: '',
  };
}

/**
 * Append content and process think tags. Mutates state.
 * Leaves a partial-tag suffix in the buffer when tags may be split across chunks.
 */
export function appendThinkTagContent(state: ThinkTagStreamState, content: string): void {
  if (!content) return;
  state.buffer += content;
  processThinkTagBuffer(state);
}

function processThinkTagBuffer(state: ThinkTagStreamState): void {
  while (state.buffer.length > 0) {
    if (state.isInThinkBlock) {
      const closeMatch = findCloseTag(state.buffer);

      if (closeMatch === null) {
        const maxCloseTagLen = Math.max(...THINK_END_VARIATIONS.map((t) => t.length));
        const keepInBuffer = Math.min(state.buffer.length, maxCloseTagLen - 1);
        const processContent = state.buffer.slice(0, state.buffer.length - keepInBuffer);
        state.reasoningContent += processContent;
        state.buffer = state.buffer.slice(state.buffer.length - keepInBuffer);
        break;
      }

      state.reasoningContent += state.buffer.slice(0, closeMatch.index);
      state.buffer = state.buffer.slice(closeMatch.index + closeMatch.tag.length);
      state.isInThinkBlock = false;
    } else {
      const openMatch = findThinkTag(state.buffer);

      if (openMatch === null) {
        const maxOpenTagLen = Math.max(...THINK_START_VARIATIONS.map((t) => t.length));
        const keepInBuffer = Math.min(state.buffer.length, maxOpenTagLen - 1);
        const processContent = state.buffer.slice(0, state.buffer.length - keepInBuffer);
        state.mainContent += processContent;
        state.buffer = state.buffer.slice(state.buffer.length - keepInBuffer);
        break;
      }

      state.mainContent += state.buffer.slice(0, openMatch.index);
      state.buffer = state.buffer.slice(openMatch.index + openMatch.tag.length);
      state.isInThinkBlock = true;
    }
  }
}

/** Flush remaining buffer into content or reasoning. */
export function flushThinkTagState(state: ThinkTagStreamState): void {
  if (state.buffer.length === 0) return;
  if (state.isInThinkBlock) {
    state.reasoningContent += state.buffer;
  } else {
    state.mainContent += state.buffer;
  }
  state.buffer = '';
}

export function resetThinkTagState(state: ThinkTagStreamState): void {
  state.buffer = '';
  state.isInThinkBlock = false;
  state.mainContent = '';
  state.reasoningContent = '';
}
