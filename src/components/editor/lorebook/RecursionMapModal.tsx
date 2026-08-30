/**
 * Recursion map modal: single merged whole-book view (web/list + inspector +
 * bulk selection bar). The focus entry is pre-inspected when provided.
 */

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { GitFork, X } from 'lucide-react';
import type { LorebookEntry } from '../../../db/characterTypes';
import type { RecursionEntryPatch, RecursionFlagPatch, RecursionGraph } from './recursionGraph';
import { countEdges } from './recursionGraph';
import { RecursionBookPanel } from './RecursionBookPanel';

export type RecursionMapModalProps = {
  focusEntry: LorebookEntry | null;
  entries: LorebookEntry[];
  graph: RecursionGraph;
  bookRecursiveScanning?: boolean;
  onClose: () => void;
  onUpdateEntries: (ids: number[], patch: RecursionFlagPatch) => void;
  onPatchEntry: (id: number, patch: RecursionEntryPatch) => void;
};

export function RecursionMapModal({
  focusEntry,
  entries,
  graph,
  bookRecursiveScanning,
  onClose,
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
      if (e.key !== 'Escape') return;
      if (e.defaultPrevented) return;
      e.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (prev && document.contains(prev) && typeof prev.focus === 'function') {
        prev.focus();
      }
    };
  }, []);

  // Unspecified means a typical ST standalone world (global WI recursive scan
  // decides). Only warn when this book explicitly turns scanning off.
  const recursionOff = bookRecursiveScanning === false;

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
        className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface pt-[env(safe-area-inset-top)]"
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
            className="rounded-lg p-2.5 text-fg-muted hover:bg-hover hover:text-fg touch-manipulation md:p-1.5"
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
            onUpdateEntries={onUpdateEntries}
            onPatchEntry={onPatchEntry}
          />
        </div>

        <div className="shrink-0 border-t border-border px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-[11px] leading-snug text-fg-subtle">
          Authoring aid based on primary keys in entry content. Selective filters, probability, token
          budget, and multi-step depth are not simulated.
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
}
