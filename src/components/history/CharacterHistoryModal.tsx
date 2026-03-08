import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  Clock3,
  History,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { useCharacterEditorContext } from '../../context';
import { characterSnapshotService } from '../../services';
import type { CharacterSnapshot, SnapshotDiffEntry } from '../../db/characterTypes';

interface CharacterHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (type: 'success' | 'info' | 'error', title: string, message: string) => void;
}

interface DiffSegment {
  text: string;
  changed: boolean;
}

interface AlignedLine {
  key: string;
  value: string;
  compareValue: string;
  changed: boolean;
}

interface SectionPreviewProps {
  entry: SnapshotDiffEntry;
}

type ConfirmAction =
  | { kind: 'delete'; snapshot: CharacterSnapshot }
  | { kind: 'restore-whole'; snapshot: CharacterSnapshot }
  | { kind: 'restore-section'; snapshot: CharacterSnapshot; entry: SnapshotDiffEntry };

const MODAL_CLOSE_MS = 180;
const NEW_SNAPSHOT_HIGHLIGHT_MS = 1800;

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return normalizeLineEndings(value);
  }

  if (Array.isArray(value)) {
    return normalizeLineEndings(value.join('\n'));
  }

  if (value === null || value === undefined) {
    return '';
  }

  return JSON.stringify(value, null, 2);
}

function isImageEntry(entry: SnapshotDiffEntry): boolean {
  return entry.section === 'image';
}

function splitChangedSegments(value: string, compareValue: string): DiffSegment[] {
  const normalizedValue = normalizeLineEndings(value);
  const normalizedCompareValue = normalizeLineEndings(compareValue);

  if (normalizedValue === normalizedCompareValue) {
    return normalizedValue ? [{ text: normalizedValue, changed: false }] : [];
  }

  if (!normalizedValue) {
    return [];
  }

  if (!normalizedCompareValue) {
    return [{ text: normalizedValue, changed: true }];
  }

  let prefixLength = 0;
  while (
    prefixLength < normalizedValue.length &&
    prefixLength < normalizedCompareValue.length &&
    normalizedValue[prefixLength] === normalizedCompareValue[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < normalizedValue.length - prefixLength &&
    suffixLength < normalizedCompareValue.length - prefixLength &&
    normalizedValue[normalizedValue.length - 1 - suffixLength] === normalizedCompareValue[normalizedCompareValue.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const prefix = normalizedValue.slice(0, prefixLength);
  const changed = normalizedValue.slice(prefixLength, normalizedValue.length - suffixLength);
  const suffix = suffixLength > 0 ? normalizedValue.slice(normalizedValue.length - suffixLength) : '';

  return [
    ...(prefix ? [{ text: prefix, changed: false }] : []),
    ...(changed ? [{ text: changed, changed: true }] : []),
    ...(suffix ? [{ text: suffix, changed: false }] : []),
  ];
}

function formatSnapshotLabel(snapshot: CharacterSnapshot): string {
  switch (snapshot.source) {
    case 'open':
      return 'Opened card';
    case 'auto':
      return 'Auto save point';
    case 'manual':
      return 'Manual save point';
    case 'rollback':
      return 'Post-restore save point';
    default:
      return characterSnapshotService.formatSnapshotSource(snapshot.source);
  }
}

function formatSnapshotDescription(snapshot: CharacterSnapshot): string {
  switch (snapshot.source) {
    case 'open':
      return 'Saved when this card was opened.';
    case 'auto':
      return 'Saved after edits settled.';
    case 'manual':
      return 'Saved on demand from the revisions panel.';
    case 'rollback':
      return 'Saved after a restore completed.';
    default:
      return characterSnapshotService.describeSnapshotSource(snapshot.source);
  }
}

function alignLines(value: string, compareValue: string): AlignedLine[] {
  const valueLines = normalizeLineEndings(value).split('\n');
  const compareLines = normalizeLineEndings(compareValue).split('\n');
  const rowCount = valueLines.length;
  const columnCount = compareLines.length;

  if (rowCount === columnCount) {
    return valueLines.map((line, index) => ({
      key: line === compareLines[index] ? `match-${index}` : `replace-${index}`,
      value: line,
      compareValue: compareLines[index] ?? '',
      changed: line !== compareLines[index],
    }));
  }

  const distance: number[][] = Array.from(
    { length: rowCount + 1 },
    () => Array<number>(columnCount + 1).fill(0),
  );

  for (let row = 0; row <= rowCount; row += 1) {
    distance[row][0] = row;
  }

  for (let column = 0; column <= columnCount; column += 1) {
    distance[0][column] = column;
  }

  for (let row = 1; row <= rowCount; row += 1) {
    for (let column = 1; column <= columnCount; column += 1) {
      const substitutionCost = valueLines[row - 1] === compareLines[column - 1] ? 0 : 1;
      distance[row][column] = Math.min(
        distance[row - 1][column] + 1,
        distance[row][column - 1] + 1,
        distance[row - 1][column - 1] + substitutionCost,
      );
    }
  }

  const alignedLines: AlignedLine[] = [];
  let row = rowCount;
  let column = columnCount;

  while (row > 0 || column > 0) {
    if (
      row > 0 &&
      column > 0 &&
      distance[row][column] === distance[row - 1][column - 1] + (valueLines[row - 1] === compareLines[column - 1] ? 0 : 1)
    ) {
      alignedLines.push({
        key: valueLines[row - 1] === compareLines[column - 1]
          ? `match-${row - 1}-${column - 1}`
          : `replace-${row - 1}-${column - 1}`,
        value: valueLines[row - 1],
        compareValue: compareLines[column - 1],
        changed: valueLines[row - 1] !== compareLines[column - 1],
      });
      row -= 1;
      column -= 1;
    } else if (row > 0 && distance[row][column] === distance[row - 1][column] + 1) {
      alignedLines.push({
        key: `remove-${row - 1}-${column}`,
        value: valueLines[row - 1],
        compareValue: '',
        changed: true,
      });
      row -= 1;
    } else {
      alignedLines.push({
        key: `add-${row}-${column - 1}`,
        value: '',
        compareValue: compareLines[column - 1],
        changed: true,
      });
      column -= 1;
    }
  }

  return alignedLines.reverse();
}

function getChangedLineCount(value: string, compareValue: string): number {
  return alignLines(value, compareValue).filter(line => line.changed).length;
}

function SnapshotSourceBadge({ snapshot }: { snapshot: CharacterSnapshot }): React.ReactElement {
  const toneClassName = snapshot.source === 'manual'
    ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200'
    : snapshot.source === 'rollback'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
      : snapshot.source === 'open'
        ? 'bg-vault-200 text-vault-700 dark:bg-vault-800 dark:text-vault-200'
        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClassName}`}>
      {formatSnapshotLabel(snapshot)}
    </span>
  );
}

function HighlightedText({
  value,
  compareValue,
  changedToneClassName,
}: {
  value: string;
  compareValue: string;
  changedToneClassName: string;
}): React.ReactElement {
  const previewLines = useMemo(() => {
    return alignLines(value, compareValue).map(line => ({
      ...line,
      segments: splitChangedSegments(line.value, line.compareValue),
    })).slice(0, 10);
  }, [compareValue, value]);

  return (
    <div className="space-y-1">
      {previewLines.length > 0 ? previewLines.map((line) => (
        <div
          key={line.key}
          className={`rounded-lg px-2 py-1 text-sm leading-6 text-vault-700 dark:text-vault-200 ${
            line.changed ? 'bg-vault-100/90 dark:bg-vault-800/70' : ''
          }`}
        >
          {line.segments.length > 0 ? line.segments.map((segment, segmentIndex) => (
            <span
              key={`${line.key}-${segmentIndex}`}
              className={segment.changed ? `rounded px-0.5 ${changedToneClassName}` : undefined}
            >
              {segment.text || ' '}
            </span>
          )) : <span className="text-vault-400"> </span>}
        </div>
      )) : (
        <div className="rounded-lg px-2 py-1 text-sm text-vault-400 dark:text-vault-500">Empty</div>
      )}
    </div>
  );
}

function TextPreviewCard({
  heading,
  value,
  compareValue,
  tone,
}: {
  heading: string;
  value: string;
  compareValue: string;
  tone: 'snapshot' | 'current';
}): React.ReactElement {
  const changedLineCount = useMemo(() => getChangedLineCount(value, compareValue), [compareValue, value]);
  const changedToneClassName = tone === 'snapshot'
    ? 'bg-amber-200/90 text-amber-950 dark:bg-amber-700/50 dark:text-amber-50'
    : 'bg-emerald-200/90 text-emerald-950 dark:bg-emerald-700/50 dark:text-emerald-50';

  return (
    <div className="rounded-2xl border border-vault-200/90 bg-white/90 p-3 dark:border-vault-800 dark:bg-vault-950/60">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-vault-500 dark:text-vault-400">{heading}</p>
        <span className="text-xs text-vault-500 dark:text-vault-400">
          {changedLineCount} {changedLineCount === 1 ? 'line changed' : 'lines changed'}
        </span>
      </div>
      <HighlightedText value={value} compareValue={compareValue} changedToneClassName={changedToneClassName} />
    </div>
  );
}

function ImagePreviewCard({
  heading,
  value,
}: {
  heading: string;
  value: unknown;
}): React.ReactElement {
  return (
    <div className="rounded-2xl border border-vault-200/90 bg-white/90 p-3 dark:border-vault-800 dark:bg-vault-950/60">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-vault-500 dark:text-vault-400">{heading}</p>
      <div className="flex min-h-40 items-center justify-center rounded-xl border border-vault-200 bg-vault-50 p-3 dark:border-vault-800 dark:bg-vault-900/80">
        {typeof value === 'string' && value ? (
          <img src={value} alt={heading} className="max-h-48 rounded-xl object-contain" />
        ) : (
          <span className="text-sm text-vault-500 dark:text-vault-400">No image</span>
        )}
      </div>
    </div>
  );
}

function SectionPreview({ entry }: SectionPreviewProps): React.ReactElement {
  if (isImageEntry(entry)) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        <ImagePreviewCard heading="Revision snapshot" value={entry.snapshotValue} />
        <ImagePreviewCard heading="Current draft" value={entry.currentValue} />
      </div>
    );
  }

  const snapshotValue = formatValue(entry.snapshotValue);
  const currentValue = formatValue(entry.currentValue);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <TextPreviewCard
        heading="Revision snapshot"
        value={snapshotValue}
        compareValue={currentValue}
        tone="snapshot"
      />
      <TextPreviewCard
        heading="Current draft"
        value={currentValue}
        compareValue={snapshotValue}
        tone="current"
      />
    </div>
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
      confirmClassName: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400',
    }
    : action.kind === 'restore-whole'
      ? {
        eyebrow: 'Restore card',
        title: 'Restore the full card from this revision?',
        description: 'Your current draft will be replaced with the selected revision. A rollback snapshot will still be created automatically.',
        confirmLabel: 'Restore card',
        confirmClassName: 'bg-vault-900 text-white hover:bg-black dark:bg-vault-100 dark:text-vault-900 dark:hover:bg-white',
      }
      : {
        eyebrow: 'Restore section',
        title: `Restore ${action.entry.label}?`,
        description: 'Only this section will be restored from the selected revision. Other sections remain unchanged.',
        confirmLabel: 'Restore section',
        confirmClassName: 'bg-vault-900 text-white hover:bg-black dark:bg-vault-100 dark:text-vault-900 dark:hover:bg-white',
      };

  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="w-full max-w-md rounded-3xl border border-vault-200 bg-white p-5 shadow-2xl dark:border-vault-800 dark:bg-vault-900">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-2xl bg-vault-100 p-3 text-vault-700 dark:bg-vault-800 dark:text-vault-100">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-vault-500 dark:text-vault-400">{config.eyebrow}</p>
            <h4 className="mt-1 text-lg font-semibold text-vault-950 dark:text-vault-50">{config.title}</h4>
            <p className="mt-2 text-sm leading-6 text-vault-600 dark:text-vault-300">{config.description}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-vault-200 bg-vault-50/80 px-4 py-3 text-sm text-vault-600 dark:border-vault-800 dark:bg-vault-950/70 dark:text-vault-300">
          <p className="font-medium text-vault-900 dark:text-vault-100">{formatSnapshotLabel(action.snapshot)}</p>
          <p>{new Date(action.snapshot.createdAt).toLocaleString()}</p>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="rounded-xl border border-vault-300 px-4 py-2 text-sm font-medium text-vault-700 transition-colors hover:bg-vault-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-vault-700 dark:text-vault-200 dark:hover:bg-vault-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${config.confirmClassName}`}
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
  snapshot,
  isSelected,
  isHighlighted,
  hasChanges,
  onSelect,
  onDelete,
}: {
  snapshot: CharacterSnapshot;
  isSelected: boolean;
  isHighlighted: boolean;
  hasChanges: boolean;
  onSelect: () => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <div
      className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
        isSelected
          ? 'border-vault-900 bg-white shadow-sm dark:border-vault-100 dark:bg-vault-900'
          : 'border-vault-200/90 bg-white/75 hover:border-vault-300 hover:bg-white dark:border-vault-800 dark:bg-vault-950/60 dark:hover:border-vault-700 dark:hover:bg-vault-900/80'
      } ${isHighlighted ? 'ring-2 ring-emerald-300 dark:ring-emerald-700' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <SnapshotSourceBadge snapshot={snapshot} />
          <p className="mt-3 text-sm font-medium text-vault-900 dark:text-vault-100">{formatSnapshotDescription(snapshot)}</p>
        </button>
        {!characterSnapshotService.isBaselineSnapshot(snapshot) ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-2 text-vault-400 transition-colors hover:bg-vault-100 hover:text-red-600 dark:hover:bg-vault-800"
            title="Delete revision"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-vault-500 dark:text-vault-400">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          {new Date(snapshot.createdAt).toLocaleString()}
        </span>
        <span className={`rounded-full px-2 py-1 font-medium ${
          hasChanges
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
            : 'bg-vault-100 text-vault-600 dark:bg-vault-800 dark:text-vault-300'
        }`}>
          {hasChanges ? 'Has changes' : 'Matches draft'}
        </span>
      </div>
    </div>
  );
}

function MobileRevisionScroller({
  snapshots,
  selectedSnapshotId,
  highlightedSnapshotIds,
  diffCounts,
  onSelect,
  onDelete,
}: {
  snapshots: CharacterSnapshot[];
  selectedSnapshotId: string | null;
  highlightedSnapshotIds: string[];
  diffCounts: Record<string, number>;
  onSelect: (snapshotId: string) => void;
  onDelete: (snapshot: CharacterSnapshot) => void;
}): React.ReactElement {
  return (
    <div className="overflow-x-auto px-4 pb-4 md:hidden">
      <div className="flex gap-3">
        {snapshots.map(snapshot => (
          <div key={snapshot.id} className="min-w-[16rem] max-w-[16rem] shrink-0">
            <TimelineCard
              snapshot={snapshot}
              isSelected={snapshot.id === selectedSnapshotId}
              isHighlighted={highlightedSnapshotIds.includes(snapshot.id)}
              hasChanges={(diffCounts[snapshot.id] ?? 0) > 0}
              onSelect={() => onSelect(snapshot.id)}
              onDelete={() => onDelete(snapshot)}
            />
          </div>
        ))}
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
    snapshots,
    isSnapshotsLoading,
    refreshSnapshots,
    createManualSnapshot,
    deleteSnapshot,
    restoreSnapshot,
    getSnapshotDiff,
  } = useCharacterEditorContext();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [highlightedSnapshotIds, setHighlightedSnapshotIds] = useState<string[]>([]);
  const previousSnapshotIdsRef = useRef<string[]>([]);
  const snapshotHighlightTimeoutsRef = useRef<number[]>([]);

  const clearSnapshotHighlightTimeouts = useCallback(() => {
    snapshotHighlightTimeoutsRef.current.forEach(timeoutId => window.clearTimeout(timeoutId));
    snapshotHighlightTimeoutsRef.current = [];
  }, []);

  const resetModalState = useCallback(() => {
    setSelectedSnapshotId(null);
    setConfirmAction(null);
    setCollapsedSections({});
    setHighlightedSnapshotIds([]);
    previousSnapshotIdsRef.current = [];
    clearSnapshotHighlightTimeouts();
  }, [clearSnapshotHighlightTimeouts]);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsClosing(false);
      return;
    }

    if (!isVisible) {
      resetModalState();
      return;
    }

    setIsClosing(true);
    const timeoutId = window.setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
      resetModalState();
    }, MODAL_CLOSE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, isVisible, resetModalState]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    void refreshSnapshots();
  }, [isVisible, refreshSnapshots]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    setSelectedSnapshotId(currentSelectedSnapshotId => {
      if (currentSelectedSnapshotId && snapshots.some(snapshot => snapshot.id === currentSelectedSnapshotId)) {
        return currentSelectedSnapshotId;
      }

      return snapshots[0]?.id ?? null;
    });
  }, [isVisible, snapshots]);

  useEffect(() => {
    setCollapsedSections({});
  }, [selectedSnapshotId]);

  useEffect(() => {
    if (!isVisible) {
      previousSnapshotIdsRef.current = [];
      return;
    }

    const previousSnapshotIds = previousSnapshotIdsRef.current;
    const nextSnapshotIds = snapshots.map(snapshot => snapshot.id);

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
          setHighlightedSnapshotIds(prev => prev.filter(snapshotId => !insertedSnapshotIds.includes(snapshotId)));
        }, NEW_SNAPSHOT_HIGHLIGHT_MS);
        snapshotHighlightTimeoutsRef.current.push(timeoutId);
      }
    }

    previousSnapshotIdsRef.current = nextSnapshotIds;
  }, [isVisible, snapshots]);

  useEffect(() => () => {
    clearSnapshotHighlightTimeouts();
  }, [clearSnapshotHighlightTimeouts]);

  const closeModal = useCallback(() => {
    if (isClosing) {
      return;
    }

    setIsClosing(true);
    window.setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
      resetModalState();
      onClose();
    }, MODAL_CLOSE_MS);
  }, [isClosing, onClose, resetModalState]);

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

  const diffCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    snapshots.forEach(snapshot => {
      counts[snapshot.id] = getSnapshotDiff(snapshot.id).filter(entry => entry.changed).length;
    });

    return counts;
  }, [getSnapshotDiff, snapshots]);

  const selectedSnapshot = useMemo(
    () => snapshots.find(snapshot => snapshot.id === selectedSnapshotId) ?? null,
    [selectedSnapshotId, snapshots],
  );
  const diffEntries = useMemo(
    () => (selectedSnapshot ? getSnapshotDiff(selectedSnapshot.id).filter(entry => entry.changed) : []),
    [getSnapshotDiff, selectedSnapshot],
  );
  const changedSectionCount = diffEntries.length;
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
        await deleteSnapshot(confirmAction.snapshot.id);
        onToast('success', 'Revision deleted', 'The selected revision was removed from local history.');
      } else if (confirmAction.kind === 'restore-whole') {
        await restoreSnapshot(confirmAction.snapshot.id, 'whole');
        onToast('success', 'Card restored', 'The full card was restored from the selected revision.');
        closeModal();
      } else {
        await restoreSnapshot(confirmAction.snapshot.id, 'section', confirmAction.entry.section);
        onToast('success', 'Section restored', `${confirmAction.entry.label} was restored from the selected revision.`);
      }

      setConfirmAction(null);
    } catch {
      if (confirmAction.kind === 'delete') {
        onToast('error', 'Delete failed', 'The revision could not be deleted.');
      } else if (confirmAction.kind === 'restore-whole') {
        onToast('error', 'Restore failed', 'The full card could not be restored from this revision.');
      } else {
        onToast('error', 'Restore failed', `${confirmAction.entry.label} could not be restored from this revision.`);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const toggleSectionCollapsed = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={requestClose}
    >
      <div
        className={`relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white transition-all duration-200 dark:bg-vault-950 sm:h-[min(88vh,860px)] sm:max-w-7xl sm:rounded-[2rem] sm:border sm:border-vault-200 sm:shadow-2xl dark:sm:border-vault-800 ${
          isClosing ? 'translate-y-3 opacity-0 sm:translate-y-0 sm:scale-[0.98]' : 'translate-y-0 opacity-100 sm:scale-100'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-vault-200 bg-white/90 px-4 py-4 backdrop-blur-xl dark:border-vault-800 dark:bg-vault-950/90 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-vault-500 dark:text-vault-400">Revisions</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="rounded-2xl bg-vault-100 p-3 text-vault-700 dark:bg-vault-800 dark:text-vault-100">
                  <History className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-vault-950 dark:text-vault-50">Revision history</h2>
                  <p className="text-sm text-vault-500 dark:text-vault-400">{currentCharacter.name}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCreateSnapshot()}
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-xl bg-vault-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-vault-100 dark:text-vault-900 dark:hover:bg-white"
              >
                {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Save revision
              </button>
              <button
                type="button"
                onClick={requestClose}
                disabled={isBusy}
                className="rounded-xl border border-vault-300 p-2 text-vault-500 transition-colors hover:bg-vault-100 hover:text-vault-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-vault-700 dark:text-vault-400 dark:hover:bg-vault-800 dark:hover:text-vault-100"
                title="Close revisions"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="hidden min-h-0 w-full max-w-sm shrink-0 border-r border-vault-200 bg-vault-50/80 dark:border-vault-800 dark:bg-vault-950/70 md:flex md:flex-col">
            <div className="border-b border-vault-200 px-5 py-4 dark:border-vault-800">
              <p className="text-sm font-semibold text-vault-900 dark:text-vault-100">{snapshots.length} saved revisions</p>
              <p className="mt-1 text-sm text-vault-500 dark:text-vault-400">Browse a timeline of save points before restoring anything.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {isSnapshotsLoading && snapshots.length === 0 ? (
                <div className="space-y-3">
                  {[0, 1, 2].map(index => (
                    <div
                      key={`timeline-skeleton-${index}`}
                      className="animate-pulse rounded-2xl border border-vault-200 bg-white/80 p-4 dark:border-vault-800 dark:bg-vault-900/60"
                    >
                      <div className="h-4 w-24 rounded bg-vault-200 dark:bg-vault-700" />
                      <div className="mt-4 h-3 w-full rounded bg-vault-150 dark:bg-vault-800" />
                      <div className="mt-2 h-3 w-32 rounded bg-vault-150 dark:bg-vault-800" />
                    </div>
                  ))}
                </div>
              ) : snapshots.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-vault-300 bg-white/80 p-6 text-sm text-vault-500 dark:border-vault-700 dark:bg-vault-900/60 dark:text-vault-400">
                  No revisions available yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {snapshots.map(snapshot => (
                    <TimelineCard
                      key={snapshot.id}
                      snapshot={snapshot}
                      isSelected={snapshot.id === selectedSnapshotId}
                      isHighlighted={highlightedSnapshotIds.includes(snapshot.id)}
                      hasChanges={(diffCounts[snapshot.id] ?? 0) > 0}
                      onSelect={() => setSelectedSnapshotId(snapshot.id)}
                      onDelete={() => setConfirmAction({ kind: 'delete', snapshot })}
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-vault-200 px-4 py-4 dark:border-vault-800 sm:px-6 md:hidden">
              <p className="text-sm font-semibold text-vault-900 dark:text-vault-100">{snapshots.length} saved revisions</p>
              <p className="mt-1 text-sm text-vault-500 dark:text-vault-400">Select a revision, review the change summary, then restore with confidence.</p>
            </div>

            {isSnapshotsLoading && snapshots.length === 0 ? null : snapshots.length > 0 ? (
              <MobileRevisionScroller
                snapshots={snapshots}
                selectedSnapshotId={selectedSnapshotId}
                highlightedSnapshotIds={highlightedSnapshotIds}
                diffCounts={diffCounts}
                onSelect={setSelectedSnapshotId}
                onDelete={(snapshot) => setConfirmAction({ kind: 'delete', snapshot })}
              />
            ) : null}

            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">
              {!selectedSnapshot ? (
                <div className="flex min-h-full items-center justify-center rounded-[2rem] border border-dashed border-vault-300 bg-vault-50/70 p-8 text-center dark:border-vault-700 dark:bg-vault-900/40">
                  <div className="max-w-md">
                    <h3 className="text-lg font-semibold text-vault-900 dark:text-vault-100">Select a revision</h3>
                    <p className="mt-2 text-sm leading-6 text-vault-500 dark:text-vault-400">
                      Choose a save point from the timeline to review changes against your current draft.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-[2rem] border border-vault-200 bg-linear-to-br from-white via-white to-vault-50/70 p-5 dark:border-vault-800 dark:from-vault-950 dark:via-vault-950 dark:to-vault-900/60">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <SnapshotSourceBadge snapshot={selectedSnapshot} />
                        <h3 className="mt-3 text-2xl font-semibold text-vault-950 dark:text-vault-50">{formatSnapshotLabel(selectedSnapshot)}</h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-vault-600 dark:text-vault-300">
                          {formatSnapshotDescription(selectedSnapshot)}
                        </p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[18rem]">
                        <div className="rounded-2xl border border-vault-200 bg-white/80 px-4 py-3 dark:border-vault-800 dark:bg-vault-950/80">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-vault-500 dark:text-vault-400">Saved at</p>
                          <p className="mt-2 text-sm font-medium text-vault-900 dark:text-vault-100">
                            {new Date(selectedSnapshot.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-vault-200 bg-white/80 px-4 py-3 dark:border-vault-800 dark:bg-vault-950/80">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-vault-500 dark:text-vault-400">Changed sections</p>
                          <p className="mt-2 text-sm font-medium text-vault-900 dark:text-vault-100">{changedSectionCount}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 border-t border-vault-200 pt-4 dark:border-vault-800 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                          changedSectionCount > 0
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                            : 'bg-vault-100 text-vault-700 dark:bg-vault-800 dark:text-vault-300'
                        }`}>
                          {changedSectionCount > 0 ? 'Different from current draft' : 'Matches current draft'}
                        </span>
                        {hasActiveSectionDiff ? (
                          <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                            Includes your active editor section
                          </span>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => setConfirmAction({ kind: 'restore-whole', snapshot: selectedSnapshot })}
                        disabled={isBusy || changedSectionCount === 0}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-vault-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-vault-100 dark:text-vault-900 dark:hover:bg-white"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restore card
                      </button>
                    </div>
                  </div>

                  {changedSectionCount === 0 ? (
                    <div className="rounded-[2rem] border border-vault-200 bg-white/80 p-6 dark:border-vault-800 dark:bg-vault-950/60">
                      <p className="text-sm text-vault-500 dark:text-vault-400">
                        This revision already matches the current draft. No restore action is needed.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {diffEntries.map(entry => (
                        <div
                          key={entry.section}
                          className="rounded-[1.75rem] border border-vault-200 bg-white/85 p-4 shadow-sm dark:border-vault-800 dark:bg-vault-950/55 sm:p-5"
                        >
                          <div className="flex flex-col gap-3 border-b border-vault-200 pb-4 dark:border-vault-800 sm:flex-row sm:items-start sm:justify-between">
                            <button
                              type="button"
                              onClick={() => toggleSectionCollapsed(entry.section)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex items-start gap-3">
                                <ChevronDown
                                  className={`mt-1 h-4 w-4 shrink-0 text-vault-500 transition-transform ${
                                    collapsedSections[entry.section] ? '-rotate-90' : 'rotate-0'
                                  }`}
                                />
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="text-lg font-semibold text-vault-950 dark:text-vault-50">{entry.label}</h4>
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                      entry.section === activeSection
                                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200'
                                        : 'bg-vault-100 text-vault-700 dark:bg-vault-800 dark:text-vault-300'
                                    }`}>
                                      {entry.section === activeSection ? 'Active section' : 'Changed section'}
                                    </span>
                                    <span className="inline-flex items-center rounded-full bg-vault-100 px-2.5 py-1 text-[11px] font-semibold text-vault-600 dark:bg-vault-800 dark:text-vault-300">
                                      {collapsedSections[entry.section] ? 'Collapsed' : 'Expanded'}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm leading-6 text-vault-500 dark:text-vault-400">
                                    Review this section against the current draft, then restore only this area if needed.
                                  </p>
                                </div>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmAction({ kind: 'restore-section', snapshot: selectedSnapshot, entry })}
                              disabled={isBusy}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-vault-300 px-4 py-2 text-sm font-medium text-vault-700 transition-colors hover:bg-vault-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-vault-700 dark:text-vault-200 dark:hover:bg-vault-800"
                            >
                              <RotateCcw className="h-4 w-4" />
                              Restore section
                            </button>
                          </div>

                          {!collapsedSections[entry.section] ? (
                            <div className="mt-4">
                              <SectionPreview entry={entry} />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
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
