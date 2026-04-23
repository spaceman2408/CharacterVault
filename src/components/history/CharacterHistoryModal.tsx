import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  Clock3,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { useCharacterEditorContext } from '../../context';
import { characterSnapshotService } from '../../services';
import type { CharacterBook, CharacterSnapshot, SnapshotMetadata, SnapshotDiffEntry } from '../../db/characterTypes';

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

interface HighlightedLine extends AlignedLine {
  segments: DiffSegment[];
}

type ConfirmAction =
  | { kind: 'delete'; metadata: SnapshotMetadata }
  | { kind: 'restore-whole'; metadata: SnapshotMetadata }
  | { kind: 'restore-section'; metadata: SnapshotMetadata; entry: SnapshotDiffEntry };

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

function isLorebookValue(value: unknown): value is CharacterBook | null {
  return value === null || (typeof value === 'object' && value !== null && 'entries' in value);
}

function getSortedLorebookEntries(value: CharacterBook | null) {
  return value?.entries
    ?.slice()
    .sort((left, right) => left.insertion_order - right.insertion_order) ?? [];
}

function formatLorebookForDiff(
  book: CharacterBook | null,
  otherBook: CharacterBook | null,
): string {
  const entries = getSortedLorebookEntries(book);
  if (entries.length === 0) {
    return '';
  }

  const otherEntriesById = new Map(
    getSortedLorebookEntries(otherBook).map(entry => [entry.id, entry]),
  );

  const result: string[] = [];

  for (const entry of entries) {
    const otherEntry = otherEntriesById.get(entry.id);
    const entryName = entry.name?.trim() || `Entry ${entry.id}`;

    // Determine which fields changed
    const nameChanged = normalizeLineEndings(entry.name ?? '') !== normalizeLineEndings(otherEntry?.name ?? '');
    const keysChanged = normalizeLineEndings(entry.keys.join(', ')) !== normalizeLineEndings((otherEntry?.keys ?? []).join(', '));
    const contentChanged = normalizeLineEndings(entry.content ?? '') !== normalizeLineEndings(otherEntry?.content ?? '');
    const commentChanged = normalizeLineEndings(entry.comment ?? '') !== normalizeLineEndings(otherEntry?.comment ?? '');

    // Only include entries that have changes
    if (!nameChanged && !keysChanged && !contentChanged && !commentChanged && otherEntry) {
      continue;
    }

    const lines: string[] = [`[${entryName}]`];

    if (nameChanged) {
      const value = entry.name?.trim();
      lines.push(`  Name: ${value ? `"${value}"` : '(empty)'}`);
    }

    if (keysChanged) {
      const value = entry.keys.join(', ').trim();
      lines.push(`  Trigger Keys: ${value ? `"${value}"` : '(empty)'}`);
    }

    if (contentChanged) {
      lines.push('  Content:');
      const content = entry.content?.trim();
      if (content) {
        lines.push(...content.split('\n').map(line => `    ${line}`));
      } else {
        lines.push('    (empty)');
      }
    }

    if (commentChanged) {
      const value = entry.comment?.trim();
      lines.push(`  Internal Notes: ${value ? `"${value}"` : '(empty)'}`);
    }

    result.push(lines.join('\n'));
  }

  return normalizeLineEndings(result.join('\n\n---\n\n'));
}

function isGreetingsValue(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string');
}

function formatChangedGreetings(value: string[], compareValue: string[]): string {
  return normalizeLineEndings(
    value
      .filter((greeting, index) => normalizeLineEndings(greeting) !== normalizeLineEndings(compareValue[index] ?? ''))
      .filter(greeting => greeting.length > 0)
      .join('\n\n---\n\n'),
  );
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

function formatSnapshotLabel(source: SnapshotMetadata['source']): string {
  switch (source) {
    case 'open':
      return 'Opened card';
    case 'auto':
      return 'Legacy auto save point';
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
      return 'Saved automatically by an older version of the app.';
    case 'manual':
      return 'Saved on demand from the revisions panel.';
    case 'rollback':
      return 'Saved after a restore completed.';
    default:
      return characterSnapshotService.describeSnapshotSource(source);
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

function buildHighlightedLines(value: string, compareValue: string): HighlightedLine[] {
  return alignLines(value, compareValue)
    .filter(line => line.value || line.compareValue)
    .map(line => ({
      ...line,
      segments: splitChangedSegments(line.value, line.compareValue),
    }));
}

function isSectionCollapsedByDefault(section: SnapshotDiffEntry['section'], activeSection: string): boolean {
  return section !== activeSection;
}

function SnapshotSourceBadge({ source }: { source: SnapshotMetadata['source'] }): React.ReactElement {
  const toneClassName = source === 'manual'
    ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200'
    : source === 'rollback'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
      : source === 'open'
        ? 'bg-vault-200 text-vault-700 dark:bg-vault-800 dark:text-vault-200'
        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClassName}`}>
      {formatSnapshotLabel(source)}
    </span>
  );
}

function HighlightedText({
  lines,
  changedToneClassName,
}: {
  lines: HighlightedLine[];
  changedToneClassName: string;
}): React.ReactElement {
  return (
    <div className="space-y-1">
      {lines.length > 0 ? lines.map((line) => (
        <div
          key={line.key}
          className={`wrap-break-words rounded px-1.5 py-0.5 text-sm leading-6 text-vault-700 dark:text-vault-200 ${
            line.changed ? 'bg-vault-100/80 dark:bg-vault-800/60' : ''
          }`}
        >
          {line.segments.length > 0 ? line.segments.map((segment, segmentIndex) => (
            <span
              key={`${line.key}-${segmentIndex}`}
              className={segment.changed ? `wrap-break-words rounded px-0.5 ${changedToneClassName}` : undefined}
            >
              {segment.text || ' '}
            </span>
          )) : line.value ? (
            <span className="wrap-break-words">{line.value}</span>
          ) : (
            <span className={`wrap-break-words rounded px-0.5 ${changedToneClassName}`}>{line.compareValue || ' '}</span>
          )}
        </div>
      )) : (
        <div className="rounded px-2 py-1 text-sm text-vault-400 dark:text-vault-500">Empty</div>
      )}
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
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-vault-500 dark:text-vault-400">{heading}</p>
      <div className="flex min-h-32 items-center justify-center rounded-lg border border-vault-200 bg-vault-50 p-2 dark:border-vault-800 dark:bg-vault-900/60">
        {typeof value === 'string' && value ? (
          <img src={value} alt={heading} className="max-h-40 rounded object-contain" />
        ) : (
          <span className="text-sm text-vault-500 dark:text-vault-400">No image</span>
        )}
      </div>
    </div>
  );
}

function SyncedDiffView({
  snapshotValue,
  currentValue,
  isSnapshotMissing,
  hasAttemptedLoad,
}: {
  snapshotValue: string;
  currentValue: string;
  isSnapshotMissing?: boolean;
  hasAttemptedLoad?: boolean;
}): React.ReactElement {
  const snapshotLines = useMemo(() => buildHighlightedLines(snapshotValue, currentValue), [currentValue, snapshotValue]);
  const currentLines = useMemo(() => buildHighlightedLines(currentValue, snapshotValue), [currentValue, snapshotValue]);
  const changedLineCountLeft = useMemo(() => snapshotLines.filter(line => line.changed).length, [snapshotLines]);
  const changedLineCountRight = useMemo(() => currentLines.filter(line => line.changed).length, [currentLines]);

  if (isSnapshotMissing && hasAttemptedLoad) {
    return (
      <div className="max-h-96 overflow-y-auto rounded border border-vault-200 bg-vault-50/70 dark:border-vault-800 dark:bg-vault-900/40">
        <div className="p-6 text-center">
          <div className="rounded-xl bg-amber-100 p-3 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <ShieldAlert className="mx-auto h-6 w-6" />
          </div>
          <h4 className="mt-3 text-sm font-semibold text-vault-900 dark:text-vault-100">Snapshot data unavailable</h4>
          <p className="mt-1 text-xs text-vault-500 dark:text-vault-400">
            This revision's snapshot could not be loaded. It may have been corrupted or failed to save properly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto rounded border border-vault-200 bg-vault-50/70 dark:border-vault-800 dark:bg-vault-900/40">
      <div className="grid lg:grid-cols-2">
        {/* Revision snapshot */}
        <div className="border-b border-vault-200 p-3 dark:border-vault-800 lg:border-b-0 lg:border-r">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-vault-500 dark:text-vault-400">
            Revision snapshot · {changedLineCountLeft} {changedLineCountLeft === 1 ? 'line' : 'lines'} changed
          </p>
          <div className="space-y-1 rounded bg-white/50 p-2 dark:bg-vault-950/50">
            <HighlightedText
              lines={snapshotLines}
              changedToneClassName="bg-amber-200/80 text-amber-950 dark:bg-amber-700/40 dark:text-amber-50"
            />
          </div>
        </div>

        {/* Current draft */}
        <div className="p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-vault-500 dark:text-vault-400">
            Current draft · {changedLineCountRight} {changedLineCountRight === 1 ? 'line' : 'lines'} changed
          </p>
          <div className="space-y-1 rounded bg-white/50 p-2 dark:bg-vault-950/50">
            <HighlightedText
              lines={currentLines}
              changedToneClassName="bg-emerald-200/80 text-emerald-950 dark:bg-emerald-700/40 dark:text-emerald-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function LorebookDiffView({
  snapshotBook,
  currentBook,
}: {
  snapshotBook: CharacterBook | null;
  currentBook: CharacterBook | null;
}): React.ReactElement {
  const snapshotText = useMemo(() => formatLorebookForDiff(snapshotBook, currentBook), [snapshotBook, currentBook]);
  const currentText = useMemo(() => formatLorebookForDiff(currentBook, snapshotBook), [snapshotBook, currentBook]);
  const snapshotLines = useMemo(() => buildHighlightedLines(snapshotText, currentText), [snapshotText, currentText]);
  const currentLines = useMemo(() => buildHighlightedLines(currentText, snapshotText), [currentText, snapshotText]);
  const changedLineCountLeft = useMemo(() => snapshotLines.filter(line => line.changed).length, [snapshotLines]);
  const changedLineCountRight = useMemo(() => currentLines.filter(line => line.changed).length, [currentLines]);

  return (
    <div className="max-h-96 overflow-y-auto rounded border border-vault-200 bg-vault-50/70 dark:border-vault-800 dark:bg-vault-900/40">
      <div className="grid lg:grid-cols-2">
        {/* Revision snapshot */}
        <div className="border-b border-vault-200 p-3 dark:border-vault-800 lg:border-b-0 lg:border-r">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-vault-500 dark:text-vault-400">
            Revision snapshot · {changedLineCountLeft} {changedLineCountLeft === 1 ? 'line' : 'lines'} changed
          </p>
          <div className="space-y-1 rounded bg-white/50 p-2 dark:bg-vault-950/50">
            <HighlightedText
              lines={snapshotLines}
              changedToneClassName="bg-amber-200/80 text-amber-950 dark:bg-amber-700/40 dark:text-amber-50"
            />
          </div>
        </div>

        {/* Current draft */}
        <div className="p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-vault-500 dark:text-vault-400">
            Current draft · {changedLineCountRight} {changedLineCountRight === 1 ? 'line' : 'lines'} changed
          </p>
          <div className="space-y-1 rounded bg-white/50 p-2 dark:bg-vault-950/50">
            <HighlightedText
              lines={currentLines}
              changedToneClassName="bg-emerald-200/80 text-emerald-950 dark:bg-emerald-700/40 dark:text-emerald-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionPreview({
  entry,
  isSnapshotMissing,
  hasAttemptedLoad,
}: {
  entry: SnapshotDiffEntry;
  isSnapshotMissing?: boolean;
  hasAttemptedLoad?: boolean;
}): React.ReactElement {
  if (isImageEntry(entry)) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <ImagePreviewCard heading="Revision snapshot" value={entry.snapshotValue} />
        <ImagePreviewCard heading="Current draft" value={entry.currentValue} />
      </div>
    );
  }

  const snapshotLorebookValue = entry.section === 'lorebook' && isLorebookValue(entry.snapshotValue)
    ? entry.snapshotValue
    : null;
  const currentLorebookValue = entry.section === 'lorebook' && isLorebookValue(entry.currentValue)
    ? entry.currentValue
    : null;
  const isLorebookEntry = snapshotLorebookValue !== null || currentLorebookValue !== null;

  if (isLorebookEntry) {
    return <LorebookDiffView snapshotBook={snapshotLorebookValue} currentBook={currentLorebookValue} />;
  }

  const snapshotGreetingsValue = entry.section === 'alternate_greetings' && isGreetingsValue(entry.snapshotValue)
    ? entry.snapshotValue
    : null;
  const currentGreetingsValue = entry.section === 'alternate_greetings' && isGreetingsValue(entry.currentValue)
    ? entry.currentValue
    : null;
  const isGreetingsEntry = snapshotGreetingsValue !== null || currentGreetingsValue !== null;
  const snapshotValue = isGreetingsEntry
      ? formatChangedGreetings(snapshotGreetingsValue ?? [], currentGreetingsValue ?? [])
    : formatValue(entry.snapshotValue);
  const currentValue = isGreetingsEntry
      ? formatChangedGreetings(currentGreetingsValue ?? [], snapshotGreetingsValue ?? [])
    : formatValue(entry.currentValue);

  return <SyncedDiffView snapshotValue={snapshotValue} currentValue={currentValue} isSnapshotMissing={isSnapshotMissing} hasAttemptedLoad={hasAttemptedLoad} />;
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
        description: `Your current draft will be replaced with the "${formatSnapshotLabel(action.metadata.source)}" revision from ${new Date(action.metadata.createdAt).toLocaleString()}. A rollback snapshot will still be created automatically.`,
        confirmLabel: 'Restore card',
        confirmClassName: 'bg-vault-900 text-white hover:bg-black dark:bg-vault-100 dark:text-vault-900 dark:hover:bg-white',
      }
      : {
        eyebrow: 'Restore section',
        title: `Restore ${action.entry.label}?`,
        description: `Only this section will be restored from the "${formatSnapshotLabel(action.metadata.source)}" revision. Other sections remain unchanged.`,
        confirmLabel: 'Restore section',
        confirmClassName: 'bg-vault-900 text-white hover:bg-black dark:bg-vault-100 dark:text-vault-900 dark:hover:bg-white',
      };

  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-vault-200 bg-white p-5 shadow-2xl dark:border-vault-800 dark:bg-vault-900">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-vault-100 p-2.5 text-vault-700 dark:bg-vault-800 dark:text-vault-100">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-vault-500 dark:text-vault-400">{config.eyebrow}</p>
            <h4 className="mt-1 text-lg font-semibold text-vault-950 dark:text-vault-50">{config.title}</h4>
            <p className="mt-2 text-sm leading-6 text-vault-600 dark:text-vault-300">{config.description}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="rounded-lg border border-vault-300 px-4 py-2 text-sm font-medium text-vault-700 transition-colors hover:bg-vault-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-vault-700 dark:text-vault-200 dark:hover:bg-vault-800"
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
          ? 'border-vault-900 bg-white shadow-sm dark:border-vault-100 dark:bg-vault-900'
          : 'border-vault-200 bg-white hover:border-vault-300 hover:bg-white dark:border-vault-800 dark:bg-vault-950 dark:hover:border-vault-700 dark:hover:bg-vault-900/80'
      } ${isHighlighted ? 'ring-2 ring-emerald-300 dark:ring-emerald-700' : ''}`}
    >
      <div className="flex items-center gap-2">
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <SnapshotSourceBadge source={metadata.source} />
          <span className="shrink-0 text-xs text-vault-400">
            {new Date(metadata.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        </button>
        {!characterSnapshotService.isBaselineSnapshotMetadata(metadata) ? (
          <button
            type="button"
            onClick={onDelete}
            className="shrink-0 rounded p-1.5 text-vault-400 transition-colors hover:bg-vault-100 hover:text-red-600 dark:hover:bg-vault-800"
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
    <div className="overflow-x-auto px-4 pb-4 md:hidden">
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
}

function SnapshotSummary({
  metadata,
  changedSectionCount,
  hasActiveSectionDiff,
  isBusy,
  isSnapshotMissing,
  hasAttemptedLoad,
  onRestore,
}: SnapshotSummaryProps): React.ReactElement {
  const restoreDisabledReason = isSnapshotMissing
    ? 'Snapshot data is missing or corrupted'
    : changedSectionCount === 0
      ? 'No changes to restore'
      : undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-vault-950 dark:text-vault-50">{formatSnapshotLabel(metadata.source)}</h3>
            <p className="text-sm text-vault-500 dark:text-vault-400">{formatSnapshotDescription(metadata.source)}</p>
        </div>
        <button
          type="button"
          onClick={onRestore}
          disabled={isBusy || changedSectionCount === 0 || isSnapshotMissing}
          title={restoreDisabledReason}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-vault-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-vault-100 dark:text-vault-900 dark:hover:bg-white"
        >
          <RotateCcw className="h-4 w-4" />
          Restore card
        </button>
      </div>

      {isSnapshotMissing && hasAttemptedLoad && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <span className="font-medium">Warning:</span> This revision's snapshot data could not be loaded. It may have been corrupted or failed to save properly.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-vault-200 pt-3 text-sm text-vault-500 dark:border-vault-800 dark:text-vault-400">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          {new Date(metadata.createdAt).toLocaleString()}
        </span>
        <span>{changedSectionCount} {changedSectionCount === 1 ? 'section' : 'sections'} changed</span>
        {hasActiveSectionDiff && (
          <span className="text-sky-600 dark:text-sky-400">Includes active section</span>
        )}
      </div>
    </div>
  );
}

interface DiffSectionProps {
  entry: SnapshotDiffEntry;
  snapshot: CharacterSnapshot | null;
  isActive: boolean;
  isCollapsed: boolean;
  isBusy: boolean;
  hasAttemptedLoad: boolean;
  onToggle: () => void;
  onRestore: () => void;
}

function DiffSection({
  entry,
  snapshot,
  isActive,
  isCollapsed,
  isBusy,
  hasAttemptedLoad,
  onToggle,
  onRestore,
}: DiffSectionProps): React.ReactElement {
  const isSnapshotMissing = snapshot === null;

  return (
    <div className="border-t border-vault-200 pt-4 first:border-t-0 first:pt-0 dark:border-vault-800">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 text-left"
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-vault-500 transition-transform ${
            isCollapsed ? '-rotate-90' : 'rotate-0'
          }`}
        />
        <span className="flex-1 text-base font-semibold text-vault-950 dark:text-vault-50">{entry.label}</span>
        {isActive && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
            Active
          </span>
        )}
      </button>

      {!isCollapsed && (
        <div className="mt-3 pl-7">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-vault-500 dark:text-vault-400">Compare snapshot vs. current draft</p>
            <button
              type="button"
              onClick={onRestore}
              disabled={isBusy || isSnapshotMissing}
              className="inline-flex items-center gap-2 rounded-lg border border-vault-300 px-3 py-1.5 text-sm font-medium text-vault-700 transition-colors hover:bg-vault-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-vault-700 dark:text-vault-200 dark:hover:bg-vault-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore section
            </button>
          </div>
          <SectionPreview entry={entry} isSnapshotMissing={isSnapshotMissing} hasAttemptedLoad={hasAttemptedLoad} />
        </div>
      )}
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
    getSnapshotDiff,
  } = useCharacterEditorContext();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<CharacterSnapshot | null>(null);
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
  const [isBusy, setIsBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [highlightedSnapshotIds, setHighlightedSnapshotIds] = useState<string[]>([]);
  const [currentPayloadHash, setCurrentPayloadHash] = useState<string | null>(null);
  const previousSnapshotIdsRef = useRef<string[]>([]);
  const snapshotHighlightTimeoutsRef = useRef<number[]>([]);

  const clearSnapshotHighlightTimeouts = useCallback(() => {
    snapshotHighlightTimeoutsRef.current.forEach(timeoutId => window.clearTimeout(timeoutId));
    snapshotHighlightTimeoutsRef.current = [];
  }, []);

  const resetModalState = useCallback(() => {
    setSelectedSnapshotId(null);
    setSelectedSnapshot(null);
    setDiffEntries([]);
    setConfirmAction(null);
    setCollapsedSections({});
    setHighlightedSnapshotIds([]);
    setHasAttemptedLoad(false);
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

  // Compute current character payload hash once for comparison
  useEffect(() => {
    if (!currentCharacter) {
      setCurrentPayloadHash(null);
      return;
    }

    void characterSnapshotService.computeCharacterPayloadHash(currentCharacter).then(hash => {
      setCurrentPayloadHash(hash);
    });
  }, [currentCharacter]);

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
    const hasChangesById: Record<string, boolean> = {};

    snapshotMetadata.forEach(meta => {
      // Cheap check: if payloadHash differs from current, it has changes
      hasChangesById[meta.id] = currentPayloadHash !== null &&
        meta.payloadHash !== currentPayloadHash;
    });

    return hasChangesById;
  }, [snapshotMetadata, currentPayloadHash]);

  // Load diff for selected snapshot (stale-safe via captured ID)
  useEffect(() => {
    if (!selectedSnapshotId) {
      setSelectedSnapshot(null);
      setDiffEntries([]);
      setHasAttemptedLoad(false);
      return;
    }

    const capturedId = selectedSnapshotId;
    setIsLoadingDiff(true);
    setHasAttemptedLoad(false);
    let cancelled = false;

    void (async () => {
      try {
        const entries = await getSnapshotDiff(capturedId);
        const filtered = entries.filter(entry => entry.changed);

        if (cancelled) return;

        setDiffEntries(filtered);

        const snapshot = await characterSnapshotService.loadSnapshotPayload(capturedId);
        if (cancelled) return;

        setSelectedSnapshot(snapshot ?? null);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load diff:', error);
        setDiffEntries([]);
        setSelectedSnapshot(null);
      } finally {
        if (!cancelled) {
          setIsLoadingDiff(false);
          setHasAttemptedLoad(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [selectedSnapshotId, getSnapshotDiff]);

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
        await deleteSnapshot(confirmAction.metadata.id);
        onToast('success', 'Revision deleted', 'The selected revision was removed from local history.');
      } else if (confirmAction.kind === 'restore-whole') {
        await restoreSnapshot(confirmAction.metadata.id, 'whole');
        onToast('success', 'Card restored', 'The full card was restored from the selected revision.');
        closeModal();
      } else {
        await restoreSnapshot(confirmAction.metadata.id, 'section', confirmAction.entry.section);
        onToast('success', 'Section restored', `${confirmAction.entry.label} was restored from the selected revision.`);
        // After restoring a section, refresh the diff for this snapshot
        if (selectedSnapshotId) {
          setIsLoadingDiff(true);
          try {
            const entries = await getSnapshotDiff(selectedSnapshotId);
            setDiffEntries(entries.filter(entry => entry.changed));
          } finally {
            setIsLoadingDiff(false);
          }
        }
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

  const handleSelectSnapshot = (snapshotId: string) => {
    setCollapsedSections({});
    if (snapshotId !== selectedSnapshotId) {
      setSelectedSnapshotId(snapshotId);
      setDiffEntries([]);
      setSelectedSnapshot(null);
      setHasAttemptedLoad(false);
    }
  };

  const toggleSectionCollapsed = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !(prev[section] ?? isSectionCollapsedByDefault(section as SnapshotDiffEntry['section'], activeSection)),
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={requestClose}
    >
      <div
        className={`relative flex h-dvh w-full flex-col overflow-hidden bg-white transition-all duration-200 dark:bg-vault-950 sm:h-[min(88vh,860px)] sm:max-w-7xl sm:rounded-2xl sm:border sm:border-vault-200 sm:shadow-2xl dark:sm:border-vault-800 ${
          isClosing ? 'translate-y-3 opacity-0 sm:translate-y-0 sm:scale-[0.98]' : 'translate-y-0 opacity-100 sm:scale-100'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header - Flattened */}
        <div className="flex items-center justify-between gap-4 border-b border-vault-200 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-vault-800 dark:bg-vault-950/90 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-vault-500 dark:text-vault-400">Revisions</p>
            <h2 className="text-lg font-semibold text-vault-950 dark:text-vault-50">{currentCharacter.name}</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCreateSnapshot()}
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-vault-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-vault-100 dark:text-vault-900 dark:hover:bg-white"
            >
              {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              Save snapshot
            </button>
            <button
              type="button"
              onClick={requestClose}
              disabled={isBusy}
              className="rounded-lg border border-vault-300 p-2 text-vault-500 transition-colors hover:bg-vault-100 hover:text-vault-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-vault-700 dark:text-vault-400 dark:hover:bg-vault-800 dark:hover:text-vault-100"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Sidebar - Flattened */}
          <aside className="hidden min-h-0 w-full max-w-xs shrink-0 border-r border-vault-200 bg-vault-50/50 dark:border-vault-800 dark:bg-vault-950/50 md:flex md:flex-col">
            <div className="flex items-center justify-between border-b border-vault-200 px-4 py-2.5 dark:border-vault-800">
              <span className="text-sm font-medium text-vault-900 dark:text-vault-100">{snapshotMetadata.length} revisions</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {isSnapshotsLoading && snapshotMetadata.length === 0 ? (
                <div className="space-y-2">
                  {[0, 1, 2].map(index => (
                    <div
                      key={`timeline-skeleton-${index}`}
                      className="animate-pulse rounded-xl border border-vault-200 bg-white p-3 dark:border-vault-800 dark:bg-vault-900/60"
                    >
                      <div className="h-3.5 w-20 rounded bg-vault-200 dark:bg-vault-700" />
                      <div className="mt-2 h-2.5 w-full rounded bg-vault-150 dark:bg-vault-800" />
                    </div>
                  ))}
                </div>
              ) : snapshotMetadata.length === 0 ? (
                <div className="rounded-xl border border-dashed border-vault-300 bg-white/80 p-4 text-center text-sm text-vault-500 dark:border-vault-700 dark:bg-vault-900/60 dark:text-vault-400">
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
                      hasChanges={diffCounts[meta.id] ?? false}
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
              <MobileRevisionScroller
                metadata={snapshotMetadata}
                selectedSnapshotId={selectedSnapshotId}
                highlightedSnapshotIds={highlightedSnapshotIds}
                hasChangesById={diffCounts}
                onSelect={handleSelectSnapshot}
                onDelete={(meta) => setConfirmAction({ kind: 'delete', metadata: meta })}
              />
            ) : null}

            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">
              {!selectedSnapshotId ? (
                <div className="flex min-h-full items-center justify-center rounded-2xl border border-dashed border-vault-300 bg-vault-50/50 p-8 text-center dark:border-vault-700 dark:bg-vault-900/40">
                  <div className="max-w-md">
                    <h3 className="text-lg font-semibold text-vault-900 dark:text-vault-100">Select a revision</h3>
                    <p className="mt-1 text-sm text-vault-500 dark:text-vault-400">
                      Choose a save point from the timeline to review changes against your current draft.
                    </p>
                  </div>
                </div>
              ) : isLoadingDiff ? (
                <div className="flex min-h-full items-center justify-center">
                  <div className="text-center">
                    <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-vault-400" />
                    <p className="mt-2 text-sm text-vault-500 dark:text-vault-400">Loading diff...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Snapshot summary - Flattened, no card wrapper */}
                  {selectedMetadata && (
                    <SnapshotSummary
                      metadata={selectedMetadata}
                      changedSectionCount={changedSectionCount}
                      hasActiveSectionDiff={hasActiveSectionDiff}
                      isBusy={isBusy}
                      isSnapshotMissing={selectedSnapshot === null}
                      hasAttemptedLoad={hasAttemptedLoad}
                      onRestore={() => selectedMetadata && setConfirmAction({ kind: 'restore-whole', metadata: selectedMetadata })}
                    />
                  )}

                  {changedSectionCount === 0 ? (
                    <p className="text-sm text-vault-500 dark:text-vault-400">
                      This snapshot already matches the current draft. No restore action is needed.
                    </p>
                  ) : (
                    <div className="space-y-0">
                      {diffEntries.map(entry => (
                        <DiffSection
                          key={entry.section}
                          entry={entry}
                          snapshot={selectedSnapshot}
                          isActive={entry.section === activeSection}
                          isCollapsed={collapsedSections[entry.section] ?? isSectionCollapsedByDefault(entry.section, activeSection)}
                          isBusy={isBusy}
                          hasAttemptedLoad={hasAttemptedLoad}
                          onToggle={() => toggleSectionCollapsed(entry.section)}
                          onRestore={() => selectedMetadata && setConfirmAction({ kind: 'restore-section', metadata: selectedMetadata, entry })}
                        />
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
