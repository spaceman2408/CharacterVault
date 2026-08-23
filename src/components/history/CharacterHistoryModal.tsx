import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  Clock3,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { useCharacterEditorContext } from '../../context';
import { characterSnapshotService, shouldComputePayloadHash } from '../../services';
import type { CharacterBook, SnapshotMetadata, SnapshotDiffEntry } from '../../db/characterTypes';

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

interface DiffGap {
  key: string;
  hiddenLineCount: number;
}

type RenderableDiffLine =
  | { type: 'line'; line: HighlightedLine }
  | { type: 'gap'; gap: DiffGap };

type ConfirmAction =
  | { kind: 'delete'; metadata: SnapshotMetadata }
  | { kind: 'restore-whole'; metadata: SnapshotMetadata }
  | { kind: 'restore-section'; metadata: SnapshotMetadata; entry: SnapshotDiffEntry }
  | { kind: 'update-baseline'; metadata: SnapshotMetadata };

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
    .sort((left, right) => (left.insertion_order ?? left.id) - (right.insertion_order ?? right.id)) ?? [];
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

function isCreatorNotesEntry(entry: SnapshotDiffEntry): boolean {
  return entry.section === 'creator_notes';
}

function extractStyleBlocks(html: string): string[] {
  const normalizedHtml = normalizeLineEndings(html);
  const styleBlocks: string[] = [];
  const styleTagPattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;

  for (const match of normalizedHtml.matchAll(styleTagPattern)) {
    const css = match[1]?.trim();
    if (css) {
      styleBlocks.push(css);
    }
  }

  return styleBlocks;
}

function formatCreatorNotesCss(value: string): string {
  const cssBlocks = extractStyleBlocks(value);
  if (cssBlocks.length === 0) {
    return '';
  }

  return normalizeLineEndings(cssBlocks.join('\n\n/* --- */\n\n'));
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

function buildRenderableDiffLines(lines: HighlightedLine[], contextLines = 2): RenderableDiffLine[] {
  if (lines.length === 0) {
    return [];
  }

  const changedIndexes = lines.reduce<number[]>((indexes, line, index) => {
    if (line.changed) {
      indexes.push(index);
    }
    return indexes;
  }, []);

  if (changedIndexes.length === 0) {
    return lines.map(line => ({ type: 'line', line }));
  }

  const windows = changedIndexes.reduce<Array<{ start: number; end: number }>>((ranges, index) => {
    const start = Math.max(0, index - contextLines);
    const end = Math.min(lines.length - 1, index + contextLines);
    const previousRange = ranges[ranges.length - 1];

    if (previousRange && start <= previousRange.end + 1) {
      previousRange.end = Math.max(previousRange.end, end);
    } else {
      ranges.push({ start, end });
    }

    return ranges;
  }, []);

  const renderableLines: RenderableDiffLine[] = [];

  windows.forEach((range, rangeIndex) => {
    if (rangeIndex > 0) {
      const previousRange = windows[rangeIndex - 1];
      const hiddenLineCount = range.start - previousRange.end - 1;
      if (hiddenLineCount > 0) {
        renderableLines.push({
          type: 'gap',
          gap: {
            key: `gap-${rangeIndex}-${range.start}`,
            hiddenLineCount,
          },
        });
      }
    }

    for (let index = range.start; index <= range.end; index += 1) {
      renderableLines.push({
        type: 'line',
        line: lines[index],
      });
    }
  });

  return renderableLines;
}

function isSectionCollapsedByDefault(section: SnapshotDiffEntry['section'], activeSection: string): boolean {
  return section !== activeSection;
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

function HighlightedText({
  lines,
  changedToneClassName,
  isCode = false,
}: {
  lines: HighlightedLine[];
  changedToneClassName: string;
  isCode?: boolean;
}): React.ReactElement {
  const textClassName = isCode
    ? 'font-mono text-[12px] leading-5 whitespace-pre-wrap break-all [overflow-wrap:anywhere]'
    : 'text-sm leading-6 whitespace-pre-wrap break-words';

  return (
    <div className="space-y-1">
      {lines.length > 0 ? lines.map((line) => (
        <div
          key={line.key}
          className={`min-w-0 rounded px-1.5 py-0.5 text-fg ${
            textClassName
          } ${
            line.changed ? 'bg-muted' : ''
          }`}
        >
          {line.segments.length > 0 ? line.segments.map((segment, segmentIndex) => (
            <span
              key={`${line.key}-${segmentIndex}`}
              className={segment.changed ? `rounded px-0.5 ${changedToneClassName}` : undefined}
            >
              {segment.text || ' '}
            </span>
          )) : line.value ? (
            <span>{line.value}</span>
          ) : (
            <span aria-hidden="true"> </span>
          )}
        </div>
      )) : (
        <div className="rounded px-2 py-1 text-sm text-fg-subtle">Empty</div>
      )}
    </div>
  );
}

function HunkedHighlightedText({
  lines,
  changedToneClassName,
  contextLines = 2,
}: {
  lines: HighlightedLine[];
  changedToneClassName: string;
  contextLines?: number;
}): React.ReactElement {
  const renderableLines = useMemo(
    () => buildRenderableDiffLines(lines, contextLines),
    [contextLines, lines],
  );

  return (
    <div className="space-y-1">
      {renderableLines.length > 0 ? renderableLines.map((item) => {
        if (item.type === 'gap') {
          return (
            <div
              key={item.gap.key}
              className="rounded border-dashed px-2 py-1 font-medium border-border bg-muted text-fg-muted"
            >
              {item.gap.hiddenLineCount} unchanged {item.gap.hiddenLineCount === 1 ? 'line' : 'lines'} hidden
            </div>
          );
        }

        const line = item.line;
        return (
          <div
            key={line.key}
            className={`min-w-0 rounded px-1.5 py-0.5 font-mono text-[12px] leading-5 whitespace-pre-wrap break-all wrap-anywhere text-fg ${
              line.changed ? 'bg-muted' : ''
            }`}
          >
            {line.segments.length > 0 ? line.segments.map((segment, segmentIndex) => (
              <span
                key={`${line.key}-${segmentIndex}`}
                className={segment.changed ? `rounded px-0.5 ${changedToneClassName}` : undefined}
              >
                {segment.text || ' '}
              </span>
            )) : line.value ? (
              <span>{line.value}</span>
            ) : (
              <span aria-hidden="true"> </span>
            )}
          </div>
        );
      }) : (
        <div className="rounded px-2 py-1 text-sm text-fg-subtle">Empty</div>
      )}
    </div>
  );
}

function ImagePreviewCard({
  heading,
  value,
  showHeading = true,
}: {
  heading: string;
  value: unknown;
  showHeading?: boolean;
}): React.ReactElement {
  return (
    <div>
      {showHeading ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">{heading}</p>
      ) : null}
      <div className="flex min-h-32 items-center justify-center rounded-lg border p-2 border-border bg-surface">
        {typeof value === 'string' && value ? (
          <img src={value} alt={heading} className="max-h-40 rounded object-contain" />
        ) : (
          <span className="text-sm text-fg-muted">No image</span>
        )}
      </div>
    </div>
  );
}

type DiffPaneSide = 'revision' | 'draft';

/**
 * Side-by-side on large screens; mobile-only dropdown to toggle one pane at a time.
 */
function DualPaneDiffLayout({
  revisionTitle,
  draftTitle,
  revisionContent,
  draftContent,
}: {
  revisionTitle: string;
  draftTitle: string;
  revisionContent: React.ReactNode;
  draftContent: React.ReactNode;
}): React.ReactElement {
  const [mobilePane, setMobilePane] = useState<DiffPaneSide>('revision');

  return (
    <div className="overflow-hidden rounded border border-border bg-muted">
      <div className="sticky top-0 z-10 border-b border-border bg-muted p-2 lg:hidden">
        <div className="relative">
          <select
            value={mobilePane}
            onChange={(event) => setMobilePane(event.target.value as DiffPaneSide)}
            aria-label="Show revision or current draft"
            className="w-full appearance-none rounded-lg border border-border-strong bg-surface px-3 py-2.5 pr-9 text-sm font-medium text-fg touch-manipulation focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="revision">{revisionTitle}</option>
            <option value="draft">{draftTitle}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        <div className="grid min-w-0 lg:grid-cols-2">
          <div
            className={`min-w-0 border-b border-border p-3 lg:border-b-0 lg:border-r ${
              mobilePane === 'revision' ? 'block' : 'hidden'
            } lg:block`}
          >
            <p className="mb-2 hidden text-xs font-semibold uppercase tracking-wide text-fg-muted lg:block">
              {revisionTitle}
            </p>
            {revisionContent}
          </div>
          <div
            className={`min-w-0 p-3 ${
              mobilePane === 'draft' ? 'block' : 'hidden'
            } lg:block`}
          >
            <p className="mb-2 hidden text-xs font-semibold uppercase tracking-wide text-fg-muted lg:block">
              {draftTitle}
            </p>
            {draftContent}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatChangedLineCount(count: number): string {
  return `${count} ${count === 1 ? 'line' : 'lines'} changed`;
}

function SyncedDiffView({
  snapshotValue,
  currentValue,
  isSnapshotMissing,
  hasAttemptedLoad,
  isCode = false,
}: {
  snapshotValue: string;
  currentValue: string;
  isSnapshotMissing?: boolean;
  hasAttemptedLoad?: boolean;
  isCode?: boolean;
}): React.ReactElement {
  const snapshotLines = useMemo(() => buildHighlightedLines(snapshotValue, currentValue), [currentValue, snapshotValue]);
  const currentLines = useMemo(() => buildHighlightedLines(currentValue, snapshotValue), [currentValue, snapshotValue]);
  const changedLineCountLeft = useMemo(() => snapshotLines.filter(line => line.changed).length, [snapshotLines]);
  const changedLineCountRight = useMemo(() => currentLines.filter(line => line.changed).length, [currentLines]);

  if (isSnapshotMissing && hasAttemptedLoad) {
    return (
      <div className="max-h-96 overflow-y-auto rounded border border-border bg-muted">
        <div className="p-6 text-center">
          <div className="rounded-xl bg-warning-soft p-3 text-warning-soft-fg">
            <ShieldAlert className="mx-auto h-6 w-6" />
          </div>
          <h4 className="mt-3 text-sm font-semibold text-fg">Snapshot data unavailable</h4>
          <p className="mt-1 text-xs text-fg-muted">
            This revision's snapshot could not be loaded. It may have been corrupted or failed to save properly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DualPaneDiffLayout
      revisionTitle={`Revision snapshot · ${formatChangedLineCount(changedLineCountLeft)}`}
      draftTitle={`Current draft · ${formatChangedLineCount(changedLineCountRight)}`}
      revisionContent={(
        <div className="space-y-1 overflow-x-auto rounded p-2 bg-bg/50">
          <HighlightedText
            lines={snapshotLines}
            changedToneClassName="bg-warning-soft text-warning-soft-fg"
            isCode={isCode}
          />
        </div>
      )}
      draftContent={(
        <div className="space-y-1 overflow-x-auto rounded p-2 bg-bg/50">
          <HighlightedText
            lines={currentLines}
            changedToneClassName="bg-success-soft text-success-soft-fg"
            isCode={isCode}
          />
        </div>
      )}
    />
  );
}

function CreatorNotesDiffView({
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
  const [viewMode, setViewMode] = useState<'css' | 'full'>('css');
  const snapshotCss = useMemo(() => formatCreatorNotesCss(snapshotValue), [snapshotValue]);
  const currentCss = useMemo(() => formatCreatorNotesCss(currentValue), [currentValue]);
  const hasCssDiffView = snapshotCss.length > 0 || currentCss.length > 0;
  const resolvedViewMode = hasCssDiffView ? viewMode : 'full';
  const snapshotCssLines = useMemo(() => buildHighlightedLines(snapshotCss, currentCss), [currentCss, snapshotCss]);
  const currentCssLines = useMemo(() => buildHighlightedLines(currentCss, snapshotCss), [currentCss, snapshotCss]);
  const changedCssLineCountLeft = useMemo(() => snapshotCssLines.filter(line => line.changed).length, [snapshotCssLines]);
  const changedCssLineCountRight = useMemo(() => currentCssLines.filter(line => line.changed).length, [currentCssLines]);

  if (isSnapshotMissing && hasAttemptedLoad) {
    return (
      <SyncedDiffView
        snapshotValue={snapshotValue}
        currentValue={currentValue}
        isSnapshotMissing={isSnapshotMissing}
        hasAttemptedLoad={hasAttemptedLoad}
        isCode
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-fg">Creator Notes diff</p>
          <p className="text-xs text-fg-muted">
            {hasCssDiffView
              ? 'Changed CSS is shown with nearby context so large style blocks stay readable.'
              : 'No embedded CSS blocks were found, so the full document diff is shown.'}
          </p>
        </div>
        <div className="inline-flex rounded-lg border p-1 border-border bg-surface">
          {hasCssDiffView ? (
            <button
              type="button"
              onClick={() => setViewMode('css')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                resolvedViewMode === 'css'
                  ? 'bg-accent text-accent-fg'
                  : 'text-fg-muted hover:bg-hover'
              }`}
            >
              Changed CSS
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setViewMode('full')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              resolvedViewMode === 'full'
                ? 'bg-accent text-accent-fg'
                : 'text-fg-muted hover:bg-hover'
            }`}
          >
            Full document
          </button>
        </div>
      </div>

      {resolvedViewMode === 'css' && hasCssDiffView ? (
        <DualPaneDiffLayout
          revisionTitle={`Revision snapshot · ${formatChangedLineCount(changedCssLineCountLeft)}`}
          draftTitle={`Current CSS · ${formatChangedLineCount(changedCssLineCountRight)}`}
          revisionContent={(
            <div className="space-y-1 overflow-x-auto rounded p-2 bg-bg/50">
              <HunkedHighlightedText
                lines={snapshotCssLines}
                changedToneClassName="bg-warning-soft text-warning-soft-fg"
              />
            </div>
          )}
          draftContent={(
            <div className="space-y-1 overflow-x-auto rounded p-2 bg-bg/50">
              <HunkedHighlightedText
                lines={currentCssLines}
                changedToneClassName="bg-success-soft text-success-soft-fg"
              />
            </div>
          )}
        />
      ) : (
        <SyncedDiffView
          snapshotValue={snapshotValue}
          currentValue={currentValue}
          isSnapshotMissing={isSnapshotMissing}
          hasAttemptedLoad={hasAttemptedLoad}
          isCode
        />
      )}
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
    <DualPaneDiffLayout
      revisionTitle={`Revision snapshot · ${formatChangedLineCount(changedLineCountLeft)}`}
      draftTitle={`Current draft · ${formatChangedLineCount(changedLineCountRight)}`}
      revisionContent={(
        <div className="space-y-1 rounded p-2 bg-bg/50">
          <HighlightedText
            lines={snapshotLines}
            changedToneClassName="bg-warning-soft text-warning-soft-fg"
          />
        </div>
      )}
      draftContent={(
        <div className="space-y-1 rounded p-2 bg-bg/50">
          <HighlightedText
            lines={currentLines}
            changedToneClassName="bg-success-soft text-success-soft-fg"
          />
        </div>
      )}
    />
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
      <DualPaneDiffLayout
        revisionTitle="Revision snapshot"
        draftTitle="Current draft"
        revisionContent={
          <ImagePreviewCard heading="Revision snapshot" value={entry.snapshotValue} showHeading={false} />
        }
        draftContent={
          <ImagePreviewCard heading="Current draft" value={entry.currentValue} showHeading={false} />
        }
      />
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

  if (isCreatorNotesEntry(entry)) {
    return (
      <CreatorNotesDiffView
        snapshotValue={snapshotValue}
        currentValue={currentValue}
        isSnapshotMissing={isSnapshotMissing}
        hasAttemptedLoad={hasAttemptedLoad}
      />
    );
  }

  return (
    <SyncedDiffView
      snapshotValue={snapshotValue}
      currentValue={currentValue}
      isSnapshotMissing={isSnapshotMissing}
      hasAttemptedLoad={hasAttemptedLoad}
    />
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

interface DiffSectionProps {
  entry: SnapshotDiffEntry;
  snapshotLoaded: boolean;
  isActive: boolean;
  isCollapsed: boolean;
  isBusy: boolean;
  hasAttemptedLoad: boolean;
  onToggle: () => void;
  onRestore: () => void;
}

function DiffSection({
  entry,
  snapshotLoaded,
  isActive,
  isCollapsed,
  isBusy,
  hasAttemptedLoad,
  onToggle,
  onRestore,
}: DiffSectionProps): React.ReactElement {
  const isSnapshotMissing = !snapshotLoaded;

  return (
    <div className="border-t pt-4 first:border-t-0 first:pt-0 border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 text-left"
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-fg-muted transition-transform ${
            isCollapsed ? '-rotate-90' : 'rotate-0'
          }`}
        />
        <span className="flex-1 text-base font-semibold text-fg">{entry.label}</span>
        {isActive && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-info-soft px-2 py-0.5 font-semibold text-info-soft-fg">
            Active
          </span>
        )}
      </button>

      {!isCollapsed && (
        <div className="mt-3 pl-7">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-fg-muted">Compare snapshot vs. current draft</p>
            <button
              type="button"
              onClick={onRestore}
              disabled={isBusy || isSnapshotMissing}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-border text-fg hover:bg-hover"
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
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [highlightedSnapshotIds, setHighlightedSnapshotIds] = useState<string[]>([]);
  const [currentPayloadHash, setCurrentPayloadHash] = useState<string | null>(null);
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
    setCollapsedSections({});
    setHighlightedSnapshotIds([]);
    setHasAttemptedLoad(false);
    setIsContentReady(false);
    setCurrentPayloadHash(null);
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

  useEffect(() => {
    if (!shouldComputePayloadHash(isVisible) || !currentCharacter) {
      if (!isVisible) {
        setCurrentPayloadHash(null);
      }
      return;
    }

    let cancelled = false;
    void characterSnapshotService.computeCharacterPayloadHash(currentCharacter).then(hash => {
      if (!cancelled) {
        setCurrentPayloadHash(hash);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentCharacter, isVisible]);

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

  const diffCounts = useMemo(() => {
    const hasChangesById: Record<string, boolean> = {};

    snapshotMetadata.forEach(meta => {
      // Cheap check: if payloadHash differs from current, it has changes
      hasChangesById[meta.id] = currentPayloadHash !== null &&
        meta.payloadHash !== currentPayloadHash;
    });

    return hasChangesById;
  }, [snapshotMetadata, currentPayloadHash]);

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
    setCollapsedSections({});
    if (snapshotId !== selectedSnapshotId) {
      setSelectedSnapshotId(snapshotId);
      setDiffEntries([]);
      setSnapshotLoaded(false);
      setIsLoadingDiff(true);
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={requestClose}
    >
      <div
        className={`relative flex h-dvh w-full flex-col overflow-hidden bg-surface transition-all duration-200 sm:h-[min(88vh,860px)] sm:max-w-7xl sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl ${
          isClosing ? 'translate-y-3 opacity-0 sm:translate-y-0 sm:scale-[0.98]' : 'translate-y-0 opacity-100 sm:scale-100'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header - Flattened */}
        <div className="flex items-center justify-between gap-4 border-b px-4 py-3 backdrop-blur-xl border-border bg-bg/90 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Revisions</p>
            <h2 className="text-lg font-semibold text-fg">{currentCharacter.name}</h2>
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
              <div className={`transition-opacity duration-200 ${isContentReady ? 'opacity-100' : 'opacity-0'}`}>
                <MobileRevisionScroller
                metadata={snapshotMetadata}
                selectedSnapshotId={selectedSnapshotId}
                highlightedSnapshotIds={highlightedSnapshotIds}
                hasChangesById={diffCounts}
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
                    <p className="text-sm text-fg-muted">
                      This snapshot already matches the current draft. No restore action is needed.
                    </p>
                  ) : (
                    <div className="space-y-0">
                      {diffEntries.map(entry => (
                        <DiffSection
                          key={entry.section}
                          entry={entry}
                          snapshotLoaded={snapshotLoaded}
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
