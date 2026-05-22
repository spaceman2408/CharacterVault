/**
 * @fileoverview Custom hook for managing typewriter effect with chunk queues.
 * @module components/ai/hooks/useTypewriter
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const TYPEWRITER_INTERVAL_MS = 24;
const CONTENT_CHARS_PER_TICK = 4;
const REASONING_CHARS_PER_TICK = 10;
const LARGE_BACKLOG_THRESHOLD = 1200;

/**
 * Pulls a small, readable slice from the queue. Incoming provider chunks can be
 * wildly different sizes, so pacing by queue item makes large chunks flash in.
 */
function takeTextSlice(queue: string[], maxChars: number): { slice: string; queue: string[] } {
  if (queue.length === 0) {
    return { slice: '', queue };
  }

  const [firstChunk, ...remainingQueue] = queue;

  if (firstChunk.length <= maxChars) {
    return { slice: firstChunk, queue: remainingQueue };
  }

  let sliceEnd = maxChars;
  const punctuationWindow = firstChunk.slice(maxChars, maxChars + 8).search(/[,.!?;:\s]/);

  if (punctuationWindow >= 0) {
    sliceEnd = maxChars + punctuationWindow + 1;
  }

  return {
    slice: firstChunk.slice(0, sliceEnd),
    queue: [firstChunk.slice(sliceEnd), ...remainingQueue],
  };
}

function queuedCharacterCount(queue: string[]): number {
  return queue.reduce((total, chunk) => total + chunk.length, 0);
}

/**
 * Return interface for the useTypewriter hook
 */
export interface UseTypewriterReturn {
  // State (for React JSX consumption)
  displayedContent: string;
  displayedReasoning: string;
  isTyping: boolean;
  isReasoningComplete: boolean;
  // Queue management
  queueContentChunk: (chunk: string) => void;
  queueReasoningChunk: (chunk: string) => void;
  markReasoningComplete: () => void;
  // Control
  startStreaming: () => void;
  stopStreaming: () => void;
  drainQueues: () => Promise<void>;
  flushQueues: () => void;
}

/**
 * Hook that manages the typewriter effect with chunk queues for smooth streaming display.
 * 
 * This hook handles:
 * - Content and reasoning chunk queues
 * - Displayed content and reasoning state
 * - Typing state
 * - Reasoning complete state
 * - Refs for synchronous access within intervals
 * - The interval-based typewriter effect with paced character slices
 * 
 * @returns Object containing state and control functions for the typewriter effect
 * 
 * @example
 * ```tsx
 * const typewriter = useTypewriter();
 * 
 * // Start streaming
 * typewriter.startStreaming();
 * 
 * // Queue chunks as they arrive
 * typewriter.queueReasoningChunk("Thinking...");
 * typewriter.queueContentChunk("Hello!");
 * 
 * // Mark reasoning as complete when content starts
 * typewriter.markReasoningComplete();
 * 
 * // Stop streaming and flush remaining chunks
 * typewriter.stopStreaming();
 * typewriter.flushQueues();
 * ```
 */
export function useTypewriter(): UseTypewriterReturn {
  // Chunk queue system for smooth typewriter effect
  const [contentChunkQueue, setContentChunkQueue] = useState<string[]>([]);
  const [reasoningChunkQueue, setReasoningChunkQueue] = useState<string[]>([]);
  const [displayedContent, setDisplayedContent] = useState('');
  const [displayedReasoning, setDisplayedReasoning] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isReasoningComplete, setIsReasoningComplete] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  // Use refs for raw streaming buffers to avoid re-render thrashing
  // (these are exposed for debugging but not consumed by JSX)
  const streamingContentRef = useRef('');
  const streamingReasoningRef = useRef('');

  // Use refs to track queues for synchronous access within interval
  const contentQueueRef = useRef<string[]>([]);
  const reasoningQueueRef = useRef<string[]>([]);
  const isReasoningCompleteRef = useRef(false);
  const isStreamingRef = useRef(false);
  const isTypingRef = useRef(false);
  const drainResolversRef = useRef<Array<() => void>>([]);

  const resolveDrainIfIdle = useCallback(() => {
    if (
      contentQueueRef.current.length === 0 &&
      reasoningQueueRef.current.length === 0 &&
      drainResolversRef.current.length > 0
    ) {
      const resolvers = drainResolversRef.current;
      drainResolversRef.current = [];
      resolvers.forEach(resolve => resolve());
    }
  }, []);

  // Keep refs in sync with state
  useEffect(() => {
    contentQueueRef.current = contentChunkQueue;
  }, [contentChunkQueue]);

  useEffect(() => {
    reasoningQueueRef.current = reasoningChunkQueue;
  }, [reasoningChunkQueue]);

  useEffect(() => {
    isReasoningCompleteRef.current = isReasoningComplete;
  }, [isReasoningComplete]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    isTypingRef.current = isTyping;
  }, [isTyping]);

  // Smooth queue display loop - creates typewriter effect
  useEffect(() => {
    // Process text at a consistent rate for smooth typing effect
    const intervalId = setInterval(() => {
      const hasContent = contentQueueRef.current.length > 0;
      const hasReasoning = reasoningQueueRef.current.length > 0;
      const currentlyStreaming = isStreamingRef.current;

      // Nothing to process and not streaming
      if (!currentlyStreaming && !hasContent && !hasReasoning) {
        if (isTypingRef.current) {
          setIsTyping(false);
        }
        resolveDrainIfIdle();
        return;
      }

      // Start typing when there's content in the queue
      if ((hasContent || hasReasoning) && !isTypingRef.current) {
        setIsTyping(true);
      }

      // Process reasoning queue first using ref for immediate access. Reasoning is
      // intentionally a little faster so the actual response does not feel delayed.
      if (reasoningQueueRef.current.length > 0) {
        const { slice, queue } = takeTextSlice(
          reasoningQueueRef.current,
          REASONING_CHARS_PER_TICK
        );

        // Update both ref and state atomically
        reasoningQueueRef.current = queue;
        setReasoningChunkQueue(queue);
        setDisplayedReasoning(prev => prev + slice);
      }

      // Only process content queue if:
      // 1. Reasoning is marked complete AND
      // 2. The reasoning queue is actually empty (all reasoning has been displayed)
      // This ensures reasoning fully completes before content starts displaying
      if (
        isReasoningCompleteRef.current &&
        reasoningQueueRef.current.length === 0 &&
        contentQueueRef.current.length > 0
      ) {
        const backlog = queuedCharacterCount(contentQueueRef.current);
        const maxChars =
          backlog > LARGE_BACKLOG_THRESHOLD
            ? CONTENT_CHARS_PER_TICK * 2
            : CONTENT_CHARS_PER_TICK;
        const { slice, queue } = takeTextSlice(contentQueueRef.current, maxChars);

        // Update both ref and state atomically
        contentQueueRef.current = queue;
        setContentChunkQueue(queue);
        setDisplayedContent(prev => prev + slice);
      }

      resolveDrainIfIdle();
    }, TYPEWRITER_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [resolveDrainIfIdle]); // Uses refs for internal state access

  /**
   * Queue a content chunk for display
   */
  const queueContentChunk = useCallback((chunk: string) => {
    const newQueue = [...contentQueueRef.current, chunk];
    contentQueueRef.current = newQueue;
    setContentChunkQueue(newQueue);
    // Update ref instead of state to avoid re-render thrashing
    streamingContentRef.current += chunk;
  }, []);

  /**
   * Queue a reasoning chunk for display
   */
  const queueReasoningChunk = useCallback((chunk: string) => {
    const newQueue = [...reasoningQueueRef.current, chunk];
    reasoningQueueRef.current = newQueue;
    setReasoningChunkQueue(newQueue);
    // Update ref instead of state to avoid re-render thrashing
    streamingReasoningRef.current += chunk;
  }, []);

  /**
   * Mark reasoning as complete, allowing content chunks to be displayed
   */
  const markReasoningComplete = useCallback(() => {
    isReasoningCompleteRef.current = true;
    setIsReasoningComplete(true);
  }, []);

  /**
   * Start streaming mode - resets all state for a new streaming session
   */
  const startStreaming = useCallback(() => {
    // Reset all state
    setDisplayedContent('');
    setDisplayedReasoning('');
    setContentChunkQueue([]);
    setReasoningChunkQueue([]);
    setIsReasoningComplete(false);
    setIsTyping(false);
    // Reset refs as well (including streaming buffers)
    contentQueueRef.current = [];
    reasoningQueueRef.current = [];
    isReasoningCompleteRef.current = false;
    streamingContentRef.current = '';
    streamingReasoningRef.current = '';
    // Start streaming
    setIsStreaming(true);
  }, []);

  /**
   * Stop streaming mode
   */
  const stopStreaming = useCallback(() => {
    setIsStreaming(false);
  }, []);

  /**
   * Let queued chunks finish displaying at the normal typewriter pace.
   */
  const drainQueues = useCallback(() => {
    if (contentQueueRef.current.length === 0 && reasoningQueueRef.current.length === 0) {
      return Promise.resolve();
    }

    return new Promise<void>(resolve => {
      drainResolversRef.current = [...drainResolversRef.current, resolve];
    });
  }, []);

  /**
   * Flush all remaining chunks immediately
   */
  const flushQueues = useCallback(() => {
    // Mark reasoning as complete when flushing (if there was reasoning)
    if (displayedReasoning || reasoningQueueRef.current.length > 0) {
      isReasoningCompleteRef.current = true;
      setIsReasoningComplete(true);
    }

    // Flush any remaining queue content immediately
    if (reasoningQueueRef.current.length > 0) {
      const remainingReasoning = reasoningQueueRef.current.join('');
      setDisplayedReasoning(prev => prev + remainingReasoning);
      reasoningQueueRef.current = [];
      setReasoningChunkQueue([]);
    }

    if (contentQueueRef.current.length > 0) {
      const remainingContent = contentQueueRef.current.join('');
      setDisplayedContent(prev => prev + remainingContent);
      contentQueueRef.current = [];
      setContentChunkQueue([]);
    }

    drainResolversRef.current.forEach(resolve => resolve());
    drainResolversRef.current = [];

    // Ensure displayed content is at least as complete as streaming content (using refs to avoid stale closures)
    setDisplayedContent(prev => prev.length < streamingContentRef.current.length ? streamingContentRef.current : prev);
    setDisplayedReasoning(prev => prev.length < streamingReasoningRef.current.length ? streamingReasoningRef.current : prev);

    setIsTyping(false);
  }, [displayedReasoning]); // Only depend on displayedReasoning for the initial check

  return {
    // State (for React JSX consumption)
    displayedContent,
    displayedReasoning,
    isTyping,
    isReasoningComplete,
    // Queue management
    queueContentChunk,
    queueReasoningChunk,
    markReasoningComplete,
    // Control
    startStreaming,
    stopStreaming,
    drainQueues,
    flushQueues,
  };
}

export default useTypewriter;
