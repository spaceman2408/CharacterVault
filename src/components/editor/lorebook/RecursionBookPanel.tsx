/**
 * Whole-book recursion browser. On desktop: web or list, inspector overlay,
 * sticky bulk-edit bar. On compact viewports the web is hidden and inspector
 * plus selection dock in-flow under the list. Single-entry flag and primary-key
 * edits apply immediately; bulk flag changes still require an explicit Apply.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckSquare,
  ChevronDown,
  GitFork,
  List,
  Search,
  Square,
  X,
} from 'lucide-react';
import type { LorebookEntry } from '../../../db/characterTypes';
import type {
  RecursionEdge,
  RecursionEntryPatch,
  RecursionFlagPatch,
  RecursionGraph,
} from './recursionGraph';
import {
  entryDisplayName,
  getBookRecursionStats,
  shouldPreferListLayout,
} from './recursionGraph';
import { RecursionFlagChips } from './RecursionFlagChips';
import { RecursionKeyChips } from './RecursionKeyChips';
import { RecursionWebView } from './RecursionWebView';

export type RecursionBookPanelProps = {
  focusEntryId: number | null;
  entries: LorebookEntry[];
  graph: RecursionGraph;
  onUpdateEntries: (ids: number[], patch: RecursionFlagPatch) => void;
  onPatchEntry: (id: number, patch: RecursionEntryPatch) => void;
};

type FlagKey = keyof RecursionFlagPatch;
type ListFilter = 'all' | 'linked' | 'isolated';
type ViewMode = 'web' | 'list';

/** One staged bulk edit; 'both' = isolate (block recursion in both directions). */
type PendingPatch = { key: FlagKey | 'both'; value: boolean };

const FLAG_ROWS: { key: FlagKey; label: string; hint: string }[] = [
  {
    key: 'excludeRecursion',
    label: 'Non-recursable',
    hint: 'Nothing can unlock these entries by mentioning their keys.',
  },
  {
    key: 'preventRecursion',
    label: 'Prevent further recursion',
    hint: 'When these activate, the chain stops there.',
  },
  {
    key: 'delayUntilRecursion',
    label: 'Delay until recursion',
    hint: 'Only activate on recursive passes (not the first chat scan).',
  },
];

const ARM_THRESHOLD = 25;
/** Phones: list-only. Tablets (`md` and up) keep the web. */
const COMPACT_MAX_WIDTH_PX = 767;

function useCompactViewport(): boolean {
  const [compact, setCompact] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${COMPACT_MAX_WIDTH_PX}px)`).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${COMPACT_MAX_WIDTH_PX}px)`);
    const onChange = () => setCompact(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return compact;
}

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

function pendingLabel(pending: PendingPatch): string {
  if (pending.key === 'both') return 'Isolate (both directions)';
  return FLAG_ROWS.find((r) => r.key === pending.key)?.label ?? '';
}

function LinkRow({
  edge,
  direction,
  other,
  otherIndex,
  ownerKeys,
  onInspect,
  onChangeOwnerKeys,
}: {
  edge: RecursionEdge;
  direction: 'in' | 'out';
  other: LorebookEntry;
  otherIndex?: number;
  ownerKeys: string[];
  onInspect: () => void;
  onChangeOwnerKeys: (keys: string[]) => void;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-surface px-2.5 py-2">
      <div
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          direction === 'in' ? 'bg-accent-soft text-accent' : 'bg-success/15 text-success'
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
        <p className="mt-0.5 text-[11px] text-fg-muted">
          {direction === 'in'
            ? 'Mentions these keys in its content'
            : 'These keys match in this content'}
        </p>
        {edge.matchedKeys.length > 0 && (
          <div className="mt-1">
            <RecursionKeyChips
              keys={ownerKeys}
              displayKeys={edge.matchedKeys}
              onChange={onChangeOwnerKeys}
              aria-label={
                direction === 'in' ? 'This entry’s matched keys' : 'That entry’s matched keys'
              }
            />
          </div>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          <RecursionFlagChips entry={other} />
        </div>
      </div>
    </div>
  );
}

function FlagToggleRow({
  label,
  hint,
  state,
  pendingValue,
  onSet,
}: {
  label: string;
  hint: string;
  state: 'all-on' | 'all-off' | 'mixed' | 'empty';
  pendingValue: boolean | null;
  onSet: (value: boolean) => void;
}): React.ReactElement {
  return (
    <div
      className={`flex flex-col gap-1 rounded-lg sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
        pendingValue != null ? '-m-1.5 border border-dashed border-accent/60 bg-accent-soft/20 p-1.5' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-fg">{label}</p>
        <p className="text-[11px] leading-snug text-fg-subtle">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {state === 'mixed' && <span className="mr-1 text-[10px] text-fg-subtle">mixed</span>}
        <button
          type="button"
          onClick={() => onSet(true)}
          className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium touch-manipulation ${
            pendingValue === true
              ? 'border-accent bg-accent text-accent-fg'
              : state === 'all-on'
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border bg-surface text-fg-muted hover:bg-hover hover:text-fg'
          }`}
        >
          On
        </button>
        <button
          type="button"
          onClick={() => onSet(false)}
          className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium touch-manipulation ${
            pendingValue === false
              ? 'border-accent bg-accent text-accent-fg'
              : state === 'all-off'
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

function InspectorBody({
  inspectedEntry,
  indexById,
  entryById,
  inbound,
  outbound,
  inspectedSelected,
  onToggleSelect,
  onClearInspected,
  onPatchEntry,
  onInspect,
}: {
  inspectedEntry: LorebookEntry;
  indexById: Map<number, number>;
  entryById: Map<number, LorebookEntry>;
  inbound: RecursionEdge[];
  outbound: RecursionEdge[];
  inspectedSelected: boolean;
  onToggleSelect: (id: number) => void;
  onClearInspected: () => void;
  onPatchEntry: (id: number, patch: RecursionEntryPatch) => void;
  onInspect: (id: number) => void;
}): React.ReactElement {
  return (
    <>
      <div className="rounded-xl border border-accent/40 bg-accent-soft/30 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
              Inspecting
            </p>
            <p className="truncate text-base font-semibold text-fg">
              {entryDisplayName(inspectedEntry, indexById.get(inspectedEntry.id))}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <RecursionFlagChips entry={inspectedEntry} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleSelect(inspectedEntry.id)}
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-fg-muted hover:bg-hover hover:text-fg touch-manipulation"
            >
              {inspectedSelected ? 'Remove from selection' : 'Select'}
            </button>
            <button
              type="button"
              onClick={onClearInspected}
              className="rounded-lg border border-border bg-surface p-1.5 text-fg-muted hover:bg-hover hover:text-fg touch-manipulation"
              aria-label="Stop inspecting"
              title="Stop inspecting"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="mt-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
            Keys
          </p>
          <RecursionKeyChips
            keys={inspectedEntry.keys ?? []}
            onChange={(nextKeys) => onPatchEntry(inspectedEntry.id, { keys: nextKeys })}
            placeholder="Add a key"
            aria-label="Primary keys for this entry"
          />
          <p className="mt-1 text-[10px] leading-snug text-fg-subtle">
            Edits write to this entry and update the map immediately.
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FLAG_ROWS.map((row) => {
            const on = inspectedEntry[row.key] === true;
            return (
              <button
                key={row.key}
                type="button"
                aria-pressed={on}
                title={row.hint}
                onClick={() => onPatchEntry(inspectedEntry.id, { [row.key]: !on })}
                className={`rounded-lg border px-2 py-1 text-[10px] font-medium touch-manipulation ${
                  on
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border bg-surface text-fg-muted hover:bg-hover hover:text-fg'
                }`}
              >
                {row.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] leading-snug text-fg-subtle">
          These toggles apply immediately to this entry. Select entries below to stage a
          change across many.
        </p>
      </div>

      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
          <ArrowDownToLine className="h-3.5 w-3.5 text-accent" />
          Unlocked by ({inbound.length})
        </h3>
        {inbound.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-3 text-xs leading-relaxed text-fg-muted">
            {inspectedEntry.excludeRecursion
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
                    ownerKeys={inspectedEntry.keys ?? []}
                    onInspect={() => onInspect(other.id)}
                    onChangeOwnerKeys={(nextKeys) =>
                      onPatchEntry(inspectedEntry.id, { keys: nextKeys })
                    }
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
            {inspectedEntry.preventRecursion
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
                    ownerKeys={other.keys ?? []}
                    onInspect={() => onInspect(other.id)}
                    onChangeOwnerKeys={(nextKeys) => onPatchEntry(other.id, { keys: nextKeys })}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function SelectionBarBody({
  compact,
  flagsExpanded,
  selectedCount,
  selectedEntries,
  query,
  filter,
  visibleCount,
  pendingPatch,
  applyArmed,
  onSelectAll,
  onSelectVisible,
  onSelectLinked,
  onClearSelection,
  onStageFlag,
  onStageIsolate,
  onApply,
  onDiscard,
  onOpenFlags,
  onHideFlags,
}: {
  compact: boolean;
  flagsExpanded: boolean;
  selectedCount: number;
  selectedEntries: LorebookEntry[];
  query: string;
  filter: ListFilter;
  visibleCount: number;
  pendingPatch: PendingPatch | null;
  applyArmed: boolean;
  onSelectAll: () => void;
  onSelectVisible: () => void;
  onSelectLinked: () => void;
  onClearSelection: () => void;
  onStageFlag: (key: FlagKey, value: boolean) => void;
  onStageIsolate: () => void;
  onApply: () => void;
  onDiscard: () => void;
  onOpenFlags: () => void;
  onHideFlags: () => void;
}): React.ReactElement {
  const showFlags = !compact || flagsExpanded;
  const noun = selectedCount === 1 ? 'entry' : 'entries';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="text-xs font-semibold text-fg">
          {selectedCount} {noun} selected
        </p>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={onSelectAll}
            className="rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-medium text-fg-muted hover:bg-hover hover:text-fg touch-manipulation"
          >
            All
          </button>
          {(query.trim() || filter !== 'all') && (
            <button
              type="button"
              onClick={onSelectVisible}
              disabled={visibleCount === 0}
              className="rounded-md border border-border bg-surface px-2 py-1 text-[10px] text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-40 touch-manipulation"
            >
              Visible ({visibleCount})
            </button>
          )}
          <button
            type="button"
            onClick={onSelectLinked}
            className="rounded-md border border-border bg-surface px-2 py-1 text-[10px] text-fg-muted hover:bg-hover hover:text-fg touch-manipulation"
          >
            Linked
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface px-2 py-1 text-[10px] text-fg-muted hover:bg-hover hover:text-fg touch-manipulation"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
        {compact && (
          <button
            type="button"
            onClick={showFlags ? onHideFlags : onOpenFlags}
            aria-expanded={showFlags}
            className="ml-auto inline-flex items-center gap-0.5 rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-medium text-fg-muted hover:bg-hover hover:text-fg touch-manipulation"
          >
            {showFlags ? 'Hide flags' : 'Edit flags'}
            <ChevronDown className={`h-3 w-3 transition-transform ${showFlags ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {showFlags && (
        <>
          <div className="max-h-[min(40dvh,16rem)] space-y-3 divide-y divide-border/80 overflow-y-auto">
            {FLAG_ROWS.map((row, i) => (
              <div
                key={row.key}
                className={i === 0 ? 'pb-3' : i === FLAG_ROWS.length - 1 ? 'pt-3' : 'py-3'}
              >
                <FlagToggleRow
                  label={row.label}
                  hint={row.hint}
                  state={flagState(selectedEntries, row.key)}
                  pendingValue={pendingPatch?.key === row.key ? pendingPatch.value : null}
                  onSet={(v) => onStageFlag(row.key, v)}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onStageIsolate}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors touch-manipulation ${
                pendingPatch?.key === 'both'
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border bg-muted/40 text-fg-muted hover:bg-hover hover:text-fg'
              }`}
              title="Stage Non-recursable ON + Prevent further recursion ON for the selection"
            >
              Isolate: block both directions
            </button>
            {pendingPatch ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] text-fg-muted">
                  Pending: <span className="font-medium text-fg">{pendingLabel(pendingPatch)}</span>{' '}
                  → {pendingPatch.value ? 'ON' : 'OFF'} for {selectedCount} {noun}
                </p>
                <button
                  type="button"
                  onClick={onApply}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold touch-manipulation ${
                    applyArmed
                      ? 'bg-warning text-fg-inverse'
                      : 'bg-accent text-accent-fg hover:opacity-90'
                  }`}
                >
                  {selectedCount > ARM_THRESHOLD && !applyArmed
                    ? `Apply to ${selectedCount} entries…`
                    : applyArmed
                      ? 'Confirm apply'
                      : 'Apply'}
                </button>
                <button
                  type="button"
                  onClick={onDiscard}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-muted hover:bg-hover hover:text-fg touch-manipulation"
                >
                  Discard
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-fg-subtle">
                Nothing staged; pick On/Off above, then Apply.
              </p>
            )}
          </div>
        </>
      )}

      {compact && !showFlags && pendingPatch && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-fg-muted">
            Pending: <span className="font-medium text-fg">{pendingLabel(pendingPatch)}</span> →{' '}
            {pendingPatch.value ? 'ON' : 'OFF'}
          </p>
          <button
            type="button"
            onClick={onApply}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold touch-manipulation ${
              applyArmed
                ? 'bg-warning text-fg-inverse'
                : 'bg-accent text-accent-fg hover:opacity-90'
            }`}
          >
            {selectedCount > ARM_THRESHOLD && !applyArmed
              ? `Apply to ${selectedCount} entries…`
              : applyArmed
                ? 'Confirm apply'
                : 'Apply'}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-muted hover:bg-hover hover:text-fg touch-manipulation"
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
}

export function RecursionBookPanel({
  focusEntryId,
  entries,
  graph,
  onUpdateEntries,
  onPatchEntry,
}: RecursionBookPanelProps): React.ReactElement {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [inspectedId, setInspectedId] = useState<number | null>(() =>
    focusEntryId != null && entries.some((e) => e.id === focusEntryId) ? focusEntryId : null,
  );
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ListFilter>('all');
  const [forcedView, setForcedView] = useState<ViewMode | null>(null);
  const [showStandalone, setShowStandalone] = useState(false);
  const [pendingPatch, setPendingPatch] = useState<PendingPatch | null>(null);
  const [applyArmed, setApplyArmed] = useState(false);
  const [flagsOpen, setFlagsOpen] = useState(false);
  const isCompact = useCompactViewport();

  const entryIdSet = useMemo(() => new Set(entries.map((e) => e.id)), [entries]);

  const stats = useMemo(() => getBookRecursionStats(entries, graph), [entries, graph]);

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

  const preferList = shouldPreferListLayout(entries.length, stats.edgeCount);
  const viewMode: ViewMode = isCompact
    ? 'list'
    : (forcedView ?? (preferList ? 'list' : 'web'));

  // Drop ids for deleted entries so bulk ops cannot act on ghosts.
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

    // Stable ST uid order so bulk flag edits (which change graph degrees) do not reshuffle.
    filtered.sort((a, b) => a.entry.id - b.entry.id);
    return filtered;
  }, [entries, graph, query, filter, indexById]);

  // Rendering goes through the map, so a deleted entry reads as "nothing inspected".
  const inspectedEntry = inspectedId != null ? entryById.get(inspectedId) ?? null : null;
  const inbound = inspectedEntry ? (graph.incoming.get(inspectedEntry.id) ?? []) : [];
  const outbound = inspectedEntry ? (graph.outgoing.get(inspectedEntry.id) ?? []) : [];

  const selectedEntries = useMemo(
    () => entries.filter((e) => activeSelectedIds.has(e.id)),
    [entries, activeSelectedIds],
  );

  /** Any change to the selection discards a staged patch. */
  const clearPending = useCallback(() => {
    setPendingPatch(null);
    setApplyArmed(false);
  }, []);

  const inspect = useCallback((id: number) => {
    setInspectedId((prev) => (prev === id ? null : id));
  }, []);

  const clearInspected = useCallback(() => {
    setInspectedId(null);
  }, []);

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
      clearPending();
    },
    [entryIdSet, clearPending],
  );

  const selectAllEntries = useCallback(() => {
    setSelectedIds(new Set(entries.map((e) => e.id)));
    clearPending();
  }, [entries, clearPending]);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(sortedEntries.map((s) => s.entry.id)));
    clearPending();
  }, [sortedEntries, clearPending]);

  const selectAllLinked = useCallback(() => {
    const next = new Set<number>();
    for (const e of entries) {
      const { inbound, outbound } = degrees(graph, e.id);
      if (inbound + outbound > 0) next.add(e.id);
    }
    setSelectedIds(next);
    clearPending();
  }, [entries, graph, clearPending]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setFlagsOpen(false);
    clearPending();
  }, [clearPending]);

  const stageFlag = useCallback((key: FlagKey, value: boolean) => {
    setPendingPatch((prev) =>
      prev && prev.key === key && prev.value === value ? null : { key, value },
    );
    setApplyArmed(false);
    setFlagsOpen(true);
  }, []);

  const stageIsolate = useCallback(() => {
    setPendingPatch((prev) =>
      prev && prev.key === 'both' ? null : { key: 'both', value: true },
    );
    setApplyArmed(false);
    setFlagsOpen(true);
  }, []);

  const applyPending = useCallback(() => {
    if (!pendingPatch || activeSelectedIds.size === 0) return;
    if (activeSelectedIds.size > ARM_THRESHOLD && !applyArmed) {
      setApplyArmed(true);
      return;
    }
    const patch: RecursionFlagPatch =
      pendingPatch.key === 'both'
        ? { excludeRecursion: pendingPatch.value, preventRecursion: pendingPatch.value }
        : { [pendingPatch.key]: pendingPatch.value };
    onUpdateEntries([...activeSelectedIds], patch);
    setPendingPatch(null);
    setApplyArmed(false);
  }, [pendingPatch, activeSelectedIds, applyArmed, onUpdateEntries]);

  const inspectedSelected = inspectedEntry != null && activeSelectedIds.has(inspectedEntry.id);
  const compactFlagsExpanded =
    isCompact && flagsOpen && inspectedEntry == null && activeSelectedIds.size > 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="flex items-center gap-3 text-[11px] text-fg-subtle">
          <span>
            <span className="font-semibold tabular-nums text-fg">{stats.edgeCount}</span> paths
          </span>
          <span>
            <span className="font-semibold tabular-nums text-fg">{stats.linkedCount}</span>
            <span className="text-fg-subtle">/{stats.entryCount}</span> in web
          </span>
          <span>
            <span className="font-semibold tabular-nums text-fg">{stats.isolatedCount}</span> standalone
          </span>
        </div>
        {viewMode === 'list' && (
          <>
            <div className="relative min-w-40 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search entries…"
                className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-2 text-xs text-fg placeholder:text-fg-subtle outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div className="flex gap-1">
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
                  className={`rounded-md px-2 py-1.5 text-[11px] font-medium touch-manipulation ${
                    filter === id
                      ? 'bg-accent-soft text-accent'
                      : 'text-fg-muted hover:bg-hover hover:text-fg'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
        {!isCompact && (
          <div className="ml-auto flex gap-1 rounded-lg border border-border p-0.5" role="group" aria-label="View mode">
            {(
              [
                ['web', 'Web', GitFork],
                ['list', 'List', List],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setForcedView(id)}
                aria-pressed={viewMode === id}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium touch-manipulation ${
                  viewMode === id
                    ? 'bg-accent-soft text-accent'
                    : 'text-fg-muted hover:bg-hover hover:text-fg'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {preferList && viewMode === 'web' && (
        <p className="shrink-0 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-fg-muted">
          This book is large ({stats.entryCount} entries · {stats.edgeCount} links). The web view
          may feel slow, the list view is usually easier here.
        </p>
      )}

      {/* Map fills all remaining space; inspector/selection-bar overlay it */}
      <div className="relative min-h-0 flex-1">
        {/* Web or list, full region */}
        {viewMode === 'web' ? (
          <RecursionWebView
            entries={entries}
            graph={graph}
            indexById={indexById}
            inspectedId={inspectedId}
            selectedIds={activeSelectedIds}
            showStandalone={showStandalone}
            onToggleShowStandalone={setShowStandalone}
            onInspect={inspect}
            onToggleSelect={toggleSelect}
          />
        ) : (
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-muted/20">
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {sortedEntries.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-fg-muted">No matching entries.</li>
              ) : (
                sortedEntries.map(({ entry, inbound: inN, outbound: outN }) => {
                  const active = inspectedId === entry.id;
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
                          className="flex shrink-0 items-center px-2.5 text-fg-muted hover:text-fg touch-manipulation md:px-2"
                          aria-label={checked ? 'Deselect' : 'Select for bulk edit'}
                          aria-pressed={checked}
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
                          aria-pressed={active}
                          className="min-w-0 flex-1 px-1 py-2.5 text-left touch-manipulation md:py-2"
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
            {isCompact && inspectedEntry && (
              <div className="min-h-0 shrink-0 space-y-3 overflow-y-auto border-t border-border bg-surface p-3 max-h-[min(60dvh,28rem)]">
                <InspectorBody
                  inspectedEntry={inspectedEntry}
                  indexById={indexById}
                  entryById={entryById}
                  inbound={inbound}
                  outbound={outbound}
                  inspectedSelected={inspectedSelected}
                  onToggleSelect={toggleSelect}
                  onClearInspected={clearInspected}
                  onPatchEntry={onPatchEntry}
                  onInspect={inspect}
                />
              </div>
            )}
            {isCompact && !inspectedEntry && activeSelectedIds.size === 0 && (
              <p className="shrink-0 border-t border-border px-3 py-2 text-[11px] text-fg-subtle">
                Tap a row to inspect it
              </p>
            )}
            {isCompact && activeSelectedIds.size > 0 && (
              <div className="shrink-0 border-t border-border bg-surface p-3">
                <SelectionBarBody
                  compact
                  flagsExpanded={compactFlagsExpanded}
                  selectedCount={activeSelectedIds.size}
                  selectedEntries={selectedEntries}
                  query={query}
                  filter={filter}
                  visibleCount={sortedEntries.length}
                  pendingPatch={pendingPatch}
                  applyArmed={applyArmed}
                  onSelectAll={selectAllEntries}
                  onSelectVisible={selectAllVisible}
                  onSelectLinked={selectAllLinked}
                  onClearSelection={clearSelection}
                  onStageFlag={stageFlag}
                  onStageIsolate={stageIsolate}
                  onApply={applyPending}
                  onDiscard={clearPending}
                  onOpenFlags={() => {
                    clearInspected();
                    setFlagsOpen(true);
                  }}
                  onHideFlags={() => setFlagsOpen(false)}
                />
              </div>
            )}
          </div>
        )}

        {!isCompact && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-full max-w-sm flex-col gap-3 p-3 sm:w-96">
            {!inspectedEntry ? (
              <div className="flex flex-1 items-end justify-end">
                <p className="rounded-lg border border-dashed border-border bg-surface/85 px-3 py-2 text-[11px] text-fg-subtle backdrop-blur-sm">
                  Click a {viewMode === 'web' ? 'node' : 'row'} to inspect it
                </p>
              </div>
            ) : (
              <div className="pointer-events-auto flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto rounded-2xl border border-border bg-surface/95 p-3 shadow-2xl backdrop-blur-md">
                <InspectorBody
                  inspectedEntry={inspectedEntry}
                  indexById={indexById}
                  entryById={entryById}
                  inbound={inbound}
                  outbound={outbound}
                  inspectedSelected={inspectedSelected}
                  onToggleSelect={toggleSelect}
                  onClearInspected={clearInspected}
                  onPatchEntry={onPatchEntry}
                  onInspect={inspect}
                />
              </div>
            )}
          </div>
        )}

        {!isCompact && activeSelectedIds.size > 0 && (
          <div className="absolute inset-x-3 bottom-3 z-10 rounded-xl border border-border bg-surface/95 p-3 shadow-2xl backdrop-blur-md">
            <SelectionBarBody
              compact={false}
              flagsExpanded
              selectedCount={activeSelectedIds.size}
              selectedEntries={selectedEntries}
              query={query}
              filter={filter}
              visibleCount={sortedEntries.length}
              pendingPatch={pendingPatch}
              applyArmed={applyArmed}
              onSelectAll={selectAllEntries}
              onSelectVisible={selectAllVisible}
              onSelectLinked={selectAllLinked}
              onClearSelection={clearSelection}
              onStageFlag={stageFlag}
              onStageIsolate={stageIsolate}
              onApply={applyPending}
              onDiscard={clearPending}
              onOpenFlags={() => setFlagsOpen(true)}
              onHideFlags={() => setFlagsOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
