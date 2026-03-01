import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, History, RotateCcw, X } from 'lucide-react';
import { useCharacterEditorContext } from '../../context';
import { characterSnapshotService } from '../../services';
import type { SnapshotDiffEntry } from '../../db/characterTypes';

interface CharacterHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DiffSegment {
  text: string;
  changed: boolean;
}

interface LineDiff {
  value: string;
  compareValue: string;
  changed: boolean;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.join('\n');
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
  if (value === compareValue) {
    return value ? [{ text: value, changed: false }] : [];
  }

  if (!value) {
    return [];
  }

  if (!compareValue) {
    return [{ text: value, changed: true }];
  }

  let prefixLength = 0;
  while (
    prefixLength < value.length &&
    prefixLength < compareValue.length &&
    value[prefixLength] === compareValue[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < value.length - prefixLength &&
    suffixLength < compareValue.length - prefixLength &&
    value[value.length - 1 - suffixLength] === compareValue[compareValue.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const prefix = value.slice(0, prefixLength);
  const changed = value.slice(prefixLength, value.length - suffixLength);
  const suffix = suffixLength > 0 ? value.slice(value.length - suffixLength) : '';

  return [
    ...(prefix ? [{ text: prefix, changed: false }] : []),
    ...(changed ? [{ text: changed, changed: true }] : []),
    ...(suffix ? [{ text: suffix, changed: false }] : []),
  ];
}

function createLineDiffs(value: string, compareValue: string): LineDiff[] {
  const valueLines = value.split('\n');
  const compareLines = compareValue.split('\n');
  const maxLines = Math.max(valueLines.length, compareLines.length);
  const diffs: LineDiff[] = [];

  for (let index = 0; index < maxLines; index += 1) {
    const currentLine = valueLines[index] ?? '';
    const otherLine = compareLines[index] ?? '';
    diffs.push({
      value: currentLine,
      compareValue: otherLine,
      changed: currentLine !== otherLine,
    });
  }

  return diffs;
}

function countChangedLines(value: string, compareValue: string): number {
  return createLineDiffs(value, compareValue).filter(line => line.changed).length;
}

function formatLineNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}

function HighlightedContent({
  value,
  compareValue,
  tone,
}: {
  value: string;
  compareValue: string;
  tone: 'snapshot' | 'current';
}): React.ReactElement {
  const lineDiffs = useMemo(() => createLineDiffs(value, compareValue), [compareValue, value]);
  const changedSpanClassName = tone === 'snapshot'
    ? 'bg-rose-200/90 text-rose-950 dark:bg-rose-700/50 dark:text-rose-50'
    : 'bg-emerald-200/90 text-emerald-950 dark:bg-emerald-700/50 dark:text-emerald-50';
  const changedLineClassName = tone === 'snapshot'
    ? 'border-l-2 border-rose-500 bg-rose-50/70 dark:bg-rose-950/20'
    : 'border-l-2 border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20';

  return (
    <div className="space-y-1 font-mono text-sm">
      {lineDiffs.length > 0 ? lineDiffs.map((line, index) => {
        const segments = splitChangedSegments(line.value, line.compareValue);
        return (
          <div
            key={`${tone}-${index}`}
            className={`grid grid-cols-[auto_1fr] gap-3 rounded-md px-2 py-1 ${line.changed ? changedLineClassName : ''}`}
          >
            <span className="select-none text-[11px] font-semibold tracking-wide text-vault-400 dark:text-vault-500">
              {formatLineNumber(index)}
            </span>
            <pre className="whitespace-pre-wrap break-words text-sm text-vault-800 dark:text-vault-200">
              {segments.length > 0 ? segments.map((segment, segmentIndex) => (
                <span
                  key={`${tone}-${index}-${segmentIndex}`}
                  className={segment.changed ? `rounded px-0.5 ${changedSpanClassName}` : undefined}
                >
                  {segment.text || ' '}
                </span>
              )) : <span className="text-vault-400 dark:text-vault-500"> </span>}
            </pre>
          </div>
        );
      }) : (
        <pre className="text-sm text-vault-800 dark:text-vault-200">Empty</pre>
      )}
    </div>
  );
}

function DiffBlock({
  title,
  value,
  compareValue,
  tone,
}: {
  title: string;
  value: unknown;
  compareValue: unknown;
  tone: 'snapshot' | 'current';
}): React.ReactElement {
  const content = formatValue(value);
  const compareContent = formatValue(compareValue);
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > 900 || content.split('\n').length > 18;
  const lineDiffCount = useMemo(() => countChangedLines(content, compareContent), [compareContent, content]);
  const displayValue = expanded || !isLong ? content : content.split('\n').slice(0, 18).join('\n');
  const displayCompareValue = expanded || !isLong ? compareContent : compareContent.split('\n').slice(0, 18).join('\n');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-vault-500 dark:text-vault-400">{title}</p>
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
          tone === 'snapshot'
            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
        }`}>
          {lineDiffCount} {lineDiffCount === 1 ? 'line changed' : 'lines changed'}
        </span>
      </div>
      <div className="rounded-xl border border-vault-200 bg-white/90 p-3 dark:border-vault-700 dark:bg-vault-950/60">
        <HighlightedContent value={displayValue} compareValue={displayCompareValue} tone={tone} />
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className="text-xs font-medium text-vault-600 hover:text-vault-800 dark:text-vault-300 dark:hover:text-vault-100"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

export function CharacterHistoryModal({ isOpen, onClose }: CharacterHistoryModalProps): React.ReactElement {
  const {
    currentCharacter,
    activeSection,
    snapshots,
    isSnapshotsLoading,
    restoreSnapshot,
    getSnapshotDiff,
  } = useCharacterEditorContext();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedSnapshotId(null);
      return;
    }

    setSelectedSnapshotId(snapshots[0]?.id ?? null);
  }, [isOpen, snapshots]);

  const selectedSnapshot = useMemo(
    () => snapshots.find(snapshot => snapshot.id === selectedSnapshotId) ?? null,
    [selectedSnapshotId, snapshots],
  );
  const diffEntries = useMemo(
    () => (selectedSnapshot ? getSnapshotDiff(selectedSnapshot.id).filter(entry => entry.changed) : []),
    [getSnapshotDiff, selectedSnapshot],
  );
  const activeSectionDiff = diffEntries.find(entry => entry.section === activeSection);

  if (!isOpen || !currentCharacter) {
    return <></>;
  }

  const handleRestore = async (scope: 'whole' | 'section') => {
    if (!selectedSnapshot) {
      return;
    }

    const confirmed = window.confirm(
      scope === 'whole'
        ? 'Restore the entire card from this snapshot?'
        : 'Restore the current section from this snapshot?',
    );
    if (!confirmed) {
      return;
    }

    setIsRestoring(true);
    try {
      await restoreSnapshot(selectedSnapshot.id, scope);
      onClose();
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[min(85vh,720px)] w-full max-w-7xl overflow-hidden rounded-3xl border border-vault-200 bg-white shadow-2xl dark:border-vault-800 dark:bg-vault-900">
        <aside className="flex w-full max-w-sm flex-col border-r border-vault-200 bg-vault-50/80 dark:border-vault-800 dark:bg-vault-950/70">
          <div className="flex items-center justify-between border-b border-vault-200 px-5 py-4 dark:border-vault-800">
            <div>
              <h2 className="text-lg font-semibold text-vault-900 dark:text-vault-100">Snapshot History</h2>
              <p className="text-sm text-vault-500 dark:text-vault-400">{currentCharacter.name}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-vault-500 transition-colors hover:bg-vault-100 hover:text-vault-800 dark:text-vault-400 dark:hover:bg-vault-800 dark:hover:text-vault-100"
              title="Close history"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {isSnapshotsLoading ? (
              <div className="px-3 py-6 text-sm text-vault-500 dark:text-vault-400">Loading snapshots...</div>
            ) : snapshots.length === 0 ? (
              <div className="px-3 py-6 text-sm text-vault-500 dark:text-vault-400">No snapshots available.</div>
            ) : (
              <div className="space-y-2">
                {snapshots.map(snapshot => {
                  const isSelected = snapshot.id === selectedSnapshotId;
                  return (
                    <button
                      key={snapshot.id}
                      type="button"
                      onClick={() => setSelectedSnapshotId(snapshot.id)}
                      className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                        isSelected
                          ? 'border-vault-500 bg-white shadow-sm dark:border-vault-400 dark:bg-vault-900'
                          : 'border-vault-200 bg-white/70 hover:border-vault-300 dark:border-vault-800 dark:bg-vault-900/50 dark:hover:border-vault-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-vault-900 dark:text-vault-100">
                            {characterSnapshotService.formatSnapshotSource(snapshot.source)}
                          </p>
                          <p className="text-xs text-vault-500 dark:text-vault-400">
                            {characterSnapshotService.describeSnapshotSource(snapshot.source)}
                          </p>
                        </div>
                        <History className="h-4 w-4 shrink-0 text-vault-400" />
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-vault-500 dark:text-vault-400">
                        <Clock3 className="h-3.5 w-3.5" />
                        {new Date(snapshot.createdAt).toLocaleString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-vault-200 px-5 py-4 dark:border-vault-800">
            <div>
              <h3 className="text-lg font-semibold text-vault-900 dark:text-vault-100">Snapshot Diff</h3>
              <p className="text-sm text-vault-500 dark:text-vault-400">
                Comparing selected snapshot against the current card
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleRestore('section')}
                disabled={!selectedSnapshot || !activeSectionDiff || isRestoring}
                className="rounded-xl border border-vault-300 px-4 py-2 text-sm font-medium text-vault-700 transition-colors hover:bg-vault-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-vault-700 dark:text-vault-200 dark:hover:bg-vault-800"
              >
                Restore This Section
              </button>
              <button
                type="button"
                onClick={() => void handleRestore('whole')}
                disabled={!selectedSnapshot || isRestoring}
                className="inline-flex items-center gap-2 rounded-xl bg-vault-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vault-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-vault-100 dark:text-vault-900 dark:hover:bg-white"
              >
                <RotateCcw className="h-4 w-4" />
                Restore Whole Card
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {!selectedSnapshot ? (
              <div className="text-sm text-vault-500 dark:text-vault-400">Select a snapshot to inspect changes.</div>
            ) : diffEntries.length === 0 ? (
              <div className="text-sm text-vault-500 dark:text-vault-400">This snapshot matches the current card.</div>
            ) : (
              <div className="space-y-4">
                {diffEntries.map(entry => (
                  <div
                    key={entry.section}
                    className="rounded-2xl border border-vault-200 bg-white/80 p-4 dark:border-vault-800 dark:bg-vault-950/40"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-vault-900 dark:text-vault-100">{entry.label}</h4>
                        <p className="text-xs text-vault-500 dark:text-vault-400">
                          {entry.section === activeSection ? 'Current editor section' : 'Changed section'}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        Changed
                      </span>
                    </div>

                    {isImageEntry(entry) ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-vault-500 dark:text-vault-400">Snapshot</p>
                          <div className="flex min-h-48 items-center justify-center rounded-xl border border-vault-200 bg-vault-50 p-3 dark:border-vault-700 dark:bg-vault-950/60">
                            {typeof entry.snapshotValue === 'string' && entry.snapshotValue ? (
                              <img src={entry.snapshotValue} alt="Snapshot" className="max-h-48 rounded-lg object-contain" />
                            ) : (
                              <span className="text-sm text-vault-500 dark:text-vault-400">No image</span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-vault-500 dark:text-vault-400">Current</p>
                          <div className="flex min-h-48 items-center justify-center rounded-xl border border-vault-200 bg-vault-50 p-3 dark:border-vault-700 dark:bg-vault-950/60">
                            {typeof entry.currentValue === 'string' && entry.currentValue ? (
                              <img src={entry.currentValue} alt="Current" className="max-h-48 rounded-lg object-contain" />
                            ) : (
                              <span className="text-sm text-vault-500 dark:text-vault-400">No image</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <DiffBlock
                          title="Snapshot"
                          value={entry.snapshotValue}
                          compareValue={entry.currentValue}
                          tone="snapshot"
                        />
                        <DiffBlock
                          title="Current"
                          value={entry.currentValue}
                          compareValue={entry.snapshotValue}
                          tone="current"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default CharacterHistoryModal;
