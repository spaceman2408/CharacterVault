/**
 * Whole-book recursion browser: pick an entry, see what unlocks it / what it unlocks,
 * multi-select for bulk ST recursion flags.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  CheckSquare,
  Search,
  Square,
  X,
} from 'lucide-react';
import type { LorebookEntry } from '../../../db/characterTypes';
import type { RecursionEdge, RecursionFlagPatch, RecursionGraph } from './recursionGraph';
import {
  entryDisplayName,
  getBookRecursionStats,
  listEdges,
} from './recursionGraph';
import { RecursionFlagChips } from './RecursionFlagChips';

export type RecursionBookPanelProps = {
  focusEntryId: number | null;
  entries: LorebookEntry[];
  graph: RecursionGraph;
  onNavigateToEntry: (entryId: number) => void;
  onUpdateEntries: (ids: number[], patch: RecursionFlagPatch) => void;
  onFocusEntry?: (entryId: number) => void;
};

type FlagKey = keyof RecursionFlagPatch;
type ListFilter = 'all' | 'linked' | 'isolated';

function flagState(
  selected: LorebookEntry[],
  key: FlagKey,
): 'all-on' | 'all-off' | 'mixed' | 'empty' {
  if (selected.length === 0) return 'empty';
  let on = 0;
  for (const e of selected) {
    if (e[key] === true) on += 1;
  }
  if (on === 0) return 'all-off';
  if (on === selected.length) return 'all-on';
  return 'mixed';
}

function degrees(graph: RecursionGraph, id: number): { inbound: number; outbound: number } {
  return {
    inbound: graph.incoming.get(id)?.length ?? 0,
    outbound: graph.outgoing.get(id)?.length ?? 0,
  };
}

function LinkRow({
  edge,
  direction,
  other,
  otherIndex,
  onInspect,
  onOpen,
}: {
  edge: RecursionEdge;
  direction: 'in' | 'out';
  other: LorebookEntry;
  otherIndex?: number;
  onInspect: () => void;
  onOpen: () => void;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-surface px-2.5 py-2">
      <div
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          direction === 'in'
            ? 'bg-accent-soft text-accent'
            : 'bg-success/15 text-success'
        }`}
        aria-hidden
      >
        {direction === 'in' ? (
          <ArrowDownToLine className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpFromLine className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onInspect}
          className="block w-full truncate text-left text-sm font-medium text-fg hover:text-accent touch-manipulation"
        >
          {entryDisplayName(other, otherIndex)}
        </button>
        <p className="mt-0.5 truncate text-[11px] text-fg-muted" title={edge.matchedKeys.join(', ')}>
          {direction === 'in' ? 'mentions' : 'matched'}{' '}
          <span className="font-medium text-fg-muted">
            {edge.matchedKeys.slice(0, 3).join(', ')}
            {edge.matchedKeys.length > 3 ? '…' : ''}
          </span>
          {direction === 'in' ? ' in its content' : ' in this content'}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          <RecursionFlagChips entry={other} />
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-fg-muted hover:bg-hover hover:text-fg touch-manipulation"
      >
        Edit
      </button>
    </div>
  );
}

function FlagToggleRow({
  label,
  hint,
  state,
  disabled,
  onSet,
}: {
  label: string;
  hint: string;
  state: 'all-on' | 'all-off' | 'mixed' | 'empty';
  disabled: boolean;
  onSet: (value: boolean) => void;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-fg">{label}</p>
        <p className="text-[11px] leading-snug text-fg-subtle">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {state === 'mixed' && (
          <span className="mr-1 text-[10px] text-fg-subtle">mixed</span>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSet(true)}
          className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium touch-manipulation disabled:opacity-40 ${
            state === 'all-on'
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-border bg-surface text-fg-muted hover:bg-hover hover:text-fg'
          }`}
        >
          On
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSet(false)}
          className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium touch-manipulation disabled:opacity-40 ${
            state === 'all-off'
              ? 'border-border bg-muted text-fg'
              : 'border-border bg-surface text-fg-muted hover:bg-hover hover:text-fg'
          }`}
        >
          Off
        </button>
      </div>
    </div>
  );
}

export function RecursionBookPanel({
  focusEntryId,
  entries,
  graph,
  onNavigateToEntry,
  onUpdateEntries,
}: RecursionBookPanelProps): React.ReactElement {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ListFilter>('all');
  const [showAllLinks, setShowAllLinks] = useState(false);

  const entryIdSet = useMemo(() => new Set(entries.map((e) => e.id)), [entries]);

  // Inspected entry follows editor selection (list / path clicks call onNavigateToEntry).
  const inspectId = useMemo(() => {
    if (focusEntryId != null && entryIdSet.has(focusEntryId)) {
      return focusEntryId;
    }
    return entries[0]?.id ?? null;
  }, [focusEntryId, entries, entryIdSet]);

  const stats = useMemo(() => getBookRecursionStats(entries, graph), [entries, graph]);
  const edges = useMemo(() => listEdges(graph), [graph]);

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

  // Drop ids for deleted entries so bulk ops and selection state cannot retain ghosts.
  const activeSelectedIds = useMemo(() => {
    if (selectedIds.size === 0) return selectedIds;
    let pruned = false;
    const next = new Set<number>();
    for (const id of selectedIds) {
      if (entryIdSet.has(id)) next.add(id);
      else pruned = true;
    }
    return pruned ? next : selectedIds;
  }, [selectedIds, entryIdSet]);

  const sortedEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scored = entries.map((entry) => {
      const { inbound, outbound } = degrees(graph, entry.id);
      const linked = inbound + outbound > 0;
      return { entry, inbound, outbound, linked };
    });

    let filtered = scored;
    if (filter === 'linked') filtered = scored.filter((s) => s.linked);
    else if (filter === 'isolated') filtered = scored.filter((s) => !s.linked);

    if (q) {
      filtered = filtered.filter(({ entry }) => {
        const name = entryDisplayName(entry, indexById.get(entry.id)).toLowerCase();
        const keys = (entry.keys ?? []).join(' ').toLowerCase();
        return name.includes(q) || keys.includes(q) || (entry.content ?? '').toLowerCase().includes(q);
      });
    }

    filtered.sort((a, b) => {
      const da = a.inbound + a.outbound;
      const db = b.inbound + b.outbound;
      if (db !== da) return db - da;
      return entryDisplayName(a.entry).localeCompare(entryDisplayName(b.entry));
    });

    return filtered;
  }, [entries, graph, query, filter, indexById]);

  const inspectEntry = inspectId != null ? entryById.get(inspectId) ?? null : null;
  const inbound = inspectId != null ? (graph.incoming.get(inspectId) ?? []) : [];
  const outbound = inspectId != null ? (graph.outgoing.get(inspectId) ?? []) : [];

  const selectedEntries = useMemo(
    () => entries.filter((e) => activeSelectedIds.has(e.id)),
    [entries, activeSelectedIds],
  );

  const inspectAsSelection = useCallback(() => {
    if (inspectId == null) return;
    setSelectedIds(new Set([inspectId]));
  }, [inspectId]);

  const toggleSelect = useCallback(
    (id: number) => {
      setSelectedIds((prev) => {
        const next = new Set<number>();
        for (const existing of prev) {
          if (entryIdSet.has(existing)) next.add(existing);
        }
        if (next.has(id)) next.delete(id);
        else if (entryIdSet.has(id)) next.add(id);
        return next;
      });
    },
    [entryIdSet],
  );

  const inspect = useCallback(
    (id: number) => {
      // Single navigation path (parent may also wire onFocusEntry to navigate).
      onNavigateToEntry(id);
    },
    [onNavigateToEntry],
  );

  const selectAllEntries = useCallback(() => {
    setSelectedIds(new Set(entries.map((e) => e.id)));
  }, [entries]);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(sortedEntries.map((s) => s.entry.id)));
  }, [sortedEntries]);

  const selectAllLinked = useCallback(() => {
    const next = new Set<number>();
    for (const e of entries) {
      const { inbound, outbound } = degrees(graph, e.id);
      if (inbound + outbound > 0) next.add(e.id);
    }
    setSelectedIds(next);
  }, [entries, graph]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const setFlag = useCallback(
    (ids: number[], key: FlagKey, value: boolean) => {
      if (ids.length === 0) return;
      onUpdateEntries(ids, { [key]: value });
    },
    [onUpdateEntries],
  );

  const bulkIds =
    activeSelectedIds.size > 0
      ? [...activeSelectedIds]
      : inspectId != null
        ? [inspectId]
        : [];
  const bulkEntries =
    activeSelectedIds.size > 0
      ? selectedEntries
      : inspectEntry
        ? [inspectEntry]
        : [];
  const bulkLabel =
    activeSelectedIds.size > 1
      ? `${activeSelectedIds.size} selected entries`
      : activeSelectedIds.size === 1
        ? entryDisplayName(selectedEntries[0], indexById.get(selectedEntries[0].id))
        : inspectEntry
          ? entryDisplayName(inspectEntry, indexById.get(inspectEntry.id))
          : 'No entry';

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* Plain-language book summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
            Unlock paths
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-fg">{stats.edgeCount}</p>
          <p className="text-[11px] text-fg-muted">entry → entry links</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
            In the web
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-fg">{stats.linkedCount}</p>
          <p className="text-[11px] text-fg-muted">of {stats.entryCount} entries</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
            Standalone
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-fg">{stats.isolatedCount}</p>
          <p className="text-[11px] text-fg-muted">no recursion links</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
            Flagged
          </p>
          <p className="mt-0.5 text-sm font-medium tabular-nums text-fg">
            {stats.excludeRecursionCount + stats.preventRecursionCount + stats.delayUntilRecursionCount}
          </p>
          <p className="text-[11px] text-fg-muted">
            {stats.excludeRecursionCount} non-rec · {stats.preventRecursionCount} prevent ·{' '}
            {stats.delayUntilRecursionCount} delay
          </p>
        </div>
      </div>

      <p className="text-[11px] leading-snug text-fg-subtle">
        An unlock path means one entry’s <span className="text-fg-muted">content</span> contains
        another entry’s <span className="text-fg-muted">primary keys</span>. Click an entry to
        inspect its paths; use checkboxes to change flags on many at once.
      </p>

      {/* Master / detail */}
      <div className="grid min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(14rem,18rem)_1fr]">
        {/* Entry list */}
        <div className="flex min-h-0 flex-col rounded-xl border border-border bg-muted/20">
          <div className="shrink-0 space-y-2 border-b border-border p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search entries…"
                className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-2 text-xs text-fg placeholder:text-fg-subtle outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['all', 'All'],
                  ['linked', 'Linked'],
                  ['isolated', 'Standalone'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium touch-manipulation ${
                    filter === id
                      ? 'bg-accent-soft text-accent'
                      : 'text-fg-muted hover:bg-hover hover:text-fg'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={selectAllEntries}
                disabled={entries.length === 0}
                className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-40 touch-manipulation"
                title="Select every entry in the book for bulk flag edits"
              >
                Select all
              </button>
              {(query.trim() || filter !== 'all') && (
                <button
                  type="button"
                  onClick={selectAllVisible}
                  disabled={sortedEntries.length === 0}
                  className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-40 touch-manipulation"
                  title="Select only the entries currently shown in this list"
                >
                  Select visible ({sortedEntries.length})
                </button>
              )}
              <button
                type="button"
                onClick={selectAllLinked}
                className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] text-fg-muted hover:bg-hover hover:text-fg touch-manipulation"
                title="Select entries that have at least one unlock path"
              >
                Select linked
              </button>
              {activeSelectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] text-fg-muted hover:bg-hover hover:text-fg touch-manipulation"
                >
                  <X className="h-3 w-3" />
                  Clear ({activeSelectedIds.size})
                </button>
              )}
            </div>
          </div>

          <ul className="min-h-0 max-h-[min(40vh,20rem)] flex-1 overflow-y-auto lg:max-h-[min(52vh,28rem)]">
            {sortedEntries.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-fg-muted">No matching entries.</li>
            ) : (
              sortedEntries.map(({ entry, inbound: inN, outbound: outN }) => {
                const active = inspectId === entry.id;
                const checked = activeSelectedIds.has(entry.id);
                return (
                  <li key={entry.id} className="border-b border-border/60 last:border-b-0">
                    <div
                      className={`flex items-stretch gap-0.5 ${
                        active ? 'bg-accent-soft/60' : 'hover:bg-hover/40'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSelect(entry.id)}
                        className="flex shrink-0 items-center px-2 text-fg-muted hover:text-fg touch-manipulation"
                        aria-label={checked ? 'Deselect' : 'Select for bulk edit'}
                        title="Select for bulk flag edit"
                      >
                        {checked ? (
                          <CheckSquare className="h-4 w-4 text-accent" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => inspect(entry.id)}
                        className="min-w-0 flex-1 px-1 py-2 text-left touch-manipulation"
                      >
                        <p className="truncate text-sm font-medium text-fg">
                          {entryDisplayName(entry, indexById.get(entry.id))}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-fg-muted">
                          {inN + outN === 0 ? (
                            <span className="text-fg-subtle">standalone</span>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-0.5" title="Unlocked by">
                                <ArrowDownToLine className="h-3 w-3 text-accent" />
                                {inN}
                              </span>
                              <span className="inline-flex items-center gap-0.5" title="Unlocks">
                                <ArrowUpFromLine className="h-3 w-3 text-success" />
                                {outN}
                              </span>
                            </>
                          )}
                        </p>
                      </button>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* Inspector */}
        <div className="flex min-h-0 flex-col gap-3">
          {!inspectEntry ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-fg-muted">
              Select an entry on the left to see its unlock paths.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-accent/40 bg-accent-soft/30 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                      Inspecting
                    </p>
                    <p className="truncate text-base font-semibold text-fg">
                      {entryDisplayName(inspectEntry, indexById.get(inspectEntry.id))}
                    </p>
                    {inspectEntry.keys?.length > 0 && (
                      <p
                        className="mt-1 truncate text-[11px] text-fg-muted"
                        title={inspectEntry.keys.join(', ')}
                      >
                        Keys: {inspectEntry.keys.slice(0, 6).join(', ')}
                        {inspectEntry.keys.length > 6 ? '…' : ''}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <RecursionFlagChips entry={inspectEntry} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => onNavigateToEntry(inspectEntry.id)}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-fg-muted hover:bg-hover hover:text-fg touch-manipulation"
                    >
                      Open in editor
                    </button>
                    <button
                      type="button"
                      onClick={inspectAsSelection}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-fg-muted hover:bg-hover hover:text-fg touch-manipulation"
                    >
                      Select this
                    </button>
                  </div>
                </div>

                {/* How to read */}
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-surface/80 px-2.5 py-2 text-[11px] text-fg-muted">
                    <ArrowDownToLine className="h-4 w-4 shrink-0 text-accent" />
                    <span>
                      <span className="font-semibold text-fg">{inbound.length}</span> entries can
                      unlock this one
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-surface/80 px-2.5 py-2 text-[11px] text-fg-muted">
                    <ArrowUpFromLine className="h-4 w-4 shrink-0 text-success" />
                    <span>
                      This one can unlock{' '}
                      <span className="font-semibold text-fg">{outbound.length}</span> entries
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    <ArrowDownToLine className="h-3.5 w-3.5 text-accent" />
                    Unlocked by ({inbound.length})
                  </h3>
                  {inbound.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-3 text-xs leading-relaxed text-fg-muted">
                      {inspectEntry.excludeRecursion
                        ? 'Non-recursable is on: nothing can unlock this via recursion.'
                        : 'No other entry’s content mentions this entry’s keys.'}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {inbound.map((edge) => {
                        const other = entryById.get(edge.fromId);
                        if (!other) return null;
                        return (
                          <li key={`in-${edge.fromId}`}>
                            <LinkRow
                              edge={edge}
                              direction="in"
                              other={other}
                              otherIndex={indexById.get(other.id)}
                              onInspect={() => inspect(other.id)}
                              onOpen={() => onNavigateToEntry(other.id)}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    <ArrowUpFromLine className="h-3.5 w-3.5 text-success" />
                    Unlocks ({outbound.length})
                  </h3>
                  {outbound.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-3 text-xs leading-relaxed text-fg-muted">
                      {inspectEntry.preventRecursion
                        ? 'Prevent further recursion is on: this entry will not unlock others.'
                        : 'This entry’s content does not mention other entries’ keys.'}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {outbound.map((edge) => {
                        const other = entryById.get(edge.toId);
                        if (!other) return null;
                        return (
                          <li key={`out-${edge.toId}`}>
                            <LinkRow
                              edge={edge}
                              direction="out"
                              other={other}
                              otherIndex={indexById.get(other.id)}
                              onInspect={() => inspect(other.id)}
                              onOpen={() => onNavigateToEntry(other.id)}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}

          {/* Flag controls: inspect target or multi-select */}
          {bulkIds.length > 0 && (
            <div className="space-y-3 rounded-xl border border-border bg-surface p-3 shadow-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                  Recursion controls
                </p>
                <p className="mt-0.5 text-xs text-fg-muted">
                  Applying to: <span className="font-medium text-fg">{bulkLabel}</span>
                  {activeSelectedIds.size === 0 && (
                    <span className="text-fg-subtle">
                      {' '}
                      (inspect target; use Select all or checkboxes for bulk)
                    </span>
                  )}
                </p>
              </div>
              <div className="space-y-3 divide-y divide-border/80">
                <div className="pb-3">
                  <FlagToggleRow
                    label="Non-recursable"
                    hint="Others cannot unlock these entries by mentioning their keys."
                    state={flagState(bulkEntries, 'excludeRecursion')}
                    disabled={bulkIds.length === 0}
                    onSet={(v) => setFlag(bulkIds, 'excludeRecursion', v)}
                  />
                </div>
                <div className="py-3">
                  <FlagToggleRow
                    label="Prevent further recursion"
                    hint="When these activate, they will not unlock further entries."
                    state={flagState(bulkEntries, 'preventRecursion')}
                    disabled={bulkIds.length === 0}
                    onSet={(v) => setFlag(bulkIds, 'preventRecursion', v)}
                  />
                </div>
                <div className="pt-3">
                  <FlagToggleRow
                    label="Delay until recursion"
                    hint="Only activate on recursive passes (not the first chat scan)."
                    state={flagState(bulkEntries, 'delayUntilRecursion')}
                    disabled={bulkIds.length === 0}
                    onSet={(v) => setFlag(bulkIds, 'delayUntilRecursion', v)}
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={bulkIds.length === 0}
                onClick={() =>
                  onUpdateEntries(bulkIds, {
                    excludeRecursion: true,
                    preventRecursion: true,
                  })
                }
                className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-40 touch-manipulation sm:w-auto"
              >
                Isolate: block both directions
              </button>
            </div>
          )}
        </div>
      </div>

      {/* All paths (secondary, collapsible) */}
      <div className="rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setShowAllLinks((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left touch-manipulation hover:bg-hover/40"
        >
          <span className="text-xs font-semibold text-fg">
            All unlock paths in this book
            <span className="ml-1.5 font-normal text-fg-muted">({edges.length})</span>
          </span>
          <span className="text-[11px] text-fg-subtle">{showAllLinks ? 'Hide' : 'Show'}</span>
        </button>
        {showAllLinks && (
          <div className="border-t border-border">
            {edges.length === 0 ? (
              <p className="px-3 py-4 text-xs text-fg-muted">No unlock paths yet.</p>
            ) : (
              <ul className="max-h-48 divide-y divide-border overflow-y-auto">
                {edges.map((edge) => {
                  const from = entryById.get(edge.fromId);
                  const to = entryById.get(edge.toId);
                  if (!from || !to) return null;
                  return (
                    <li
                      key={`${edge.fromId}->${edge.toId}`}
                      className="flex flex-wrap items-center gap-1.5 px-3 py-2 text-xs"
                    >
                      <button
                        type="button"
                        className="font-medium text-fg hover:text-accent"
                        onClick={() => inspect(edge.fromId)}
                      >
                        {entryDisplayName(from, indexById.get(from.id))}
                      </button>
                      <ArrowRight className="h-3 w-3 shrink-0 text-fg-subtle" aria-hidden />
                      <button
                        type="button"
                        className="font-medium text-fg hover:text-accent"
                        onClick={() => inspect(edge.toId)}
                      >
                        {entryDisplayName(to, indexById.get(to.id))}
                      </button>
                      <span
                        className="min-w-0 truncate text-fg-subtle"
                        title={edge.matchedKeys.join(', ')}
                      >
                        via {edge.matchedKeys.slice(0, 3).join(', ')}
                        {edge.matchedKeys.length > 3 ? '…' : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
