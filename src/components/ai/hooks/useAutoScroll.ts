/**
 * @fileoverview Stick-to-bottom auto-scroll for the Orion chat list.
 * @module components/ai/hooks/useAutoScroll
 */

import { useEffect, useRef, useCallback } from 'react';

export interface UseAutoScrollOptions {
  isStreaming: boolean;
  isTyping?: boolean;
  dependencies?: unknown[];
}

export interface UseAutoScrollReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  scrollToBottom: (behavior?: 'auto' | 'smooth') => void;
}

const REJOIN_BOTTOM_THRESHOLD = 48;

function distanceFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

export function useAutoScroll(options: UseAutoScrollOptions): UseAutoScrollReturn {
  const { isStreaming, isTyping = false, dependencies = [] } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const pinRafRef = useRef<number | null>(null);
  const smoothIgnoreRef = useRef(false);
  const smoothIgnoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPinRaf = useCallback(() => {
    if (pinRafRef.current !== null) {
      cancelAnimationFrame(pinRafRef.current);
      pinRafRef.current = null;
    }
  }, []);

  const pinToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const schedulePin = useCallback(() => {
    if (!stickToBottomRef.current) return;
    if (pinRafRef.current !== null) return;
    pinRafRef.current = requestAnimationFrame(() => {
      pinRafRef.current = null;
      pinToBottom();
    });
  }, [pinToBottom]);

  const pinSyncAndSchedule = useCallback(() => {
    if (!stickToBottomRef.current) return;
    pinToBottom();
    schedulePin();
  }, [pinToBottom, schedulePin]);

  const releaseStick = useCallback(() => {
    stickToBottomRef.current = false;
  }, []);

  const scrollToBottom = useCallback(
    (behavior: 'auto' | 'smooth' = 'auto') => {
      stickToBottomRef.current = true;
      const el = containerRef.current;
      if (!el) return;

      if (behavior === 'smooth' && !isStreaming && !isTyping) {
        smoothIgnoreRef.current = true;
        if (smoothIgnoreTimerRef.current !== null) {
          clearTimeout(smoothIgnoreTimerRef.current);
        }
        smoothIgnoreTimerRef.current = setTimeout(() => {
          smoothIgnoreRef.current = false;
          smoothIgnoreTimerRef.current = null;
          pinToBottom();
        }, 600);
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        return;
      }

      pinSyncAndSchedule();
    },
    [isStreaming, isTyping, pinSyncAndSchedule, pinToBottom]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      if (smoothIgnoreRef.current) return;
      stickToBottomRef.current = distanceFromBottom(el) <= REJOIN_BOTTOM_THRESHOLD;
    };

    const onWheel = (e: WheelEvent) => {
      if (smoothIgnoreRef.current) return;
      if (e.deltaY < 0) {
        releaseStick();
      } else if (e.deltaY > 0) {
        if (distanceFromBottom(el) <= REJOIN_BOTTOM_THRESHOLD) {
          stickToBottomRef.current = true;
        }
      }
    };

    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      if (y - touchStartY > 8) {
        releaseStick();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PageUp' || e.key === 'Home' || e.key === 'ArrowUp') {
        releaseStick();
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('keydown', onKeyDown);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        schedulePin();
      });
      resizeObserver.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('keydown', onKeyDown);
      resizeObserver?.disconnect();
    };
  }, [releaseStick, schedulePin]);

  useEffect(() => {
    pinSyncAndSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, isTyping, pinSyncAndSchedule, ...dependencies]);

  useEffect(() => {
    if (isStreaming) {
      stickToBottomRef.current = true;
      pinSyncAndSchedule();
    }
  }, [isStreaming, pinSyncAndSchedule]);

  useEffect(() => {
    return () => {
      cancelPinRaf();
      if (smoothIgnoreTimerRef.current !== null) {
        clearTimeout(smoothIgnoreTimerRef.current);
        smoothIgnoreTimerRef.current = null;
      }
    };
  }, [cancelPinRaf]);

  return {
    containerRef,
    scrollToBottom,
  };
}

export default useAutoScroll;
