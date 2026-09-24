import { Fragment, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Book,
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  FileText,
  ListPlus,
  ListX,
  MessagesSquare,
  Pencil,
  Settings2,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { countApproved, defaultDecisions, formatGreetingsForEdit } from './diff';
import { diffParagraphs, type ParagraphDiff, type ParagraphRow, type RichPart } from './paragraphDiff';
import type { WordDiffSegment } from './wordDiff';
import type { AgentReviewChange, ReviewDecision, ReviewDecisions } from './types';

interface AgentReviewModalProps {
  changes: AgentReviewChange[];
  isApplying: boolean;
  onApply: (decisions: ReviewDecisions) => void;
  onDiscard: () => void;
  onMinimize: () => void;
}

function changeTitle(change: AgentReviewChange): { label: string; detail: string } {
  switch (change.kind) {
    case 'field':
      return { label: change.label, detail: 'Character field' };
    case 'greeting':
      if (change.before === '') {
        return { label: `Greeting #${change.index + 1}`, detail: 'New alternate greeting' };
      }
      if (change.after === '') {
        return { label: `Greeting #${change.index + 1}`, detail: 'Deleted alternate greeting' };
      }
      return { label: `Greeting #${change.index + 1}`, detail: 'Alternate greeting' };
    case 'greetings':
      return { label: 'Greetings list', detail: 'Added, removed, or reordered greetings' };
    case 'entry-added':
      return { label: change.title, detail: `New lorebook entry #${change.entryId}` };
    case 'entry-updated':
      return { label: change.title, detail: `Updated lorebook entry #${change.entryId}` };
    case 'entry-deleted':
      return { label: change.title, detail: `Deleted lorebook entry #${change.entryId}` };
    case 'book-settings':
      return { label: 'Book settings', detail: 'Lorebook name, description, or scan settings' };
  }
}

function ChangeIcon({ change }: { change: AgentReviewChange }): React.ReactElement {
  const className = 'h-4 w-4 shrink-0 text-accent';
  switch (change.kind) {
    case 'field':
      return change.fieldId === 'name' ? <User className={className} /> : <FileText className={className} />;
    case 'greeting':
    case 'greetings':
      return <MessagesSquare className={className} />;
    case 'entry-added':
      return <ListPlus className={className} />;
    case 'entry-deleted':
      return <ListX className={className} />;
    case 'entry-updated':
      return <Book className={className} />;
    case 'book-settings':
      return <Settings2 className={className} />;
  }
}

type EntryEditChange = Extract<
  AgentReviewChange,
  { kind: 'entry-added' } | { kind: 'entry-updated' }
>;

function entryProposedContent(change: EntryEditChange): string {
  return change.kind === 'entry-added' ? change.content : change.afterContent;
}

function entryProposedKeys(change: EntryEditChange): string[] {
  return change.kind === 'entry-added' ? change.keys : change.afterKeys;
}

function changeTextPair(change: AgentReviewChange): { before: string; after: string } | null {
  switch (change.kind) {
    case 'field':
    case 'greeting':
      return { before: change.before, after: change.after };
    case 'greetings':
      return null;
    case 'entry-added':
      return { before: '', after: change.content };
    case 'entry-updated':
      return { before: change.beforeContent, after: change.afterContent };
    case 'entry-deleted':
      return { before: change.content, after: '' };
    case 'book-settings':
      return null;
  }
}

function WordSegments({
  segments,
  showDeletions,
}: {
  segments: WordDiffSegment[];
  showDeletions: boolean;
}): React.ReactElement {
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'same') return <span key={index}>{segment.text}</span>;
        if (segment.type === 'del' && showDeletions) {
          return (
            <span key={index} className="rounded bg-danger-soft px-px text-danger-soft-fg">
              {segment.text}
            </span>
          );
        }
        if (segment.type === 'add' && !showDeletions) {
          return (
            <span key={index} className="rounded bg-success-soft px-px text-success-soft-fg">
              {segment.text}
            </span>
          );
        }
        return null;
      })}
    </>
  );
}

function DiffCell({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-bg p-2.5">
      <div className="max-h-64 overflow-y-auto whitespace-pre-wrap wrap-break-word text-xs leading-relaxed text-fg">
        {children}
      </div>
    </div>
  );
}

function RichParts({
  parts,
  showDeletions,
}: {
  parts: RichPart[];
  showDeletions: boolean;
}): React.ReactElement {
  const changedClassName = showDeletions
    ? 'rounded bg-danger-soft px-px text-danger-soft-fg'
    : 'rounded bg-success-soft px-px text-success-soft-fg';
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && '\n'}
          {part.kind === 'same' ? (
            <span>{part.text}</span>
          ) : part.kind === 'changed' ? (
            <span className={changedClassName}>{part.text}</span>
          ) : (
            <WordSegments segments={part.diff.segments} showDeletions={showDeletions} />
          )}
        </Fragment>
      ))}
    </>
  );
}

function rowSideNode(row: ParagraphRow, showDeletions: boolean): React.ReactNode {
  switch (row.kind) {
    case 'same':
      return <span>{row.paras.join('\n\n')}</span>;
    case 'add':
      if (showDeletions) return null;
      return (
        <span className="rounded bg-success-soft px-px text-success-soft-fg">
          {row.paras.join('\n\n')}
        </span>
      );
    case 'del':
      if (!showDeletions) return null;
      return (
        <span className="rounded bg-danger-soft px-px text-danger-soft-fg">
          {row.paras.join('\n\n')}
        </span>
      );
    case 'replace':
      return <RichParts parts={showDeletions ? row.left : row.right} showDeletions={showDeletions} />;
  }
}

function SideContent({
  rows,
  showDeletions,
  emptyLabel,
}: {
  rows: ParagraphRow[];
  showDeletions: boolean;
  emptyLabel: string;
}): React.ReactElement {
  const blocks: React.ReactNode[] = [];
  rows.forEach((row) => {
    const node = rowSideNode(row, showDeletions);
    if (node) blocks.push(node);
  });
  if (blocks.length === 0) {
    return <span className="italic text-fg-subtle">{emptyLabel}</span>;
  }
  return (
    <>
      {blocks.map((block, index) => (
        <Fragment key={index}>
          {index > 0 && '\n\n'}
          {block}
        </Fragment>
      ))}
    </>
  );
}

function ParagraphDiffView({
  diff,
  before,
}: {
  diff: ParagraphDiff;
  before: string;
}): React.ReactElement {
  if (diff.rows.length === 0) {
    return <p className="text-xs italic text-fg-subtle">(empty)</p>;
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-fg-subtle" />
          Original
        </p>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-accent" />
          Agent
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <DiffCell>
          <SideContent rows={diff.rows} showDeletions emptyLabel="(empty)" />
        </DiffCell>
        <DiffCell>
          <SideContent
            rows={diff.rows}
            showDeletions={false}
            emptyLabel={before === '' ? '(new)' : '(removed)'}
          />
        </DiffCell>
      </div>
    </div>
  );
}

function DiffStat({
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

function GreetingsStat({ before, after }: { before: string[]; after: string[] }): React.ReactElement | null {
  const added = Math.max(0, after.length - before.length);
  const removed = Math.max(0, before.length - after.length);
  if (added === 0 && removed === 0) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold">
      {added > 0 && (
        <span className="rounded bg-success-soft px-1.5 py-0.5 text-success-soft-fg">
          +{added} greeting{added === 1 ? '' : 's'}
        </span>
      )}
      {removed > 0 && (
        <span className="rounded bg-danger-soft px-1.5 py-0.5 text-danger-soft-fg">
          −{removed} greeting{removed === 1 ? '' : 's'}
        </span>
      )}
    </span>
  );
}

function GreetingBlock({
  index,
  text,
  badge,
  badgeClassName,
  accent,
}: {
  index: number;
  text: string;
  badge?: string;
  badgeClassName?: string;
  accent?: boolean;
}): React.ReactElement {
  return (
    <div
      className={`rounded-lg border p-2.5 ${
        accent ? 'border-accent/30 bg-bg' : 'border-border bg-bg'
      }`}
    >
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-fg-subtle">
        Greeting #{index + 1}
        {badge && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClassName ?? ''}`}>
            {badge}
          </span>
        )}
      </p>
      <div className="max-h-40 overflow-y-auto whitespace-pre-wrap wrap-break-word text-xs leading-relaxed text-fg">
        {text || <span className="italic text-fg-subtle">(empty)</span>}
      </div>
    </div>
  );
}

function GreetingsListView({ before, after }: { before: string[]; after: string[] }): React.ReactElement {
  const isAppend =
    after.length > before.length && before.every((greeting, index) => greeting === after[index]);
  const isTruncate =
    before.length > after.length && after.every((greeting, index) => greeting === before[index]);
  const MAX_RENDERED_GREETINGS = 100;
  const renderTruncatedNotice = (total: number): React.ReactElement | null => {
    if (total <= MAX_RENDERED_GREETINGS) return null;
    return (
      <p className="rounded-lg border border-border bg-bg p-2.5 text-xs italic text-fg-subtle">
        …and {total - MAX_RENDERED_GREETINGS} more (approve to keep them; edit to prune).
      </p>
    );
  };
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      <div className="min-w-0 space-y-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-fg-subtle" />
          Original · {before.length} greeting{before.length === 1 ? '' : 's'}
        </p>
        {before.length === 0 && (
          <p className="rounded-lg border border-border bg-bg p-2.5 text-xs italic text-fg-subtle">
            (no greetings)
          </p>
        )}
        {before.slice(0, MAX_RENDERED_GREETINGS).map((greeting, index) => (
          <GreetingBlock
            key={index}
            index={index}
            text={greeting}
            badge={isTruncate && index >= after.length ? 'Removed' : undefined}
            badgeClassName="bg-danger-soft text-danger-soft-fg"
          />
        ))}
        {renderTruncatedNotice(before.length)}
      </div>
      <div className="min-w-0 space-y-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-accent" />
          Agent · {after.length} greeting{after.length === 1 ? '' : 's'}
        </p>
        {after.length === 0 && (
          <p className="rounded-lg border border-border bg-bg p-2.5 text-xs italic text-fg-subtle">
            (no greetings)
          </p>
        )}
        {after.slice(0, MAX_RENDERED_GREETINGS).map((greeting, index) => (
          <GreetingBlock
            key={index}
            index={index}
            text={greeting}
            accent
            badge={isAppend && index >= before.length ? 'New' : undefined}
            badgeClassName="bg-success-soft text-success-soft-fg"
          />
        ))}
        {renderTruncatedNotice(after.length)}
      </div>
    </div>
  );
}

interface ChangeRowProps {
  change: AgentReviewChange;
  decision: ReviewDecision;
  expanded: boolean;
  onToggleExpanded: () => void;
  onApproveChange: (approved: boolean) => void;
  onEditText: (edited: string) => void;
  onEditKeys: (raw: string) => void;
}

function ChangeRow({
  change,
  decision,
  expanded,
  onToggleExpanded,
  onApproveChange,
  onEditText,
  onEditKeys,
}: ChangeRowProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const { label, detail } = changeTitle(change);
  const pair = useMemo(() => changeTextPair(change), [change]);
  const paraDiff = useMemo(() => (pair ? diffParagraphs(pair.before, pair.after) : null), [pair]);
  const editable =
    change.kind === 'field' ||
    change.kind === 'greeting' ||
    change.kind === 'greetings' ||
    change.kind === 'entry-added' ||
    change.kind === 'entry-updated';
  const editedText =
    decision.edited ??
    (change.kind === 'field' || change.kind === 'greeting'
      ? change.after
      : change.kind === 'greetings'
        ? formatGreetingsForEdit(change.after)
        : change.kind === 'entry-added' || change.kind === 'entry-updated'
          ? entryProposedContent(change)
          : '');

  return (
    <article
      className={`overflow-hidden rounded-xl border transition-colors ${
        decision.approved ? 'border-border bg-surface' : 'border-border bg-bg opacity-75'
      }`}
    >
      <div className="flex items-center gap-1.5 p-2 sm:gap-2 sm:p-2.5">
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left transition-colors hover:bg-hover/60"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-fg-subtle transition-transform ${expanded ? '' : '-rotate-90'}`}
          />
          <span className="rounded-lg bg-accent-soft p-1.5">
            <ChangeIcon change={change} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-fg">{label}</span>
            <span className="block truncate text-[11px] text-fg-subtle">{detail}</span>
          </span>
        </button>
        {paraDiff && (
          <DiffStat addedWords={paraDiff.addedWords} removedWords={paraDiff.removedWords} />
        )}
        {change.kind === 'greetings' && (
          <GreetingsStat before={change.before} after={change.after} />
        )}
        {editable && decision.approved && expanded && (
          <button
            type="button"
            onClick={() => setIsEditing((editing) => !editing)}
            className={`rounded-lg p-1.5 transition-colors ${
              isEditing ? 'bg-accent text-accent-fg' : 'text-fg-subtle hover:bg-hover hover:text-fg'
            }`}
            title={isEditing ? 'Stop editing' : 'Edit proposed text'}
            aria-label={isEditing ? `Stop editing ${label}` : `Edit proposed ${label}`}
            aria-pressed={isEditing}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onApproveChange(!decision.approved)}
          aria-pressed={decision.approved}
          aria-label={decision.approved ? `Deny ${label}` : `Approve ${label}`}
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            decision.approved
              ? 'border-success/40 bg-success-soft text-success-soft-fg'
              : 'border-border bg-muted text-fg-muted hover:text-fg'
          }`}
        >
          {decision.approved ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {decision.approved ? 'Approved' : 'Denied'}
        </button>
      </div>

      {expanded && decision.approved && (
        <div className="space-y-2 border-t border-border px-3 py-3">
          {(change.kind === 'entry-added' || change.kind === 'entry-updated') && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <p className="truncate text-[11px] text-fg-subtle">
                Keys: {(change.kind === 'entry-added' ? change.keys : change.beforeKeys).join(', ') || '—'}
              </p>
              <p className="truncate text-[11px] text-fg-subtle">
                <span className="font-semibold text-accent">Agent keys: </span>
                {(decision.editedKeys ?? entryProposedKeys(change)).join(', ') || '—'}
              </p>
            </div>
          )}
          {isEditing ? (
            <div className="space-y-2">
              {(change.kind === 'entry-added' || change.kind === 'entry-updated') && (
                <input
                  value={(decision.editedKeys ?? entryProposedKeys(change)).join(', ')}
                  onChange={(e) => onEditKeys(e.target.value)}
                  placeholder="Keys, comma separated"
                  className="w-full rounded-lg border border-accent/40 bg-bg px-2.5 py-1.5 text-xs text-fg outline-none focus:ring-2 focus:ring-accent/30"
                  aria-label={`Edited keys for ${label}`}
                />
              )}
              <textarea
                value={editedText}
                onChange={(e) => onEditText(e.target.value)}
                rows={change.kind === 'field' || change.kind === 'greeting' ? 6 : 8}
                className="w-full rounded-lg border border-accent/40 bg-bg p-2.5 text-xs leading-relaxed text-fg outline-none focus:ring-2 focus:ring-accent/30"
                aria-label={`Edited ${label}`}
              />
              {change.kind === 'greetings' && (
                <p className="text-[11px] text-fg-subtle">
                  Separate greetings with a line containing only ---.
                </p>
              )}
            </div>
          ) : (
            <>
              {paraDiff && pair && <ParagraphDiffView diff={paraDiff} before={pair.before} />}
              {change.kind === 'greetings' && (
                <GreetingsListView before={change.before} after={change.after} />
              )}
              {change.kind === 'book-settings' && (
                <ul className="space-y-1 rounded-lg border border-accent/25 bg-accent-soft/40 p-2.5">
                  {change.summary.map((line) => (
                    <li key={line} className="text-xs text-fg">
                      {line}
                    </li>
                  ))}
                </ul>
              )}
              {change.kind === 'entry-updated' && change.metaChanged && (
                <p className="text-[11px] text-fg-subtle">Entry flags or metadata also changed.</p>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}

export function AgentReviewModal({
  changes,
  isApplying,
  onApply,
  onDiscard,
  onMinimize,
}: AgentReviewModalProps): React.ReactElement {
  const [decisions, setDecisions] = useState<ReviewDecisions>(() => defaultDecisions(changes));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(changes.slice(0, 1).map((change) => change.id)),
  );
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Resync when a new review payload arrives while the modal is mounted;
  // otherwise decisions/expanded would silently refer to stale change ids.
  const changeIdsKey = changes.map((change) => change.id).join('\n');
  useEffect(() => {
    setDecisions(defaultDecisions(changes));
    setExpanded(new Set(changes.slice(0, 1).map((change) => change.id)));
    setConfirmDiscard(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeIdsKey]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMinimize();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onMinimize]);

  const approvedCount = useMemo(() => countApproved(decisions), [decisions]);

  const setApproved = (id: string, approved: boolean) => {
    setDecisions((prev) => ({ ...prev, [id]: { ...prev[id], approved } }));
  };

  const setEdited = (id: string, edited: string) => {
    setDecisions((prev) => ({ ...prev, [id]: { ...prev[id], approved: true, edited } }));
  };

  const setEditedKeys = (id: string, raw: string) => {
    const editedKeys = raw
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    setDecisions((prev) => ({ ...prev, [id]: { ...prev[id], approved: true, editedKeys } }));
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const approveAll = () => {
    setDecisions((prev) => {
      const next: ReviewDecisions = {};
      for (const change of changes) next[change.id] = { ...prev[change.id], approved: true };
      return next;
    });
  };

  const denyAll = () => {
    setDecisions((prev) => {
      const next: ReviewDecisions = {};
      for (const change of changes) next[change.id] = { ...prev[change.id], approved: false };
      return next;
    });
    setConfirmDiscard(false);
  };

  const expandAll = () => setExpanded(new Set(changes.map((change) => change.id)));
  const collapseAll = () => setExpanded(new Set());

  const specChanges = changes.filter(
    (change) => change.kind === 'field' || change.kind === 'greeting' || change.kind === 'greetings',
  );
  const bookChanges = changes.filter(
    (change) =>
      change.kind === 'entry-added' ||
      change.kind === 'entry-updated' ||
      change.kind === 'entry-deleted' ||
      change.kind === 'book-settings',
  );

  const renderSection = (sectionChanges: AgentReviewChange[]) => (
    <>
      {sectionChanges.map((change) => (
        <ChangeRow
          key={change.id}
          change={change}
          decision={decisions[change.id] ?? { approved: true }}
          expanded={expanded.has(change.id)}
          onToggleExpanded={() => toggleExpanded(change.id)}
          onApproveChange={(approved) => setApproved(change.id, approved)}
          onEditText={(edited) => setEdited(change.id, edited)}
          onEditKeys={(raw) => setEditedKeys(change.id, raw)}
        />
      ))}
    </>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-overlay p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onMinimize();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-review-title"
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-bg shadow-2xl ring-1 ring-border"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-4 py-3 sm:px-5">
          <span className="rounded-xl bg-accent-soft p-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="agent-review-title" className="truncate text-base font-bold text-fg">
              Review agent edits
            </h2>
            <p className="text-xs text-fg-muted">
              {approvedCount} of {changes.length} approved · nothing is applied until you confirm
            </p>
          </div>
          <button
            type="button"
            onClick={onMinimize}
            className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-muted hover:text-fg"
            aria-label="Minimize review (decide later)"
            title="Decide later"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1 border-b border-border bg-bg px-4 py-1.5 sm:px-5">
          <span className="mr-auto text-[11px] text-fg-subtle">
            {changes.length} {changes.length === 1 ? 'edit' : 'edits'} proposed
          </span>
          <button
            type="button"
            onClick={expandAll}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-muted hover:text-fg"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-muted hover:text-fg"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" />
            Collapse all
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3 sm:p-5">
          {specChanges.length > 0 && (
            <section aria-label="Character changes" className="space-y-2">
              {bookChanges.length > 0 && (
                <h3 className="text-xs font-bold uppercase tracking-wider text-fg-muted">
                  Character
                </h3>
              )}
              {renderSection(specChanges)}
            </section>
          )}
          {bookChanges.length > 0 && (
            <section aria-label="Lorebook changes" className="space-y-2">
              {specChanges.length > 0 && (
                <h3 className="text-xs font-bold uppercase tracking-wider text-fg-muted">
                  Lorebook
                </h3>
              )}
              {renderSection(bookChanges)}
            </section>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-surface px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={approveAll}
            className="rounded-lg px-3 py-2 text-xs font-medium text-fg-muted transition-colors hover:bg-muted hover:text-fg"
          >
            Approve all
          </button>
          <button
            type="button"
            onClick={denyAll}
            className="rounded-lg px-3 py-2 text-xs font-medium text-fg-muted transition-colors hover:bg-muted hover:text-fg"
          >
            Deny all
          </button>
          <span className="flex-1" />
          {confirmDiscard ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-fg-muted transition-colors hover:bg-muted hover:text-fg"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={onDiscard}
                disabled={isApplying}
                className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Confirm discard
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDiscard(true)}
              disabled={isApplying}
              className="rounded-lg px-3 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
            >
              Discard all
            </button>
          )}
          <button
            type="button"
            onClick={() => onApply(decisions)}
            disabled={isApplying || approvedCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            {isApplying ? 'Applying…' : `Apply ${approvedCount}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
