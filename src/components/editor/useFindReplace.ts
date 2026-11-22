import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { showEphemeralToast } from '../../utils/ephemeralToast';

const MAX_FIND_PREFILL_LENGTH = 200;

export interface FindReplacePrefill {
  text: string;
  nonce: number;
}

/** Single-line selection in the focused field or editor, for prefilling Find. */
function selectionTextForFind(): string {
  const active = document.activeElement;
  let text = '';
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    text = active.value.slice(active.selectionStart ?? 0, active.selectionEnd ?? 0);
  } else if (active instanceof HTMLElement) {
    const view = EditorView.findFromDOM(active);
    if (view) {
      const { from, to } = view.state.selection.main;
      text = view.state.sliceDoc(from, to);
    }
  }
  if (!text.trim() || /[\r\n]/.test(text) || text.length > MAX_FIND_PREFILL_LENGTH) return '';
  return text;
}

/** Open state, Ctrl/Cmd+Shift+F, and the Undo toast for a workspace's Find & Replace modal. */
export function useFindReplace() {
  const [isOpen, setIsOpen] = useState(false);
  const [prefill, setPrefill] = useState<FindReplacePrefill | null>(null);
  const dismissToastRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== 'f') return;
      if (document.querySelector('[aria-modal="true"]:not([aria-labelledby="find-replace-title"])')) return;
      event.preventDefault();
      event.stopPropagation();
      const selection = selectionTextForFind();
      setPrefill(selection ? { text: selection, nonce: Date.now() } : null);
      setIsOpen(true);
    };
    // Capture phase: the editor's own Mod-f binding would otherwise also open its find bar.
    document.addEventListener('keydown', handleShortcut, true);
    return () => document.removeEventListener('keydown', handleShortcut, true);
  }, []);

  // Undo writes through the workspace, so its toast must not outlive it.
  useEffect(() => () => dismissToastRef.current?.(), []);

  const open = useCallback(() => {
    setPrefill(null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const showReplacedToast = useCallback(
    (summary: { count: number; places: number }, undo: () => Promise<void>) => {
      dismissToastRef.current?.();
      dismissToastRef.current = showEphemeralToast({
        title: `Replaced ${summary.count.toLocaleString()} in ${summary.places} place${summary.places === 1 ? '' : 's'}`,
        durationMs: 8000,
        action: { label: 'Undo', onClick: () => { void undo(); } },
      });
    },
    [],
  );

  return { isOpen, open, close, prefill, showReplacedToast };
}

export function showUndoRefusedToast(): void {
  showEphemeralToast({ type: 'error', title: 'Changed since the replace', message: 'Use Snapshots to roll back.' });
}

export function showUndoneToast(): void {
  showEphemeralToast({ title: 'Replace undone' });
}
