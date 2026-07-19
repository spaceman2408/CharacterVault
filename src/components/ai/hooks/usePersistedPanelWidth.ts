/**
 * @fileoverview Persist and clamp a panel width for desktop side docks.
 * @module components/ai/hooks/usePersistedPanelWidth
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

const DEFAULT_WIDTH = 384;
const MIN_WIDTH = 320;
const MAX_WIDTH_CAP = 720;
const MAX_VIEWPORT_FRACTION = 0.45;

function clampWidth(width: number, viewportWidth = window.innerWidth): number {
  const max = Math.min(MAX_WIDTH_CAP, Math.floor(viewportWidth * MAX_VIEWPORT_FRACTION));
  return Math.max(MIN_WIDTH, Math.min(max, Math.round(width)));
}

function readStoredWidth(storageKey: string): number {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_WIDTH;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_WIDTH;
    return clampWidth(parsed);
  } catch {
    return DEFAULT_WIDTH;
  }
}

export interface UsePersistedPanelWidthOptions {
  storageKey: string;
  /** When false, pointer handlers no-op (e.g. mobile). */
  enabled?: boolean;
}

export interface UsePersistedPanelWidthReturn {
  width: number;
  isDragging: boolean;
  /** Attach to the drag handle (left edge of a right dock). */
  onResizePointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  minWidth: number;
  maxWidthCap: number;
}

/**
 * Desktop panel width with localStorage persistence and left-edge drag resize.
 * Dragging left increases width (right dock grows into the editor).
 */
export function usePersistedPanelWidth(
  options: UsePersistedPanelWidthOptions
): UsePersistedPanelWidthReturn {
  const { storageKey, enabled = true } = options;
  const [width, setWidth] = useState(() => readStoredWidth(storageKey));
  const [isDragging, setIsDragging] = useState(false);

  const widthRef = useRef(width);
  const storageKeyRef = useRef(storageKey);

  /** Active drag teardown (listeners + body styles). */
  const endDragRef = useRef<(() => void) | null>(null);

  const teardownDrag = useCallback(() => {
    endDragRef.current?.();
    endDragRef.current = null;
  }, []);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    storageKeyRef.current = storageKey;
  }, [storageKey]);

  useEffect(() => {
    if (!enabled) return;
    const onResize = () => {
      setWidth(w => clampWidth(w));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [enabled]);

  // Persist when not mid-drag
  useEffect(() => {
    if (!enabled || isDragging) return;
    try {
      localStorage.setItem(storageKey, String(width));
    } catch {
      // ignore quota / private mode
    }
  }, [width, storageKey, enabled, isDragging]);

  // Abort drag if disabled (e.g. mobile breakpoint) or on unmount — avoids stuck body styles / listeners
  useEffect(() => {
    if (!enabled) {
      teardownDrag();
    }
    return () => {
      teardownDrag();
    };
  }, [enabled, teardownDrag]);

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();

      // Replace any prior incomplete drag
      teardownDrag();

      const handle = e.currentTarget;
      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startWidth = widthRef.current;
      let finished = false;

      try {
        handle.setPointerCapture(pointerId);
      } catch {
        // Some browsers throw if capture fails; document listeners still work
      }

      setIsDragging(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev: PointerEvent) => {
        // Right dock: drag handle leftward (negative delta) → wider panel
        const next = clampWidth(startWidth + (startX - ev.clientX));
        setWidth(next);
      };

      const finish = (persist: boolean) => {
        if (finished) return;
        finished = true;

        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        endDragRef.current = null;

        try {
          if (handle.hasPointerCapture(pointerId)) {
            handle.releasePointerCapture(pointerId);
          }
        } catch {
          // element may already be gone
        }

        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setIsDragging(false);

        if (persist) {
          setWidth(w => {
            const clamped = clampWidth(w);
            try {
              localStorage.setItem(storageKeyRef.current, String(clamped));
            } catch {
              // ignore
            }
            return clamped;
          });
        }
      };

      const onUp = () => {
        finish(true);
      };

      endDragRef.current = () => finish(false);

      // Listen on document so teardown still works if the handle unmounts mid-drag
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    },
    [enabled, teardownDrag]
  );

  return {
    width,
    isDragging,
    onResizePointerDown,
    minWidth: MIN_WIDTH,
    maxWidthCap: MAX_WIDTH_CAP,
  };
}

export default usePersistedPanelWidth;
