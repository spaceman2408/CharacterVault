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
  const ignoreScrollRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  const cancelPinRaf = useCallback(() => {
    if (pinRafRef.current !== null) {
      cancelAnimationFrame(pinRafRef.current);
      pinRafRef.current = null;
    }
  }, []);

  const pinToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el || !stickToBottomRef.current) return;

    ignoreScrollRef.current = true;
    el.scrollTop = el.scrollHeight;
    lastScrollTopRef.current = el.scrollTop;
    void Promise.resolve().then(() => {
      ignoreScrollRef.current = false;
    });
  }, []);

  const schedulePin = useCallback(() => {
    if (!stickToBottomRef.current) return;
    cancelPinRaf();
    pinRafRef.current = requestAnimationFrame(() => {
      pinRafRef.current = requestAnimationFrame(() => {
        pinRafRef.current = null;
        pinToBottom();
      });
    });
  }, [cancelPinRaf, pinToBottom]);

  const releaseStick = useCallback(() => {
    stickToBottomRef.current = false;
    cancelPinRaf();
  }, [cancelPinRaf]);

  const scrollToBottom = useCallback(
    (behavior: 'auto' | 'smooth' = 'auto') => {
      stickToBottomRef.current = true;
      const el = containerRef.current;
      if (!el) return;

      if (behavior === 'smooth' && !isStreaming && !isTyping) {
        ignoreScrollRef.current = true;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        lastScrollTopRef.current = el.scrollHeight;
        void Promise.resolve().then(() => {
          ignoreScrollRef.current = false;
        });
        return;
      }

      pinToBottom();
    },
    [isStreaming, isTyping, pinToBottom]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    lastScrollTopRef.current = el.scrollTop;

    const onScroll = () => {
      if (ignoreScrollRef.current) {
        lastScrollTopRef.current = el.scrollTop;
        return;
      }

      const top = el.scrollTop;
      const movedUp = top < lastScrollTopRef.current - 1;
      lastScrollTopRef.current = top;

      if (movedUp) {
        stickToBottomRef.current = false;
        return;
      }

      if (distanceFromBottom(el) <= REJOIN_BOTTOM_THRESHOLD) {
        stickToBottomRef.current = true;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        releaseStick();
      } else if (e.deltaY > 0 && distanceFromBottom(el) <= REJOIN_BOTTOM_THRESHOLD) {
        stickToBottomRef.current = true;
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

    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('keydown', onKeyDown);
    };
  }, [releaseStick]);

  useEffect(() => {
    schedulePin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, isTyping, schedulePin, ...dependencies]);

  useEffect(() => {
    if (isStreaming) {
      stickToBottomRef.current = true;
      schedulePin();
    }
  }, [isStreaming, schedulePin]);

  useEffect(() => {
    return () => cancelPinRaf();
  }, [cancelPinRaf]);

  return {
    containerRef,
    scrollToBottom,
  };
}

export default useAutoScroll;
