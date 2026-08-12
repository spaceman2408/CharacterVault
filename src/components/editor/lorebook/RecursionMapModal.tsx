/**
 * Recursion map modal: single merged whole-book view (web/list + inspector +
 * bulk selection bar). The focus entry is pre-inspected when provided.
 */

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { GitFork, X } from 'lucide-react';
import type { LorebookEntry } from '../../../db/characterTypes';
import type { RecursionFlagPatch, RecursionGraph } from './recursionGraph';
import { countEdges } from './recursionGraph';
import { RecursionBookPanel } from './RecursionBookPanel';

export type RecursionMapModalProps = {
  focusEntry: LorebookEntry | null;
  entries: LorebookEntry[];
  graph: RecursionGraph;
  bookRecursiveScanning?: boolean;
  onClose: () => void;
  onNavigateToEntry: (entryId: number) => void;
  onUpdateEntries: (ids: number[], patch: RecursionFlagPatch) => void;
  onPatchEntry: (id: number, patch: RecursionFlagPatch) => void;
};

export function RecursionMapModal({
  focusEntry,
  entries,
  graph,
  bookRecursiveScanning,
  onClose,
  onNavigateToEntry,
  onUpdateEntries,
  onPatchEntry,
}: RecursionMapModalProps): React.ReactElement {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const edgeCount = countEdges(graph);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (prev && document.contains(prev) && typeof prev.focus === 'function') {
        prev.focus();
      }
    };
  }, []);

  const recursionOff = bookRecursiveScanning !== true;

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCloseRef.current();
  };

  const modal = (
    <div
      className="fixed inset-0 z-50 bg-overlay/70 backdrop-blur-sm"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full flex-col overflow-hidden bg-surface"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <GitFork className="h-4 w-4 shrink-0 text-accent" />
              <h2 id={titleId} className="text-sm font-semibold text-fg">
                Recursion map
              </h2>
            </div>
            <p className="mt-0.5 truncate text-xs text-fg-muted">
              Whole book{' '}
              <span className="text-fg-subtle">
                · {entries.length} entries · {edgeCount} links
              </span>
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-fg-muted hover:bg-hover hover:text-fg touch-manipulation"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {recursionOff && (
          <div className="shrink-0 border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-fg-muted">
            Recursive scanning is off for this book. Links show potential key→content hits; SillyTavern
            will not recurse until recursive scanning is enabled (book or global).
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
          <RecursionBookPanel
            focusEntryId={focusEntry?.id ?? null}
            entries={entries}
            graph={graph}
            onNavigateToEntry={onNavigateToEntry}
            onUpdateEntries={onUpdateEntries}
            onPatchEntry={onPatchEntry}
          />
        </div>

        <div className="shrink-0 border-t border-border px-4 py-2.5 text-[11px] leading-snug text-fg-subtle">
          Authoring aid based on primary keys in entry content. Selective filters, probability, token
          budget, and multi-step depth are not simulated.
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
}
