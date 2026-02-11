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
/** Threshold in pixels for considering user "near the bottom" */
const NEAR_BOTTOM_THRESHOLD = 150;

export function useAutoScroll(options: UseAutoScrollOptions): UseAutoScrollReturn {
  const { isStreaming, isTyping = false, dependencies = [] } = options;

  const containerRef = useRef<HTMLDivElement>(null);

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

      // Only auto-scroll if user is near the bottom (within threshold)
      // This allows users to scroll up and read earlier messages without being forced back down
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < NEAR_BOTTOM_THRESHOLD;

      if (isNearBottom) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, isTyping, ...dependencies]);

  return {
    containerRef,
    scrollToBottom,
  };
}

export default useAutoScroll;
