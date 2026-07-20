/**
 * @fileoverview Stick-to-bottom auto-scroll for the Orion chat list.
 * @module components/ai/hooks/useAutoScroll
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * Options for the useAutoScroll hook
 */
export interface UseAutoScrollOptions {
  /** Whether streaming is currently active */
  isStreaming: boolean;
  /** Optional secondary activity flag */
  isTyping?: boolean;
  /** Content/history signals that should re-pin when stuck to bottom */
  dependencies?: unknown[];
}

/**
 * Return interface for the useAutoScroll hook
 */
export interface UseAutoScrollReturn {
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Programmatically scroll to bottom (also re-enables stick-to-bottom) */
  scrollToBottom: (behavior?: 'auto' | 'smooth') => void;
}

/** Only re-join stick mode when this close to the bottom (px). */
const REJOIN_BOTTOM_THRESHOLD = 48;

function distanceFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

/**
 * Follow the bottom while the user wants that; release immediately on any
 * intentional scroll-up gesture. Pins only when content changes — no per-frame
 * force-scroll (that made scrolling up feel like fighting the UI).
 */
export function useAutoScroll(options: UseAutoScrollOptions): UseAutoScrollReturn {
  const { isStreaming, isTyping = false, dependencies = [] } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const pinRafRef = useRef<number | null>(null);
  /** Skip stick updates for scroll events caused by our own pin. */
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
    // scroll event is sync in most browsers for scrollTop assign; clear next task
    void Promise.resolve().then(() => {
      ignoreScrollRef.current = false;
    });
  }, []);

  const schedulePin = useCallback(() => {
    if (!stickToBottomRef.current) return;
    cancelPinRaf();
    // Double rAF: after React commit + layout so scrollHeight is current
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

  // User gestures + scroll position: release stick on any upward intent
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
        // Any real upward movement ends follow mode immediately
        stickToBottomRef.current = false;
        return;
      }

      // Scrolling down: rejoin only when close to the bottom
      if (distanceFromBottom(el) <= REJOIN_BOTTOM_THRESHOLD) {
        stickToBottomRef.current = true;
      }
    };

    // Wheel / trackpad: release *before* the browser applies the delta so the
    // next content pin cannot snap them back on the same frame.
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        releaseStick();
      } else if (e.deltaY > 0 && distanceFromBottom(el) <= REJOIN_BOTTOM_THRESHOLD) {
        stickToBottomRef.current = true;
      }
    };

    // Touch: finger moving down on content = scroll up in most UIs; release on
    // any touchstart inside the scroller so the user always wins mid-stream.
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      // Finger dragged down → content scrolls up
      if (y - touchStartY > 8) {
        releaseStick();
      }
    };

    // Keyboard: PageUp / Home / ArrowUp while focused in the panel
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

  // Pin only when content/history actually changes — not every animation frame
  useEffect(() => {
    schedulePin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, isTyping, schedulePin, ...dependencies]);

  // New stream turn: re-stick so the reply is followed from the start
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
