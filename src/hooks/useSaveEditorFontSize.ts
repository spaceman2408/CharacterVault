import { useCallback, useEffect, useRef } from 'react';
import { characterSettingsService } from '../services/CharacterSettingsService';

const SAVE_DELAY_MS = 400;

/**
 * Saves the editor font size once changes settle, so holding an arrow key or
 * Ctrl+= writes once. A pending save still lands on unmount or page hide.
 */
export function useSaveEditorFontSize(): (size: number) => void {
  const pendingRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const size = pendingRef.current;
    if (size === null) return;
    pendingRef.current = null;
    characterSettingsService.saveEditorFontSize(size).catch((error: unknown) => {
      console.error('Failed to save font size:', error);
    });
  }, []);

  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  return useCallback((size: number) => {
    pendingRef.current = size;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);
}
