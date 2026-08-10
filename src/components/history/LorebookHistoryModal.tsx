/**
 * Snapshot history modal for standalone lorebooks.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { History, RotateCcw, Trash2, X } from 'lucide-react';
import type { LorebookSnapshot, LorebookSnapshotMetadata } from '../../db/characterTypes';
import { useLorebookContext } from '../../context';
import { lorebookSnapshotService } from '../../services/LorebookSnapshotService';
import { lorebookService } from '../../services/LorebookService';

const SOURCE_LABELS: Record<string, string> = {
  open: 'Open',
  auto: 'Auto',
  manual: 'Manual',
  rollback: 'Rollback',
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function LorebookHistoryModal({
  lorebookId,
  onClose,
}: {
  lorebookId: string;
  onClose: () => void;
}): React.ReactElement {
  const { refreshLorebooks, openLorebook } = useLorebookContext();
  const [items, setItems] = useState<LorebookSnapshotMetadata[]>([]);
  const [selected, setSelected] = useState<LorebookSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const meta = await lorebookSnapshotService.listMetadata(lorebookId);
      setItems(meta);
    } finally {
      setLoading(false);
    }
  }, [lorebookId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSelect = async (id: string) => {
    const snap = await lorebookSnapshotService.getById(id);
    setSelected(snap ?? null);
  };

  const handleRestore = async () => {
    if (!selected) return;
    const confirmed = window.confirm(
      'Restore this snapshot? Current lorebook content will be replaced.',
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await lorebookSnapshotService.restore(selected.id);
      await openLorebook(lorebookId);
      await refreshLorebooks();
      await reload();
      setSelected(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this snapshot?')) return;
    await lorebookSnapshotService.delete(id);
    if (selected?.id === id) setSelected(null);
    await reload();
  };

  const handleManualSnapshot = async () => {
    setBusy(true);
    try {
      const book = await lorebookService.get(lorebookId);
      if (book) {
        await lorebookSnapshotService.createFromLorebook(book, 'manual');
        await reload();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lorebook-history-title"
        className="flex max-h-[min(36rem,90dvh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-accent" />
            <h2 id="lorebook-history-title" className="text-sm font-semibold text-fg">
              Lorebook History
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void handleManualSnapshot()}
              disabled={busy}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-50"
            >
              Snapshot now
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-fg-muted hover:bg-hover hover:text-fg"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
          <div className="min-h-0 overflow-y-auto border-b border-border md:border-b-0 md:border-r">
            {loading ? (
              <p className="p-4 text-sm text-fg-muted">Loading…</p>
            ) : items.length === 0 ? (
              <p className="p-4 text-sm text-fg-muted">No snapshots yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void handleSelect(item.id)}
                      className={`flex w-full items-start justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-hover/50 ${
                        selected?.id === item.id ? 'bg-accent-soft' : ''
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-fg">
                          {SOURCE_LABELS[item.source] ?? item.source}
                        </p>
                        <p className="text-xs text-fg-muted">{formatWhen(item.createdAt)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(item.id);
                        }}
                        className="rounded p-1 text-fg-subtle hover:bg-danger-soft hover:text-danger"
                        title="Delete snapshot"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto p-4">
            {!selected ? (
              <p className="text-sm text-fg-muted">Select a snapshot to preview and restore.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-fg">{selected.payload.name}</p>
                  <p className="text-xs text-fg-muted">
                    {selected.payload.book.entries?.length ?? 0} entries ·{' '}
                    {SOURCE_LABELS[selected.source] ?? selected.source}
                  </p>
                </div>
                {selected.payload.description && (
                  <p className="text-xs text-fg-muted">{selected.payload.description}</p>
                )}
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-bg p-2 text-xs">
                  {(selected.payload.book.entries ?? []).slice(0, 40).map((entry) => (
                    <li key={entry.id} className="truncate text-fg-muted">
                      {entry.comment || entry.name || `Entry ${entry.id}`}
                      {entry.keys?.length ? ` · ${entry.keys.slice(0, 3).join(', ')}` : ''}
                    </li>
                  ))}
                  {(selected.payload.book.entries?.length ?? 0) > 40 && (
                    <li className="text-fg-subtle">…and more</li>
                  )}
                </ul>
                <button
                  type="button"
                  onClick={() => void handleRestore()}
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restore snapshot
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
