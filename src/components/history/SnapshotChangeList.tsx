import { useMemo, useState } from 'react';
import {
  Book,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  FileText,
  Image as ImageIcon,
  ListPlus,
  ListX,
  MessagesSquare,
  RotateCcw,
  Settings2,
  User,
} from 'lucide-react';
import type { SnapshotDiffEntry } from '../../db/characterTypes';
import {
  DiffLegend,
  DiffStat,
  LineDiffView,
  diffLines,
  useLazyLineDiff,
  type DiffLabels,
  type TextPair,
} from '../diff';
import type { SettingChange, SnapshotChange, SnapshotChangeGroup } from './snapshotChanges';

const SNAPSHOT_LABELS: DiffLabels = { before: 'Revision', after: 'Current' };

const GROUPED_SECTIONS: ReadonlySet<SnapshotDiffEntry['section']> = new Set(['alternate_greetings', 'lorebook']);

function changeTitle(change: SnapshotChange): { label: string; detail: string } {
  switch (change.kind) {
    case 'text':
      return { label: change.label, detail: 'Character field' };
    case 'image':
      return { label: 'Image', detail: 'Character image' };
    case 'greeting': {
      const label = `Greeting #${change.index + 1}`;
      if (change.status === 'added') return { label, detail: 'New alternate greeting' };
      if (change.status === 'deleted') return { label, detail: 'Deleted alternate greeting' };
      return { label, detail: 'Alternate greeting' };
    }
    case 'entry':
      if (change.status === 'added') return { label: change.title, detail: `New lorebook entry #${change.entryId}` };
      if (change.status === 'deleted') return { label: change.title, detail: `Deleted lorebook entry #${change.entryId}` };
      return { label: change.title, detail: `Updated lorebook entry #${change.entryId}` };
    case 'book-settings':
      return { label: 'Book settings', detail: 'Lorebook name, description, or scan settings' };
  }
}

function ChangeIcon({ change, section }: { change: SnapshotChange; section: SnapshotDiffEntry['section'] }): React.ReactElement {
  const className = 'h-4 w-4 shrink-0 text-accent';
  switch (change.kind) {
    case 'text':
      return section === 'name' ? <User className={className} /> : <FileText className={className} />;
    case 'image':
      return <ImageIcon className={className} />;
    case 'greeting':
      return <MessagesSquare className={className} />;
    case 'entry':
      if (change.status === 'added') return <ListPlus className={className} />;
      if (change.status === 'deleted') return <ListX className={className} />;
      return <Book className={className} />;
    case 'book-settings':
      return <Settings2 className={className} />;
  }
}

function textPair(change: SnapshotChange): TextPair | null {
  switch (change.kind) {
    case 'text':
    case 'greeting':
      return { before: change.before, after: change.after };
    case 'entry':
      return change.contentChanged ? { before: change.beforeContent, after: change.afterContent } : null;
    case 'image':
    case 'book-settings':
      return null;
  }
}

function RestoreButton({
  label,
  disabled,
  onRestore,
}: {
  label: string;
  disabled: boolean;
  onRestore: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onRestore}
      disabled={disabled}
      aria-label={`Restore ${label}`}
      title="Restore from this revision"
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RotateCcw className="h-3 w-3" />
      Restore
    </button>
  );
}

function ActiveBadge(): React.ReactElement {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-semibold text-info-soft-fg">
      Active
    </span>
  );
}

function ImageBox({ src, alt }: { src: string; alt: string }): React.ReactElement {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-lg border border-border bg-bg p-2">
      {src ? (
        <img src={src} alt={alt} className="max-h-40 rounded object-contain" />
      ) : (
        <span className="text-xs italic text-fg-subtle">No image</span>
      )}
    </div>
  );
}

function SettingList({ settings }: { settings: SettingChange[] }): React.ReactElement | null {
  const short = settings.filter((setting) => !setting.long);
  const long = settings.filter((setting) => setting.long);
  return (
    <>
      {short.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-accent/25 bg-accent-soft/40 p-2.5">
          {short.map((setting) => (
            <li key={setting.label} className="text-xs text-fg">
              <span className="font-semibold">{setting.label}:</span> {setting.before || '—'} → {setting.after || '—'}
            </li>
          ))}
        </ul>
      )}
      {long.map((setting) => (
        <LongSettingDiff key={setting.label} setting={setting} />
      ))}
    </>
  );
}

function LongSettingDiff({ setting }: { setting: SettingChange }): React.ReactElement {
  const diff = useMemo(() => diffLines(setting.before, setting.after), [setting]);
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold text-fg-subtle">{setting.label}</p>
      <LineDiffView diff={diff} labels={SNAPSHOT_LABELS} />
    </div>
  );
}

function EntryKeys({ change }: { change: Extract<SnapshotChange, { kind: 'entry' }> }): React.ReactElement {
  if (change.status === 'edited' && change.keysChanged) {
    return (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <p className="truncate text-[11px] text-fg-subtle">Keys: {change.beforeKeys || '—'}</p>
        <p className="truncate text-[11px] text-fg-subtle">
          <span className="font-semibold text-accent">Current keys: </span>
          {change.afterKeys || '—'}
        </p>
      </div>
    );
  }
  const keys = change.status === 'deleted' ? change.beforeKeys : change.afterKeys;
  return <p className="truncate text-[11px] text-fg-subtle">Keys: {keys || '—'}</p>;
}

interface ChangeCardProps {
  change: SnapshotChange;
  section: SnapshotDiffEntry['section'];
  expanded: boolean;
  isActive: boolean;
  onToggleExpanded: () => void;
  restore?: { disabled: boolean; onRestore: () => void };
}

function ChangeCard({
  change,
  section,
  expanded,
  isActive,
  onToggleExpanded,
  restore,
}: ChangeCardProps): React.ReactElement {
  const { label, detail } = changeTitle(change);
  const pair = useMemo(() => textPair(change), [change]);
  const { counts, diff: lineDiff } = useLazyLineDiff(pair, expanded);

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface">
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
            <ChangeIcon change={change} section={section} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-fg">{label}</span>
            <span className="block truncate text-[11px] text-fg-subtle">{detail}</span>
          </span>
        </button>
        {isActive && <ActiveBadge />}
        {counts && <DiffStat addedWords={counts.addedWords} removedWords={counts.removedWords} />}
        {restore && <RestoreButton label={label} disabled={restore.disabled} onRestore={restore.onRestore} />}
      </div>

      {expanded && (
        <div className="space-y-2 border-t border-border px-3 py-3">
          {change.kind === 'image' && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="space-y-1.5">
                <DiffLegend label={SNAPSHOT_LABELS.before} side="del" />
                <ImageBox src={change.before} alt="Revision image" />
              </div>
              <div className="space-y-1.5">
                <DiffLegend label={SNAPSHOT_LABELS.after} side="add" />
                <ImageBox src={change.after} alt="Current image" />
              </div>
            </div>
          )}
          {change.kind === 'entry' && <EntryKeys change={change} />}
          {(change.kind === 'entry' || change.kind === 'book-settings') && (
            <SettingList settings={change.settings} />
          )}
          {lineDiff && <LineDiffView diff={lineDiff} labels={SNAPSHOT_LABELS} />}
        </div>
      )}
    </article>
  );
}

function orderGroups(groups: SnapshotChangeGroup[]): SnapshotChangeGroup[] {
  return [
    ...groups.filter((group) => !GROUPED_SECTIONS.has(group.entry.section)),
    ...groups.filter((group) => group.entry.section === 'alternate_greetings'),
    ...groups.filter((group) => group.entry.section === 'lorebook'),
  ];
}

function initialExpanded(groups: SnapshotChangeGroup[], activeSection: string): Set<string> {
  const active = groups.find((group) => group.entry.section === activeSection) ?? groups[0];
  const first = active?.changes[0];
  return new Set(first ? [first.id] : []);
}

interface SnapshotChangeListProps {
  groups: SnapshotChangeGroup[];
  activeSection: string;
  restoreDisabled: boolean;
  onRestore: (entry: SnapshotDiffEntry) => void;
}

/** Agent-review style cards for a revision's changes; restore works per section. */
export function SnapshotChangeList({
  groups,
  activeSection,
  restoreDisabled,
  onRestore,
}: SnapshotChangeListProps): React.ReactElement {
  const ordered = useMemo(() => orderGroups(groups), [groups]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => initialExpanded(ordered, activeSection));
  const changeCount = ordered.reduce((count, group) => count + group.changes.length, 0);
  const fieldGroups = ordered.filter((group) => !GROUPED_SECTIONS.has(group.entry.section));
  const sectionGroups = ordered.filter((group) => GROUPED_SECTIONS.has(group.entry.section));

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderCard = (group: SnapshotChangeGroup, change: SnapshotChange, withRestore: boolean) => (
    <ChangeCard
      key={change.id}
      change={change}
      section={group.entry.section}
      expanded={expanded.has(change.id)}
      isActive={withRestore && group.entry.section === activeSection}
      onToggleExpanded={() => toggleExpanded(change.id)}
      restore={withRestore ? { disabled: restoreDisabled, onRestore: () => onRestore(group.entry) } : undefined}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-border pb-1.5">
        <span className="mr-auto text-[11px] text-fg-subtle">
          {changeCount} {changeCount === 1 ? 'change' : 'changes'} since this revision
        </span>
        <button
          type="button"
          onClick={() => setExpanded(new Set(ordered.flatMap((group) => group.changes.map((change) => change.id))))}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-muted hover:text-fg"
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
          Expand all
        </button>
        <button
          type="button"
          onClick={() => setExpanded(new Set())}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-muted hover:text-fg"
        >
          <ChevronsDownUp className="h-3.5 w-3.5" />
          Collapse all
        </button>
      </div>

      {fieldGroups.length > 0 && (
        <section aria-label="Character changes" className="space-y-2">
          {sectionGroups.length > 0 && (
            <h3 className="text-xs font-bold uppercase tracking-wider text-fg-muted">Character</h3>
          )}
          {fieldGroups.flatMap((group) => group.changes.map((change) => renderCard(group, change, true)))}
        </section>
      )}
      {sectionGroups.map((group) => (
        <section key={group.entry.section} aria-label={`${group.entry.label} changes`} className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-fg-muted">{group.entry.label}</h3>
            {group.entry.section === activeSection && <ActiveBadge />}
            <span className="flex-1" />
            <RestoreButton
              label={group.entry.label}
              disabled={restoreDisabled}
              onRestore={() => onRestore(group.entry)}
            />
          </div>
          {group.changes.map((change) => renderCard(group, change, false))}
        </section>
      ))}
    </div>
  );
}
