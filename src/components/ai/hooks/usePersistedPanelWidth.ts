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
  const max = Math.max(
    0,
    Math.min(MAX_WIDTH_CAP, Math.floor(viewportWidth * MAX_VIEWPORT_FRACTION))
  );
  const min = Math.min(MIN_WIDTH, max);
  if (max === 0) return 0;
  return Math.max(min, Math.min(max, Math.round(width)));
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
  enabled?: boolean;
}

export interface UsePersistedPanelWidthReturn {
  width: number;
  isDragging: boolean;
  onResizePointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  minWidth: number;
  maxWidthCap: number;
}

/** Desktop panel width with localStorage persistence and left-edge drag resize. */
export function usePersistedPanelWidth(
  options: UsePersistedPanelWidthOptions
): UsePersistedPanelWidthReturn {
  const { storageKey, enabled = true } = options;
  const [width, setWidth] = useState(() => readStoredWidth(storageKey));
  const [isDragging, setIsDragging] = useState(false);

  const widthRef = useRef(width);
  const storageKeyRef = useRef(storageKey);
  const mountedRef = useRef(true);
  const enabledRef = useRef(enabled);
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
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teardownDrag();
    };
  }, [teardownDrag]);

  useEffect(() => {
    if (!enabled) {
      teardownDrag();
      return;
    }

    const onResize = () => {
      if (!mountedRef.current) return;
      setWidth(w => clampWidth(w));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [enabled, teardownDrag]);

  useEffect(() => {
    if (!enabled || isDragging || !mountedRef.current) return;
    try {
      localStorage.setItem(storageKey, String(width));
    } catch {
      // ignore
    }
  }, [width, storageKey, enabled, isDragging]);

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabledRef.current || !mountedRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      teardownDrag();

      const handle = e.currentTarget;
      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startWidth = widthRef.current;
      let finished = false;

      try {
        handle.setPointerCapture(pointerId);
      } catch {
        // capture optional
      }

      if (mountedRef.current) {
        setIsDragging(true);
      }
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev: PointerEvent) => {
        if (!mountedRef.current || !enabledRef.current) {
          endDragRef.current?.();
          return;
        }
        const next = clampWidth(startWidth + (startX - ev.clientX));
        setWidth(next);
      };

      const onUp = () => {
        finish(true);
      };

      const onAbort = () => {
        finish(false);
      };

      const onLostCapture = () => {
        finish(false);
      };

      const finish = (persist: boolean) => {
        if (finished) return;
        finished = true;

        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        window.removeEventListener('blur', onAbort);
        window.removeEventListener('pagehide', onAbort);
        handle.removeEventListener('lostpointercapture', onLostCapture);
        endDragRef.current = null;

        try {
          if (handle.hasPointerCapture(pointerId)) {
            handle.releasePointerCapture(pointerId);
          }
        } catch {
          // ignore
        }

        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        if (!mountedRef.current) return;

        setIsDragging(false);

        if (persist && enabledRef.current) {
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

      endDragRef.current = () => finish(false);

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
      window.addEventListener('blur', onAbort);
      window.addEventListener('pagehide', onAbort);
      handle.addEventListener('lostpointercapture', onLostCapture);
    },
    [teardownDrag]
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
