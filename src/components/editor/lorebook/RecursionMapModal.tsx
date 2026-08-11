/**
 * Recursion map modal: ego-centric + whole-book tabs with flag controls.
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GitFork, X } from 'lucide-react';
import type { LorebookEntry } from '../../../db/characterTypes';
import type { RecursionFlagPatch, RecursionGraph } from './recursionGraph';
import { entryDisplayName, getEgoStats } from './recursionGraph';
import { RecursionBookPanel } from './RecursionBookPanel';
import { RecursionEgoPanel } from './RecursionEgoPanel';

export type RecursionMapTab = 'ego' | 'book';

export type RecursionMapModalProps = {
  focusEntry: LorebookEntry | null;
  entries: LorebookEntry[];
  graph: RecursionGraph;
  bookRecursiveScanning?: boolean;
  initialTab?: RecursionMapTab;
  onClose: () => void;
  onNavigateToEntry: (entryId: number) => void;
  onUpdateEntries: (ids: number[], patch: RecursionFlagPatch) => void;
};

export function RecursionMapModal({
  focusEntry,
  entries,
  graph,
  bookRecursiveScanning,
  initialTab = 'ego',
  onClose,
  onNavigateToEntry,
  onUpdateEntries,
}: RecursionMapModalProps): React.ReactElement {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<RecursionMapTab>(() =>
    initialTab === 'ego' && !focusEntry ? 'book' : initialTab,
  );
  // Prefer book tab when there is no focus entry (avoid setState-in-effect).
  const activeTab: RecursionMapTab = tab === 'ego' && !focusEntry ? 'book' : tab;

  const indexById = useMemo(() => {
    const map = new Map<number, number>();
    entries.forEach((e, i) => map.set(e.id, i));
    return map;
  }, [entries]);

  const egoStats = focusEntry ? getEgoStats(graph, focusEntry.id) : null;

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(44rem,94dvh)] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl sm:rounded-2xl"
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
              {activeTab === 'ego' && focusEntry && egoStats ? (
                <>
                  {entryDisplayName(focusEntry, indexById.get(focusEntry.id))}
                  <span className="text-fg-subtle">
                    {' '}
                    · triggered by {egoStats.triggeredBy} · triggers {egoStats.triggers}
                  </span>
                </>
              ) : (
                <>
                  Whole book
                  <span className="text-fg-subtle">
                    {' '}
                    · {entries.length} entries
                  </span>
                </>
              )}
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

        <div className="flex shrink-0 gap-1 border-b border-border px-3 pt-2">
          <button
            type="button"
            disabled={!focusEntry}
            onClick={() => setTab('ego')}
            className={`rounded-t-lg px-3 py-2 text-xs font-medium transition-colors touch-manipulation disabled:cursor-not-allowed disabled:opacity-40 ${
              activeTab === 'ego'
                ? 'border border-b-0 border-border bg-surface text-fg'
                : 'text-fg-muted hover:bg-hover/60 hover:text-fg'
            }`}
          >
            This entry
          </button>
          <button
            type="button"
            onClick={() => setTab('book')}
            className={`rounded-t-lg px-3 py-2 text-xs font-medium transition-colors touch-manipulation ${
              activeTab === 'book'
                ? 'border border-b-0 border-border bg-surface text-fg'
                : 'text-fg-muted hover:bg-hover/60 hover:text-fg'
            }`}
          >
            Whole book
          </button>
        </div>

        {recursionOff && (
          <div className="shrink-0 border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-fg-muted">
            Recursive scanning is off for this book. Links show potential key→content hits; SillyTavern
            will not recurse until recursive scanning is enabled (book or global).
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {activeTab === 'ego' && focusEntry ? (
            <RecursionEgoPanel
              focusEntry={focusEntry}
              entries={entries}
              graph={graph}
              onNavigateToEntry={onNavigateToEntry}
              onShowWholeBook={() => setTab('book')}
            />
          ) : (
            <RecursionBookPanel
              focusEntryId={focusEntry?.id ?? null}
              entries={entries}
              graph={graph}
              onNavigateToEntry={onNavigateToEntry}
              onUpdateEntries={onUpdateEntries}
            />
          )}
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
