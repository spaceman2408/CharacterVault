/**
 * @fileoverview Custom hook for managing typewriter effect with chunk queues.
 * @module components/ai/hooks/useTypewriter
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Return interface for the useTypewriter hook
 */
export interface UseTypewriterReturn {
  // State
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
  flushQueues: () => void;
  // Raw content (for final message)
  streamingContent: string;
  streamingReasoning: string;
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
 * - The interval-based typewriter effect (30ms per chunk)
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
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');

  // Use refs to track queues for synchronous access within interval
  const contentQueueRef = useRef<string[]>([]);
  const reasoningQueueRef = useRef<string[]>([]);
  const isReasoningCompleteRef = useRef(false);
  const isStreamingRef = useRef(false);
  const isTypingRef = useRef(false);

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

  // Smooth chunk queue display loop - creates typewriter effect
  useEffect(() => {
    // Process chunks at a consistent rate for smooth typing effect
    const intervalId = setInterval(() => {
      const hasContent = contentQueueRef.current.length > 0;
      const hasReasoning = reasoningQueueRef.current.length > 0;
      const currentlyStreaming = isStreamingRef.current;

      // Nothing to process and not streaming
      if (!currentlyStreaming && !hasContent && !hasReasoning) {
        if (isTypingRef.current) {
          setIsTyping(false);
        }
        return;
      }

      // Start typing when there's content in the queue
      if ((hasContent || hasReasoning) && !isTypingRef.current) {
        setIsTyping(true);
      }

      // Process reasoning queue first using ref for immediate access
      if (reasoningQueueRef.current.length > 0) {
        const nextChunk = reasoningQueueRef.current[0];
        const remainingQueue = reasoningQueueRef.current.slice(1);

        // Update both ref and state atomically
        reasoningQueueRef.current = remainingQueue;
        setReasoningChunkQueue(remainingQueue);
        setDisplayedReasoning(prev => prev + nextChunk);
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
        const nextChunk = contentQueueRef.current[0];
        const remainingQueue = contentQueueRef.current.slice(1);

        // Update both ref and state atomically
        contentQueueRef.current = remainingQueue;
        setContentChunkQueue(remainingQueue);
        setDisplayedContent(prev => prev + nextChunk);
      }
    }, 30); // 30ms per chunk for smooth typing feel

    return () => clearInterval(intervalId);
  }, []); // Empty deps - uses refs for all internal state access

  /**
   * Queue a content chunk for display
   */
  const queueContentChunk = useCallback((chunk: string) => {
    const newQueue = [...contentQueueRef.current, chunk];
    contentQueueRef.current = newQueue;
    setContentChunkQueue(newQueue);
    setStreamingContent(prev => prev + chunk);
  }, []);

  /**
   * Queue a reasoning chunk for display
   */
  const queueReasoningChunk = useCallback((chunk: string) => {
    const newQueue = [...reasoningQueueRef.current, chunk];
    reasoningQueueRef.current = newQueue;
    setReasoningChunkQueue(newQueue);
    setStreamingReasoning(prev => prev + chunk);
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
    setStreamingContent('');
    setStreamingReasoning('');
    setIsTyping(false);
    // Reset refs as well
    contentQueueRef.current = [];
    reasoningQueueRef.current = [];
    isReasoningCompleteRef.current = false;
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
   * Flush all remaining chunks immediately
   */
  const flushQueues = useCallback(() => {
    // Mark reasoning as complete when flushing (if there was reasoning)
    const currentDisplayedReasoning = displayedReasoning;
    const currentStreamingContent = streamingContent;
    const currentStreamingReasoning = streamingReasoning;

    if (currentDisplayedReasoning || reasoningQueueRef.current.length > 0) {
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

    // Ensure displayed content is at least as complete as streaming content
    setDisplayedContent(prev => prev.length < currentStreamingContent.length ? currentStreamingContent : prev);
    setDisplayedReasoning(prev => prev.length < currentStreamingReasoning.length ? currentStreamingReasoning : prev);

    setIsTyping(false);
  }, [displayedReasoning, streamingContent, streamingReasoning]);

  return {
    // State
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
    flushQueues,
    // Raw content
    streamingContent,
    streamingReasoning,
  };
}

export default useTypewriter;
