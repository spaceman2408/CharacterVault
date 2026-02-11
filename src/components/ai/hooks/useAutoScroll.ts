/**
 * @fileoverview Custom hook for managing auto-scroll behavior in chat containers.
 * @module components/ai/hooks/useAutoScroll
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * Options for the useAutoScroll hook
 */
export interface UseAutoScrollOptions {
  /** Whether streaming is currently active */
  isStreaming: boolean;
  /** Whether typewriter is still displaying content (continues after streaming ends) */
  isTyping?: boolean;
  /** Additional dependencies that should trigger auto-scroll */
  dependencies?: unknown[];
}

/**
 * Return interface for the useAutoScroll hook
 */
export interface UseAutoScrollReturn {
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Programmatically scroll to bottom */
  scrollToBottom: (behavior?: 'auto' | 'smooth') => void;
}

/**
 * Hook that manages auto-scroll behavior for chat containers.
 * 
 * This hook handles:
 * - User scroll detection (tracking if user scrolled up)
 * - Auto-scroll during streaming
 * - Scroll event handlers
 * - Smooth scroll behavior
 * 
 * @param options - Configuration options for the hook
 * @returns Object containing the container ref and scroll control functions
 * 
 * @example
 * ```tsx
 * const autoScroll = useAutoScroll({
 *   isStreaming: isStreaming,
 *   dependencies: [chatHistory, displayedContent]
 * });
 * 
 * return (
 *   <div ref={autoScroll.containerRef}>
 *     {messages}
 *   </div>
 * );
 * ```
 */
export function useAutoScroll(options: UseAutoScrollOptions): UseAutoScrollReturn {
  const { isStreaming, isTyping = false, dependencies = [] } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);

  /**
   * Scroll to the bottom of the container
   */
  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'smooth') => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  // Auto-scroll chat to bottom when new messages arrive or displayed content changes
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;

      // During streaming or typing, always scroll to bottom aggressively
      // When not streaming/typing, only scroll if user is near the bottom
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

      if (isStreaming || isTyping || (!userScrolledUpRef.current && isNearBottom)) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, isTyping, ...dependencies]);

  // Detect when user scrolls up to disable auto-scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      userScrolledUpRef.current = !isNearBottom;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return {
    containerRef,
    scrollToBottom,
  };
}

export default useAutoScroll;
