/**
 * Ego-centric recursion view: who triggers this entry / what it triggers.
 */

import React, { useMemo } from 'react';
import type { LorebookEntry } from '../../../db/characterTypes';
import type { RecursionEdge, RecursionGraph } from './recursionGraph';
import { entryDisplayName } from './recursionGraph';
import { RecursionFlagChips } from './RecursionFlagChips';

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
      <div className="mt-1.5 flex flex-wrap gap-1">
        <RecursionFlagChips entry={entry} />
      </div>
    </button>
  );
}

export type RecursionEgoPanelProps = {
  focusEntry: LorebookEntry;
  entries: LorebookEntry[];
  graph: RecursionGraph;
  onNavigateToEntry: (entryId: number) => void;
  onShowWholeBook?: () => void;
};

export function RecursionEgoPanel({
  focusEntry,
  entries,
  graph,
  onNavigateToEntry,
  onShowWholeBook,
}: RecursionEgoPanelProps): React.ReactElement {
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

  return (
    <div className="space-y-3">
      {onShowWholeBook && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onShowWholeBook}
            className="text-[11px] font-medium text-accent hover:underline touch-manipulation"
          >
            View whole book →
          </button>
        </div>
      )}
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
              <p
                className="mt-1 text-center text-[11px] text-fg-muted"
                title={focusEntry.keys.join(', ')}
              >
                keys: {focusEntry.keys.slice(0, 5).join(', ')}
                {focusEntry.keys.length > 5 ? '…' : ''}
              </p>
            )}
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              <RecursionFlagChips entry={focusEntry} />
            </div>
          </div>
          <div className="hidden w-full items-center gap-1 lg:flex" aria-hidden>
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] text-fg-subtle">→</span>
            <div className="h-px flex-1 bg-border" />
          </div>
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
  );
}
