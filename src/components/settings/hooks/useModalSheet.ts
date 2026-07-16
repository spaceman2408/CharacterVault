/**
 * Shared lifecycle for settings picker sheets (model / provider / prompt routing).
 * Handles body scroll lock and Escape with proper cleanup on close/unmount.
 */

import { useEffect, useRef } from 'react';

/**
 * While `isOpen` is true:
 * - Locks `document.body` scroll (restored on close or unmount)
 * - Listens for Escape in the capture phase so the settings panel Escape handler
 *   does not also fire and unmount the panel mid-sheet
 */
export function useModalSheet(isOpen: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onCloseRef.current();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen]);
}

/**
 * Focus an element shortly after open; timeout is always cleared on close/unmount.
 */
export function useFocusOnOpen(
  isOpen: boolean,
  targetRef: React.RefObject<HTMLElement | null>,
  delayMs = 50
): void {
  useEffect(() => {
    if (!isOpen) return;

    const id = window.setTimeout(() => {
      targetRef.current?.focus({ preventScroll: true });
    }, delayMs);

    return () => window.clearTimeout(id);
  }, [isOpen, targetRef, delayMs]);
}
