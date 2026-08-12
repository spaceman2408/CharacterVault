/**
 * Snapshot history modal for standalone lorebooks.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Camera, Check, History, LoaderCircle, RotateCcw, Trash2, X } from 'lucide-react';
import type {
  LorebookSnapshot,
  LorebookSnapshotMetadata,
  VaultLorebook,
} from '../../db/characterTypes';
import { useLorebookContext } from '../../context';
import { lorebookSnapshotService } from '../../services/LorebookSnapshotService';

const SOURCE_LABELS: Record<string, string> = {
  open: 'Opened',
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
  onFlushPending,
  onToast,
}: {
  lorebookId: string;
  onClose: () => void;
  onFlushPending: () => Promise<VaultLorebook | null>;
  onToast: (type: 'success' | 'info' | 'error', title: string, message: string) => void;
}): React.ReactElement {
  const { refreshLorebooks, openLorebook } = useLorebookContext();
  const [items, setItems] = useState<LorebookSnapshotMetadata[]>([]);
  const [selected, setSelected] = useState<LorebookSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const meta = await lorebookSnapshotService.listMetadata(lorebookId);
      setItems(meta);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [lorebookId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const meta = await lorebookSnapshotService.listMetadata(lorebookId);
        if (!cancelled) setItems(meta);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lorebookId]);

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
      await reload({ silent: true });
      setSelected(null);
      onToast('success', 'Lorebook restored', 'The lorebook was restored from the selected revision.');
    } catch {
      onToast('error', 'Restore failed', 'The lorebook could not be restored from this revision.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    const target = items.find((item) => item.id === id);
    if (target?.source === 'open') return;
    if (!window.confirm('Delete this snapshot?')) return;
    setBusy(true);
    try {
      await lorebookSnapshotService.delete(id);
      if (selected?.id === id) setSelected(null);
      await reload({ silent: true });
      onToast('success', 'Revision deleted', 'The selected revision was removed from local history.');
    } catch {
      onToast('error', 'Delete failed', 'The revision could not be deleted.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateBaseline = async () => {
    if (!selected || selected.source !== 'open') return;
    const confirmed = window.confirm(
      'Replace the opened baseline with the current lorebook? The original baseline cannot be recovered.',
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      const book = await onFlushPending();
      if (!book) {
        onToast('error', 'Update failed', 'The current lorebook could not be read.');
        return;
      }
      const result = await lorebookSnapshotService.overwriteBaseline(book, selected.id);
      if (result === 'updated') {
        onToast(
          'success',
          'Baseline updated',
          'The opened baseline was overwritten with the current lorebook.',
        );
        await reload({ silent: true });
        const snap = await lorebookSnapshotService.getById(selected.id);
        setSelected(snap ?? null);
      } else {
        onToast('info', 'No new revision', 'No changes were detected since the opened baseline.');
      }
    } catch {
      onToast('error', 'Update failed', 'The opened baseline could not be overwritten.');
    } finally {
      setBusy(false);
    }
  };

  const handleManualSnapshot = async () => {
    setBusy(true);
    try {
      const book = await onFlushPending();
      if (!book) {
        onToast('error', 'Save failed', 'The current lorebook could not be read.');
        return;
      }
      const snapshot = await lorebookSnapshotService.createFromLorebook(book, 'manual');
      if (snapshot) {
        onToast('success', 'Revision saved', 'A new manual revision was added to local history.');
        await reload({ silent: true });
      } else {
        onToast('info', 'No new revision', 'No changes were detected since the latest revision.');
      }
    } catch {
      onToast('error', 'Save failed', 'A manual revision could not be saved.');
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleManualSnapshot()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              Save snapshot
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg p-1.5 text-fg-muted hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
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
                      {item.source !== 'open' ? (
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
                      ) : null}
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
                <div className="flex flex-col gap-2">
                  {selected.source === 'open' && (
                    <button
                      type="button"
                      onClick={() => void handleUpdateBaseline()}
                      disabled={busy}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-warning/40 bg-warning-soft px-3 py-2.5 text-sm font-medium text-warning-soft-fg transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      Update baseline
                    </button>
                  )}
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
