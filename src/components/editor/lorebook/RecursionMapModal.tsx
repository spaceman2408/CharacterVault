/**
 * Ego-centric recursion map: who can trigger this entry / what it can trigger.
 */

import React, { useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { GitFork, X } from 'lucide-react';
import type { LorebookEntry } from '../../../db/characterTypes';
import type { RecursionEdge, RecursionGraph } from './recursionGraph';
import { entryDisplayName } from './recursionGraph';

export type RecursionMapModalProps = {
  focusEntry: LorebookEntry;
  entries: LorebookEntry[];
  graph: RecursionGraph;
  bookRecursiveScanning?: boolean;
  onClose: () => void;
  onNavigateToEntry: (entryId: number) => void;
};

function FlagChip({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'warn' | 'accent' }) {
  const toneClass =
    tone === 'warn'
      ? 'border-warning/40 bg-warning/10 text-warning'
      : tone === 'accent'
        ? 'border-accent/40 bg-accent-soft text-accent'
        : 'border-border bg-muted text-fg-muted';
  return (
    <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

function entryFlags(entry: LorebookEntry): React.ReactNode[] {
  const chips: React.ReactNode[] = [];
  if (!entry.enabled) chips.push(<FlagChip key="off" tone="warn">Disabled</FlagChip>);
  if (entry.constant) chips.push(<FlagChip key="const" tone="accent">Constant</FlagChip>);
  if (entry.excludeRecursion) chips.push(<FlagChip key="excl">Non-recursable</FlagChip>);
  if (entry.preventRecursion) chips.push(<FlagChip key="prev">Prevent further</FlagChip>);
  if (entry.delayUntilRecursion) chips.push(<FlagChip key="delay">Delay until recursion</FlagChip>);
  return chips;
}

function NeighborCard({
  entry,
  edge,
  direction,
  indexById,
  onNavigate,
}: {
  entry: LorebookEntry;
  edge: RecursionEdge;
  direction: 'in' | 'out';
  indexById: Map<number, number>;
  onNavigate: (id: number) => void;
}): React.ReactElement {
  const idx = indexById.get(entry.id);
  const muted = !entry.enabled;

  return (
    <button
      type="button"
      onClick={() => onNavigate(entry.id)}
      className={`w-full rounded-xl border p-2.5 text-left transition-colors touch-manipulation ${
        muted
          ? 'border-border/60 bg-muted/40 opacity-70 hover:opacity-100'
          : 'border-border bg-surface hover:border-accent/40 hover:bg-accent-soft/50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-fg">
          {entryDisplayName(entry, idx)}
        </p>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-fg-subtle">
          {direction === 'in' ? 'in' : 'out'}
        </span>
      </div>
      {edge.matchedKeys.length > 0 && (
        <p className="mt-1 truncate text-[11px] text-fg-muted" title={edge.matchedKeys.join(', ')}>
          via {edge.matchedKeys.slice(0, 4).join(', ')}
          {edge.matchedKeys.length > 4 ? '…' : ''}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-1">{entryFlags(entry)}</div>
    </button>
  );
}

export function RecursionMapModal({
  focusEntry,
  entries,
  graph,
  bookRecursiveScanning,
  onClose,
  onNavigateToEntry,
}: RecursionMapModalProps): React.ReactElement {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const indexById = useMemo(() => {
    const map = new Map<number, number>();
    entries.forEach((e, i) => map.set(e.id, i));
    return map;
  }, [entries]);

  const entryById = useMemo(() => {
    const map = new Map<number, LorebookEntry>();
    for (const e of entries) map.set(e.id, e);
    return map;
  }, [entries]);

  const inbound = graph.incoming.get(focusEntry.id) ?? [];
  const outbound = graph.outgoing.get(focusEntry.id) ?? [];
  const focusIndex = indexById.get(focusEntry.id);

  // Keep latest onClose without re-binding the window listener every parent render.
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
      // Only restore focus if the previous target is still in the document.
      if (prev && document.contains(prev) && typeof prev.focus === 'function') {
        prev.focus();
      }
    };
  }, []);

  const recursionOff = bookRecursiveScanning !== true;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(40rem,92dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl sm:rounded-2xl"
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
              {entryDisplayName(focusEntry, focusIndex)}
              <span className="text-fg-subtle">
                {' '}
                · triggered by {inbound.length} · triggers {outbound.length}
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

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {/* Desktop visual: three columns with simple connector feel */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
            <section className="min-w-0 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                Triggered by ({inbound.length})
              </h3>
              {inbound.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-4 text-xs text-fg-muted">
                  {focusEntry.excludeRecursion
                    ? 'Non-recursable: other entries cannot unlock this one via content.'
                    : 'No other entries mention this entry’s primary keys in their content.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {inbound.map((edge) => {
                    const src = entryById.get(edge.fromId);
                    if (!src) return null;
                    return (
                      <li key={`in-${edge.fromId}`}>
                        <NeighborCard
                          entry={src}
                          edge={edge}
                          direction="in"
                          indexById={indexById}
                          onNavigate={onNavigateToEntry}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="flex min-w-0 flex-col items-center gap-2 lg:sticky lg:top-0 lg:w-56 lg:shrink-0">
              <div className="hidden w-full items-center gap-1 lg:flex" aria-hidden>
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] text-fg-subtle">→</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="w-full rounded-2xl border-2 border-accent bg-accent-soft/40 p-3 shadow-sm">
                <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-accent">
                  This entry
                </p>
                <p className="mt-1 text-center text-sm font-semibold text-fg">
                  {entryDisplayName(focusEntry, focusIndex)}
                </p>
                {focusEntry.keys?.length > 0 && (
                  <p className="mt-1 text-center text-[11px] text-fg-muted" title={focusEntry.keys.join(', ')}>
                    keys: {focusEntry.keys.slice(0, 5).join(', ')}
                    {focusEntry.keys.length > 5 ? '…' : ''}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap justify-center gap-1">
                  {entryFlags(focusEntry)}
                </div>
              </div>
              <div className="hidden w-full items-center gap-1 lg:flex" aria-hidden>
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] text-fg-subtle">→</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {/* Mobile flow arrows */}
              <div className="flex w-full items-center justify-center gap-2 text-[11px] text-fg-subtle lg:hidden">
                <span>↑ triggered by</span>
                <span>·</span>
                <span>triggers ↓</span>
              </div>
            </section>

            <section className="min-w-0 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                Triggers ({outbound.length})
              </h3>
              {outbound.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-4 text-xs text-fg-muted">
                  {focusEntry.preventRecursion
                    ? 'Prevent further recursion: this entry will not unlock others.'
                    : 'This entry’s content does not mention other entries’ primary keys.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {outbound.map((edge) => {
                    const tgt = entryById.get(edge.toId);
                    if (!tgt) return null;
                    return (
                      <li key={`out-${edge.toId}`}>
                        <NeighborCard
                          entry={tgt}
                          edge={edge}
                          direction="out"
                          indexById={indexById}
                          onNavigate={onNavigateToEntry}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
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
