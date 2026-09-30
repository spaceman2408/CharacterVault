import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Clock3,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { useCharacterEditorContext } from '../../context';
import { characterSnapshotService, shouldComputePayloadHash, type CharacterHashes } from '../../services';
import type { Character, SnapshotMetadata, SnapshotDiffEntry } from '../../db/characterTypes';
import { SnapshotChangeList } from './SnapshotChangeList';
import { buildSnapshotChangeGroups } from './snapshotChanges';

interface CharacterHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (type: 'success' | 'info' | 'error', title: string, message: string) => void;
}

type ConfirmAction =
  | { kind: 'delete'; metadata: SnapshotMetadata }
  | { kind: 'restore-whole'; metadata: SnapshotMetadata }
  | { kind: 'restore-section'; metadata: SnapshotMetadata; entry: SnapshotDiffEntry }
  | { kind: 'update-baseline'; metadata: SnapshotMetadata };

const MODAL_CLOSE_MS = 180;
const NEW_SNAPSHOT_HIGHLIGHT_MS = 1800;

function formatSnapshotLabel(source: SnapshotMetadata['source']): string {
  switch (source) {
    case 'open':
      return 'Opened card';
    case 'auto':
      return 'Agentic auto save point';
    case 'manual':
      return 'Manual save point';
    case 'rollback':
      return 'Post-restore save point';
    default:
      return characterSnapshotService.formatSnapshotSource(source);
  }
}

function formatSnapshotDescription(source: SnapshotMetadata['source']): string {
  switch (source) {
    case 'open':
      return 'Saved when this card was opened.';
    case 'auto':
      return 'Saved automatically by the agentic system.';
    case 'manual':
      return 'Saved on demand from the revisions panel.';
    case 'rollback':
      return 'Saved after a restore completed.';
    default:
      return characterSnapshotService.describeSnapshotSource(source);
  }
}

function SnapshotSourceBadge({ source }: { source: SnapshotMetadata['source'] }): React.ReactElement {
  const toneClassName = source === 'manual'
    ? 'bg-info-soft text-info-soft-fg'
    : source === 'rollback'
      ? 'bg-warning-soft text-warning-soft-fg'
      : source === 'open'
        ? 'bg-muted text-fg'
        : 'bg-success-soft text-success-soft-fg';

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClassName}`}>
      {formatSnapshotLabel(source)}
    </span>
  );
}

function ConfirmationDialog({
  action,
  isBusy,
  onCancel,
  onConfirm,
}: {
  action: ConfirmAction;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): React.ReactElement {
  const config = action.kind === 'delete'
    ? {
      eyebrow: 'Delete revision',
      title: 'Remove this revision?',
      description: 'This removes the saved revision from local history. Your current draft will not change.',
      confirmLabel: 'Delete revision',
      confirmClassName: 'bg-danger text-white hover:opacity-90',
    }
    : action.kind === 'restore-whole'
      ? {
        eyebrow: 'Restore card',
        title: 'Restore the full card from this revision?',
        description: `Your current draft will be replaced with the "${formatSnapshotLabel(action.metadata.source)}" revision from ${new Date(action.metadata.createdAt).toLocaleString()}. A rollback snapshot will still be created automatically.`,
        confirmLabel: 'Restore card',
        confirmClassName: 'bg-accent text-accent-fg hover:opacity-90',
      }
      : action.kind === 'restore-section'
        ? {
          eyebrow: 'Restore section',
          title: `Restore ${action.entry.label}?`,
          description: `Only this section will be restored from the "${formatSnapshotLabel(action.metadata.source)}" revision. Other sections remain unchanged.`,
          confirmLabel: 'Restore section',
          confirmClassName: 'bg-accent text-accent-fg hover:opacity-90',
        }
        : {
          eyebrow: 'Update base card',
          title: 'Overwrite the base card snapshot?',
          description: `This replaces the "Opened card" baseline revision with your current draft. The original baseline will be overwritten and cannot be recovered.`,
          confirmLabel: 'Overwrite base card',
          confirmClassName: 'bg-warning text-white hover:opacity-90',
        };

  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-overlay p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="w-full max-w-md rounded-2xl border p-5 shadow-2xl border-border bg-surface">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl p-2.5 bg-muted text-fg">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{config.eyebrow}</p>
            <h4 className="mt-1 text-lg font-semibold text-fg">{config.title}</h4>
            <p className="mt-2 text-sm leading-6 text-fg-muted">{config.description}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-border text-fg hover:bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${config.confirmClassName}`}
          >
            {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function TimelineCard({
  metadata,
  isSelected,
  isHighlighted,
  hasChanges,
  onSelect,
  onDelete,
}: {
  metadata: SnapshotMetadata;
  isSelected: boolean;
  isHighlighted: boolean;
  hasChanges: boolean;
  onSelect: () => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 transition-all ${
        isSelected
          ? 'border-fg bg-surface shadow-sm'
          : 'border-border bg-surface hover:border-border-strong hover:bg-hover'
      } ${isHighlighted ? 'ring-2 ring-success/40' : ''}`}
    >
      <div className="flex items-center gap-2">
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <SnapshotSourceBadge source={metadata.source} />
          <span className="shrink-0 text-xs text-fg-subtle">
            {new Date(metadata.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        </button>
        {!characterSnapshotService.isBaselineSnapshotMetadata(metadata) ? (
          <button
            type="button"
            onClick={onDelete}
            className="shrink-0 rounded p-1.5 text-fg-subtle transition-colors hover:bg-hover hover:text-danger"
            title="Delete revision"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {hasChanges && (
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" title="Has changes" />
        )}
      </div>
    </div>
  );
}

function MobileRevisionScroller({
  metadata,
  selectedSnapshotId,
  highlightedSnapshotIds,
  hasChangesById,
  onSelect,
  onDelete,
}: {
  metadata: SnapshotMetadata[];
  selectedSnapshotId: string | null;
  highlightedSnapshotIds: string[];
  hasChangesById: Record<string, boolean>;
  onSelect: (snapshotId: string) => void;
  onDelete: (metadata: SnapshotMetadata) => void;
}): React.ReactElement {
  return (
    <div className="overflow-x-auto px-4 pt-3 pb-4 md:hidden">
      <div className="flex gap-3">
        {metadata.map(meta => (
          <div key={meta.id} className="min-w-[16rem] max-w-[16rem] shrink-0">
            <TimelineCard
              metadata={meta}
              isSelected={meta.id === selectedSnapshotId}
              isHighlighted={highlightedSnapshotIds.includes(meta.id)}
              hasChanges={hasChangesById[meta.id] ?? false}
              onSelect={() => onSelect(meta.id)}
              onDelete={() => onDelete(meta)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface SnapshotSummaryProps {
  metadata: SnapshotMetadata;
  changedSectionCount: number;
  hasActiveSectionDiff: boolean;
  isBusy: boolean;
  isSnapshotMissing: boolean;
  hasAttemptedLoad: boolean;
  onRestore: () => void;
  onUpdateBaseline: () => void;
}

function SnapshotSummary({
  metadata,
  changedSectionCount,
  hasActiveSectionDiff,
  isBusy,
  isSnapshotMissing,
  hasAttemptedLoad,
  onRestore,
  onUpdateBaseline,
}: SnapshotSummaryProps): React.ReactElement {
  const restoreDisabledReason = isSnapshotMissing
    ? 'Snapshot data is missing or corrupted'
    : changedSectionCount === 0
      ? 'No changes to restore'
      : undefined;

  const isBaseline = metadata.source === 'open';
  const canUpdateBaseline = isBaseline && changedSectionCount > 0 && !isSnapshotMissing;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-fg">{formatSnapshotLabel(metadata.source)}</h3>
          <p className="text-sm text-fg-muted">{formatSnapshotDescription(metadata.source)}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center">
          {isBaseline && (
            <button
              type="button"
              onClick={onUpdateBaseline}
              disabled={isBusy || !canUpdateBaseline}
              title={canUpdateBaseline ? undefined : 'Accept the current draft as the new base card'}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2.5 text-sm font-medium text-warning-soft-fg transition-colors touch-manipulation hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:w-auto sm:justify-start sm:py-2"
            >
              <Check className="h-4 w-4 shrink-0" />
              Update base card
            </button>
          )}
          <button
            type="button"
            onClick={onRestore}
            disabled={isBusy || changedSectionCount === 0 || isSnapshotMissing}
            title={restoreDisabledReason}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-accent-fg transition-colors touch-manipulation hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:w-auto sm:justify-start sm:py-2"
          >
            <RotateCcw className="h-4 w-4 shrink-0" />
            Restore card
          </button>
        </div>
      </div>

      {isSnapshotMissing && hasAttemptedLoad && (
        <div className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning-soft-fg">
          <span className="font-medium">Warning:</span> This revision's snapshot data could not be loaded. It may have been corrupted or failed to save properly.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3 text-sm border-border text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          {new Date(metadata.createdAt).toLocaleString()}
        </span>
        <span>{changedSectionCount} {changedSectionCount === 1 ? 'section' : 'sections'} changed</span>
        {hasActiveSectionDiff && (
          <span className="text-info">Includes active section</span>
        )}
      </div>
    </div>
  );
}

export function CharacterHistoryModal({
  isOpen,
  onClose,
  onToast,
}: CharacterHistoryModalProps): React.ReactElement {
  const {
    currentCharacter,
    activeSection,
    snapshotMetadata,
    isSnapshotsLoading,
    refreshSnapshots,
    createManualSnapshot,
    deleteSnapshot,
    restoreSnapshot,
    updateBaselineSnapshot,
    getSnapshotDiff,
  } = useCharacterEditorContext();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [snapshotLoaded, setSnapshotLoaded] = useState(false);
  const [diffEntries, setDiffEntries] = useState<SnapshotDiffEntry[]>([]);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  // Get selected metadata for display
  const selectedMetadata = useMemo(
    () => snapshotMetadata.find(meta => meta.id === selectedSnapshotId) ?? null,
    [snapshotMetadata, selectedSnapshotId]
  );
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [isContentReady, setIsContentReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [highlightedSnapshotIds, setHighlightedSnapshotIds] = useState<string[]>([]);
  const [hasChangesById, setHasChangesById] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState<{ character: Character; hashes: CharacterHashes } | null>(null);
  const changeCacheRef = useRef(new Map<string, boolean>());
  const previousSnapshotIdsRef = useRef<string[]>([]);
  const snapshotHighlightTimeoutsRef = useRef<number[]>([]);
  const closeTimeoutRef = useRef<number | null>(null);
  const confirmReloadGenerationRef = useRef(0);

  const clearSnapshotHighlightTimeouts = useCallback(() => {
    snapshotHighlightTimeoutsRef.current.forEach(timeoutId => window.clearTimeout(timeoutId));
    snapshotHighlightTimeoutsRef.current = [];
  }, []);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const resetModalState = useCallback(() => {
    setSelectedSnapshotId(null);
    setSnapshotLoaded(false);
    setDiffEntries([]);
    setConfirmAction(null);
    setHighlightedSnapshotIds([]);
    setHasAttemptedLoad(false);
    setIsContentReady(false);
    setHasChangesById({});
    setCurrent(null);
    changeCacheRef.current = new Map();
    previousSnapshotIdsRef.current = [];
    clearSnapshotHighlightTimeouts();
    confirmReloadGenerationRef.current += 1;
  }, [clearSnapshotHighlightTimeouts]);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsClosing(false);
      const readyTimeoutId = window.setTimeout(() => {
        setIsContentReady(true);
      }, 100);
      return () => window.clearTimeout(readyTimeoutId);
    }

    if (!isVisible) {
      resetModalState();
      return;
    }

    setIsClosing(true);
    setIsContentReady(false);
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;
      setIsVisible(false);
      setIsClosing(false);
      resetModalState();
    }, MODAL_CLOSE_MS);

    return () => clearCloseTimeout();
  }, [isOpen, isVisible, resetModalState, clearCloseTimeout]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    void refreshSnapshots();
  }, [isVisible, refreshSnapshots]);

  // Hash the card only when it changes; hashing encodes the whole image.
  useEffect(() => {
    if (!shouldComputePayloadHash(isVisible) || !currentCharacter) {
      if (!isVisible) {
        setCurrent(null);
      }
      return;
    }

    let cancelled = false;
    void characterSnapshotService.computeCharacterHashes(currentCharacter).then(hashes => {
      if (!cancelled) {
        changeCacheRef.current = new Map();
        setCurrent({ character: currentCharacter, hashes });
      }
    }).catch(error => {
      console.error('Failed to hash the current card:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [currentCharacter, isVisible]);

  // Revision payloads never change under the same hash, so each is loaded at
  // most once per card state, one at a time, and the loop stops when superseded.
  useEffect(() => {
    if (!current) {
      return;
    }

    const cache = changeCacheRef.current;
    let cancelled = false;
    void (async () => {
      const result: Record<string, boolean> = {};
      for (const meta of snapshotMetadata) {
        const key = `${meta.id}:${meta.payloadHash}`;
        let changed = cache.get(key);
        if (changed === undefined) {
          changed = await characterSnapshotService.snapshotHasChanges(meta, current.character, current.hashes);
          if (cancelled) {
            return;
          }
          cache.set(key, changed);
        }
        result[meta.id] = changed;
      }
      if (!cancelled) {
        setHasChangesById(result);
      }
    })().catch(error => {
      console.error('Failed to compare revisions:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [current, snapshotMetadata]);

  // Select the first snapshot when list loads
  useEffect(() => {
    if (!isVisible) {
      return;
    }

    setSelectedSnapshotId(currentSelectedSnapshotId => {
      if (currentSelectedSnapshotId && snapshotMetadata.some(meta => meta.id === currentSelectedSnapshotId)) {
        return currentSelectedSnapshotId;
      }

      return snapshotMetadata[0]?.id ?? null;
    });
  }, [isVisible, snapshotMetadata]);

  useEffect(() => {
    if (!isVisible) {
      previousSnapshotIdsRef.current = [];
      return;
    }

    const previousSnapshotIds = previousSnapshotIdsRef.current;
    const nextSnapshotIds = snapshotMetadata.map(meta => meta.id);

    if (
      previousSnapshotIds.length > 0 &&
      nextSnapshotIds.length > 0 &&
      previousSnapshotIds[0] &&
      nextSnapshotIds[0] !== previousSnapshotIds[0]
    ) {
      const insertedSnapshotIds: string[] = [];

      for (const snapshotId of nextSnapshotIds) {
        if (snapshotId === previousSnapshotIds[0]) {
          break;
        }
        insertedSnapshotIds.push(snapshotId);
      }

      if (insertedSnapshotIds.length > 0) {
        setHighlightedSnapshotIds(prev => [...new Set([...prev, ...insertedSnapshotIds])]);
        const timeoutId = window.setTimeout(() => {
          setHighlightedSnapshotIds(prev => prev.filter(id => !insertedSnapshotIds.includes(id)));
        }, NEW_SNAPSHOT_HIGHLIGHT_MS);
        snapshotHighlightTimeoutsRef.current.push(timeoutId);
      }
    }

    previousSnapshotIdsRef.current = nextSnapshotIds;
  }, [isVisible, snapshotMetadata]);

  useEffect(() => () => {
    clearSnapshotHighlightTimeouts();
    clearCloseTimeout();
  }, [clearSnapshotHighlightTimeouts, clearCloseTimeout]);

  const closeModal = useCallback(() => {
    if (isClosing) {
      return;
    }

    setIsClosing(true);
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;
      setIsVisible(false);
      setIsClosing(false);
      resetModalState();
      onClose();
    }, MODAL_CLOSE_MS);
  }, [isClosing, onClose, resetModalState, clearCloseTimeout]);

  const requestClose = useCallback(() => {
    if (isBusy || confirmAction) {
      return;
    }

    closeModal();
  }, [closeModal, confirmAction, isBusy]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirmAction) {
        requestClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmAction, isVisible, requestClose]);

  useEffect(() => {
    if (!selectedSnapshotId) {
      setSnapshotLoaded(false);
      setDiffEntries([]);
      setHasAttemptedLoad(false);
      return;
    }

    const capturedId = selectedSnapshotId;
    setIsLoadingDiff(true);
    setHasAttemptedLoad(false);
    let cancelled = false;
    const startTime = performance.now();
    const MIN_LOADING_MS = 300;
    let loadingTimeoutId: number | null = null;

    void (async () => {
      try {
        const { snapshot, entries } = await getSnapshotDiff(capturedId);
        const filtered = entries.filter(entry => entry.changed);

        if (cancelled) return;

        setDiffEntries(filtered);
        setSnapshotLoaded(snapshot !== null);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load diff:', error);
        setDiffEntries([]);
        setSnapshotLoaded(false);
      } finally {
        if (!cancelled) {
          const elapsed = performance.now() - startTime;
          const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
          loadingTimeoutId = window.setTimeout(() => {
            if (!cancelled) {
              setIsLoadingDiff(false);
              setHasAttemptedLoad(true);
            }
          }, remaining);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (loadingTimeoutId !== null) {
        window.clearTimeout(loadingTimeoutId);
      }
    };
  }, [selectedSnapshotId, getSnapshotDiff]);

  const changedSectionCount = diffEntries.length;
  const changeGroups = useMemo(() => buildSnapshotChangeGroups(diffEntries), [diffEntries]);
  const hasActiveSectionDiff = diffEntries.some(entry => entry.section === activeSection);

  if (!isVisible || !currentCharacter) {
    return <></>;
  }

  const handleCreateSnapshot = async () => {
    setIsBusy(true);

    try {
      const result = await createManualSnapshot();
      if (result === 'created') {
        onToast('success', 'Revision saved', 'A new manual revision was added to local history.');
      } else {
        onToast('info', 'No new revision', 'No changes were detected since the latest revision.');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) {
      return;
    }

    setIsBusy(true);

    try {
      if (confirmAction.kind === 'delete') {
        await deleteSnapshot(confirmAction.metadata.id);
        onToast('success', 'Revision deleted', 'The selected revision was removed from local history.');
      } else if (confirmAction.kind === 'restore-whole') {
        await restoreSnapshot(confirmAction.metadata.id, 'whole');
        onToast('success', 'Card restored', 'The full card was restored from the selected revision.');
        closeModal();
      } else if (confirmAction.kind === 'update-baseline') {
        await updateBaselineSnapshot(confirmAction.metadata.id);
        onToast('success', 'Base card updated', 'The "Opened card" baseline was overwritten with the current draft.');
        if (selectedSnapshotId) {
          const reloadGeneration = ++confirmReloadGenerationRef.current;
          setIsLoadingDiff(true);
          setHasAttemptedLoad(false);
          try {
            const { snapshot, entries } = await getSnapshotDiff(selectedSnapshotId);
            if (reloadGeneration !== confirmReloadGenerationRef.current) {
              return;
            }
            setDiffEntries(entries.filter(entry => entry.changed));
            setSnapshotLoaded(snapshot !== null);
            setHasAttemptedLoad(true);
          } finally {
            if (reloadGeneration === confirmReloadGenerationRef.current) {
              setIsLoadingDiff(false);
            }
          }
        }
      } else {
        await restoreSnapshot(confirmAction.metadata.id, 'section', confirmAction.entry.section);
        onToast('success', 'Section restored', `${confirmAction.entry.label} was restored from the selected revision.`);
        if (selectedSnapshotId) {
          const reloadGeneration = ++confirmReloadGenerationRef.current;
          setIsLoadingDiff(true);
          try {
            const { snapshot, entries } = await getSnapshotDiff(selectedSnapshotId);
            if (reloadGeneration !== confirmReloadGenerationRef.current) {
              return;
            }
            setDiffEntries(entries.filter(entry => entry.changed));
            setSnapshotLoaded(snapshot !== null);
          } finally {
            if (reloadGeneration === confirmReloadGenerationRef.current) {
              setIsLoadingDiff(false);
            }
          }
        }
      }

      setConfirmAction(null);
    } catch {
      if (confirmAction.kind === 'delete') {
        onToast('error', 'Delete failed', 'The revision could not be deleted.');
      } else if (confirmAction.kind === 'restore-whole') {
        onToast('error', 'Restore failed', 'The full card could not be restored from this revision.');
      } else if (confirmAction.kind === 'update-baseline') {
        onToast('error', 'Update failed', 'The base card snapshot could not be overwritten.');
      } else {
        onToast('error', 'Restore failed', `${confirmAction.entry.label} could not be restored from this revision.`);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleSelectSnapshot = (snapshotId: string) => {
    if (snapshotId !== selectedSnapshotId) {
      setSelectedSnapshotId(snapshotId);
      setDiffEntries([]);
      setSnapshotLoaded(false);
      setIsLoadingDiff(true);
      setHasAttemptedLoad(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-history-title"
        className={`relative flex h-dvh w-full flex-col overflow-hidden bg-surface transition-all duration-200 sm:h-[min(88vh,860px)] sm:max-w-7xl sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl ${
          isClosing ? 'translate-y-3 opacity-0 sm:translate-y-0 sm:scale-[0.98]' : 'translate-y-0 opacity-100 sm:scale-100'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header - Flattened */}
        <div className="flex items-center justify-between gap-4 border-b px-4 py-3 backdrop-blur-xl border-border bg-bg/90 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Revisions</p>
            <h2 id="character-history-title" className="text-lg font-semibold text-fg">{currentCharacter.name}</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCreateSnapshot()}
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              Save snapshot
            </button>
            <button
              type="button"
              onClick={requestClose}
              disabled={isBusy}
              className="rounded-lg border p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-border text-fg-muted hover:bg-hover hover:text-fg"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Sidebar - Flattened */}
          <aside className="hidden min-h-0 w-full max-w-xs shrink-0 border-r border-border bg-bg/50 md:flex md:flex-col">
            <div className="flex items-center justify-between border-b px-4 py-2.5 border-border">
              <span className="text-sm font-medium text-fg">{snapshotMetadata.length} revisions</span>
            </div>
            <div className={`flex-1 overflow-y-auto p-3 transition-opacity duration-200 ${isContentReady ? 'opacity-100' : 'opacity-0'}`}>
              {isSnapshotsLoading && snapshotMetadata.length === 0 ? (
                <div className="space-y-2">
                  {[0, 1, 2].map(index => (
                    <div
                      key={`timeline-skeleton-${index}`}
                      className="animate-pulse rounded-xl border p-3 border-border bg-surface"
                    >
                      <div className="h-3.5 w-20 rounded bg-hover" />
                      <div className="mt-2 h-2.5 w-full rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : snapshotMetadata.length === 0 ? (
                <div className="rounded-xl border-dashed p-4 text-center text-sm border-border bg-surface text-fg-muted">
                  No revisions available yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {snapshotMetadata.map(meta => (
                    <TimelineCard
                      key={meta.id}
                      metadata={meta}
                      isSelected={meta.id === selectedSnapshotId}
                      isHighlighted={highlightedSnapshotIds.includes(meta.id)}
                      hasChanges={hasChangesById[meta.id] ?? false}
                      onSelect={() => handleSelectSnapshot(meta.id)}
                      onDelete={() => setConfirmAction({ kind: 'delete', metadata: meta })}
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* Main content */}
          <section className="flex min-h-0 flex-1 flex-col">
            {/* Mobile scroller - no header duplication */}
            {isSnapshotsLoading && snapshotMetadata.length === 0 ? null : snapshotMetadata.length > 0 ? (
              <div className={`transition-opacity duration-200 ${isContentReady ? 'opacity-100' : 'opacity-0'}`}>
                <MobileRevisionScroller
                metadata={snapshotMetadata}
                selectedSnapshotId={selectedSnapshotId}
                highlightedSnapshotIds={highlightedSnapshotIds}
                hasChangesById={hasChangesById}
                onSelect={handleSelectSnapshot}
                onDelete={(meta) => setConfirmAction({ kind: 'delete', metadata: meta })}
              />
              </div>
            ) : null}

            <div className={`flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6 transition-opacity duration-200 ${isContentReady ? 'opacity-100' : 'opacity-0'}`}>
              {!selectedSnapshotId ? (
                <div className="animate-fade-in flex min-h-full items-center justify-center rounded-2xl border-dashed p-8 text-center border-border bg-muted">
                  <div className="max-w-md">
                    <h3 className="text-lg font-semibold text-fg">Select a revision</h3>
                    <p className="mt-1 text-sm text-fg-muted">
                      Choose a save point from the timeline to review changes against your current draft.
                    </p>
                  </div>
                </div>
              ) : isLoadingDiff ? (
                <div className="flex min-h-full items-center justify-center">
                  <div className="text-center">
                    <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-fg-subtle" />
                    <p className="mt-2 text-sm text-fg-muted">Loading diff...</p>
                  </div>
                </div>
              ) : (
                <div className="animate-fade-in space-y-6">
                  {/* Snapshot summary - Flattened, no card wrapper */}
                  {selectedMetadata && (
                    <SnapshotSummary
                      metadata={selectedMetadata}
                      changedSectionCount={changedSectionCount}
                      hasActiveSectionDiff={hasActiveSectionDiff}
                      isBusy={isBusy}
                      isSnapshotMissing={!snapshotLoaded}
                      hasAttemptedLoad={hasAttemptedLoad}
                      onRestore={() => selectedMetadata && setConfirmAction({ kind: 'restore-whole', metadata: selectedMetadata })}
                      onUpdateBaseline={() => selectedMetadata && setConfirmAction({ kind: 'update-baseline', metadata: selectedMetadata })}
                    />
                  )}

                  {changedSectionCount === 0 ? (
                    snapshotLoaded && (
                      <p className="text-sm text-fg-muted">
                        This snapshot already matches the current draft. No restore action is needed.
                      </p>
                    )
                  ) : (
                    <SnapshotChangeList
                      key={selectedSnapshotId}
                      groups={changeGroups}
                      activeSection={activeSection}
                      restoreDisabled={isBusy || !snapshotLoaded}
                      onRestore={(entry) => selectedMetadata && setConfirmAction({ kind: 'restore-section', metadata: selectedMetadata, entry })}
                    />
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {confirmAction ? (
          <ConfirmationDialog
            action={confirmAction}
            isBusy={isBusy}
            onCancel={() => {
              if (!isBusy) {
                setConfirmAction(null);
              }
            }}
            onConfirm={() => void handleConfirmAction()}
          />
        ) : null}
      </div>
    </div>
  );
}

export default CharacterHistoryModal;
