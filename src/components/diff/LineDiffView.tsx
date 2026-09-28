import { Fragment, useEffect, useMemo, useState } from 'react';
import { UnfoldVertical } from 'lucide-react';
import {
  foldUnchanged,
  toSplitRows,
  type LineDiff,
  type LineRow,
  type SideCell,
  type SplitRow,
} from './lineDiff';
import type { WordDiffSegment } from './wordDiff';

export interface DiffLabels {
  before: string;
  after: string;
}

const NARROW_QUERY = '(max-width: 767px)';

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(NARROW_QUERY);
    const handleChange = () => setNarrow(mql.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);
  return narrow;
}

type DiffSide = 'del' | 'add';

const LINE_TINT: Record<DiffSide, string> = {
  del: 'bg-diff-del-line',
  add: 'bg-diff-add-line',
};

const WORD_TINT: Record<DiffSide, string> = {
  del: 'rounded-sm bg-diff-del-word',
  add: 'rounded-sm bg-diff-add-word',
};

const EMPTY_CELL =
  'bg-[repeating-linear-gradient(135deg,transparent_0_5px,var(--border)_5px_6px)]';

function WordSegments({
  segments,
  side,
}: {
  segments: WordDiffSegment[];
  side: DiffSide;
}): React.ReactElement {
  return (
    <>
      {segments.map((segment, index) =>
        segment.type === 'same' ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <span key={index} className={WORD_TINT[side]}>
            {segment.text}
          </span>
        ),
      )}
    </>
  );
}

function SideCellView({
  cell,
  side,
  divider,
}: {
  cell: SideCell | null;
  side: DiffSide;
  divider?: boolean;
}): React.ReactElement {
  const base = `min-w-0 whitespace-pre-wrap wrap-break-word px-2.5 py-0.5 ${divider ? 'border-r border-border' : ''}`;
  if (!cell) return <div aria-hidden="true" className={`${base} ${EMPTY_CELL}`} />;
  if (cell.tone === 'same') return <div className={base}>{cell.text}</div>;
  return (
    <div className={`${base} ${LINE_TINT[side]}`}>
      {cell.tone === 'changed' ? cell.text : <WordSegments segments={cell.segments} side={side} />}
    </div>
  );
}

export function DiffLegend({ label, side }: { label: string; side: DiffSide | 'same' }): React.ReactElement {
  const dotClassName = side === 'del' ? 'bg-danger' : side === 'add' ? 'bg-success' : 'bg-fg-subtle';
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
      <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${dotClassName}`} />
      {label}
    </p>
  );
}

type VisibleItem<T> =
  | { kind: 'item'; item: T; index: number }
  | { kind: 'fold'; key: number; count: number };

function useFoldedItems<T>(
  items: T[],
  isUnchanged: (item: T) => boolean,
): { visible: VisibleItem<T>[]; expand: (key: number) => void } {
  const folded = useMemo(() => foldUnchanged(items, isUnchanged), [items, isUnchanged]);
  const [openFolds, setOpenFolds] = useState<ReadonlySet<number>>(() => new Set());
  const visible = useMemo(() => {
    const out: VisibleItem<T>[] = [];
    let index = 0;
    for (const part of folded) {
      if (part.kind === 'item') {
        out.push({ kind: 'item', item: part.item, index });
        index += 1;
      } else if (openFolds.has(part.key)) {
        for (const item of part.items) {
          out.push({ kind: 'item', item, index });
          index += 1;
        }
      } else {
        out.push({ kind: 'fold', key: part.key, count: part.items.length });
        index += part.items.length;
      }
    }
    return out;
  }, [folded, openFolds]);
  const expand = (key: number) => setOpenFolds((prev) => new Set(prev).add(key));
  return { visible, expand };
}

function FoldBar({
  count,
  onExpand,
  className = '',
}: {
  count: number;
  onExpand: () => void;
  className?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onExpand}
      className={`my-0.5 flex w-full items-center justify-center gap-1.5 border-y border-border bg-surface py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg ${className}`}
    >
      <UnfoldVertical className="h-3.5 w-3.5" />
      Show {count} unchanged line{count === 1 ? '' : 's'}
    </button>
  );
}

const isUnchangedSplitRow = (row: SplitRow): boolean => row.left?.tone === 'same';
const isUnchangedLineRow = (row: LineRow): boolean => row.kind === 'same';

function SplitDiffView({ rows, labels }: { rows: LineRow[]; labels: DiffLabels }): React.ReactElement {
  const splitRows = useMemo(() => toSplitRows(rows), [rows]);
  const { visible, expand } = useFoldedItems(splitRows, isUnchangedSplitRow);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg">
      <div className="max-h-80 overflow-y-auto text-xs leading-relaxed text-fg">
        <div className="sticky top-0 z-10 grid grid-cols-2 border-b border-border bg-surface">
          <div className="border-r border-border px-2.5 py-1.5">
            <DiffLegend label={labels.before} side="del" />
          </div>
          <div className="px-2.5 py-1.5">
            <DiffLegend label={labels.after} side="add" />
          </div>
        </div>
        <div className="grid grid-cols-2">
          {visible.map((entry) =>
            entry.kind === 'fold' ? (
              <FoldBar
                key={`fold-${entry.key}`}
                count={entry.count}
                onExpand={() => expand(entry.key)}
                className="col-span-2"
              />
            ) : (
              <Fragment key={entry.index}>
                {entry.item.breakBefore && entry.index > 0 && (
                  <>
                    <div aria-hidden="true" className="h-3 border-r border-border" />
                    <div aria-hidden="true" className="h-3" />
                  </>
                )}
                <SideCellView cell={entry.item.left} side="del" divider />
                <SideCellView cell={entry.item.right} side="add" />
              </Fragment>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function InlineLine({
  side,
  children,
}: {
  side: DiffSide | 'same';
  children: React.ReactNode;
}): React.ReactElement {
  const sign = side === 'del' ? '−' : side === 'add' ? '+' : '';
  return (
    <div className={`flex gap-1.5 px-2 py-0.5 ${side === 'same' ? '' : LINE_TINT[side]}`}>
      <span aria-hidden="true" className="w-2.5 shrink-0 select-none text-center text-fg-subtle">
        {sign}
      </span>
      {side !== 'same' && <span className="sr-only">{side === 'del' ? 'Removed: ' : 'Added: '}</span>}
      <div className="min-w-0 flex-1 whitespace-pre-wrap wrap-break-word">{children}</div>
    </div>
  );
}

function InlineDiffView({ rows, labels }: { rows: LineRow[]; labels: DiffLabels }): React.ReactElement {
  const { visible, expand } = useFoldedItems(rows, isUnchangedLineRow);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg">
      <div className="flex items-center gap-3 border-b border-border bg-surface px-2.5 py-1.5">
        <DiffLegend label={labels.before} side="del" />
        <DiffLegend label={labels.after} side="add" />
      </div>
      <div className="max-h-96 overflow-y-auto py-1 text-xs leading-relaxed text-fg">
        {visible.map((entry) => {
          if (entry.kind === 'fold') {
            return (
              <FoldBar key={`fold-${entry.key}`} count={entry.count} onExpand={() => expand(entry.key)} />
            );
          }
          const row = entry.item;
          return (
            <Fragment key={entry.index}>
              {row.breakBefore && entry.index > 0 && <div aria-hidden="true" className="h-3" />}
              {row.kind === 'same' && <InlineLine side="same">{row.text}</InlineLine>}
              {row.kind === 'del' && <InlineLine side="del">{row.text}</InlineLine>}
              {row.kind === 'add' && <InlineLine side="add">{row.text}</InlineLine>}
              {row.kind === 'pair' && (
                <>
                  <InlineLine side="del">
                    <WordSegments
                      segments={row.diff.segments.filter((segment) => segment.type !== 'add')}
                      side="del"
                    />
                  </InlineLine>
                  <InlineLine side="add">
                    <WordSegments
                      segments={row.diff.segments.filter((segment) => segment.type !== 'del')}
                      side="add"
                    />
                  </InlineLine>
                </>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

export function LineDiffView({ diff, labels }: { diff: LineDiff; labels: DiffLabels }): React.ReactElement {
  const narrow = useIsNarrow();
  const note = diff.whitespaceOnly && (
    <p className="text-xs italic text-fg-subtle">Only spacing or blank lines changed.</p>
  );
  if (diff.rows.length === 0) {
    return note || <p className="text-xs italic text-fg-subtle">(empty)</p>;
  }
  return (
    <>
      {note}
      {narrow ? <InlineDiffView rows={diff.rows} labels={labels} /> : <SplitDiffView rows={diff.rows} labels={labels} />}
    </>
  );
}

export function DiffStat({
  addedWords,
  removedWords,
}: {
  addedWords: number;
  removedWords: number;
}): React.ReactElement | null {
  if (addedWords === 0 && removedWords === 0) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold">
      {addedWords > 0 && (
        <span className="rounded bg-success-soft px-1.5 py-0.5 text-success-soft-fg">
          +{addedWords}
        </span>
      )}
      {removedWords > 0 && (
        <span className="rounded bg-danger-soft px-1.5 py-0.5 text-danger-soft-fg">
          −{removedWords}
        </span>
      )}
    </span>
  );
}
