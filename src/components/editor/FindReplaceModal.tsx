import React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import {
  applyFindReplace,
  findInCard,
  MAX_FIND_MATCHES,
  type FindMatch,
  type FindReplaceCard,
  type FindReplaceOptions,
  type FindTarget,
  type FindTargetMatches,
} from '../../services/findReplace';

interface FindReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  loadCard: () => Promise<FindReplaceCard | null>;
  onJump: (targetId: string) => void;
  /** Replaces the Find text when a new nonce arrives (Ctrl+Shift+F with a selection). */
  prefill?: { text: string; nonce: number } | null;
  /** Extra targets a replace must not empty (e.g. a vault lorebook's name). */
  requiredTargetIds?: readonly string[];
  /** Resolves false when the card changed since `before` was loaded; nothing is saved then. */
  onApply: (
    before: FindReplaceCard,
    after: FindReplaceCard,
    summary: { count: number; places: number },
  ) => Promise<boolean>;
}

const DEBOUNCE_MS = 150;
const CONTEXT_BEFORE = 24;
const CONTEXT_AFTER = 80;

const OPTION_TOGGLES: Array<{ key: keyof FindReplaceOptions; label: string; title: string }> = [
  { key: 'caseSensitive', label: 'Aa', title: 'Match case' },
  { key: 'wholeWord', label: 'ab', title: 'Whole word only' },
  { key: 'regex', label: '.*', title: 'Use regular expression' },
];

const PRESERVE_TOGGLE = { key: 'preserveCase' as const, label: 'AB', title: 'Preserve case' };

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function groupTitle(target: FindTarget): string {
  if (target.entryLabel) return `${target.entryLabel} · ${target.label}`;
  return target.label;
}

const showBreaks = (text: string): string => text.replace(/\r?\n/g, '↵');

function matchContext(text: string, match: FindMatch): { before: string; after: string } {
  const lineStart = text.lastIndexOf('\n', match.start - 1) + 1;
  const newline = text.indexOf('\n', match.end);
  const lineEnd = newline === -1 ? text.length : newline;
  let before = text.slice(lineStart, match.start);
  let after = text.slice(match.end, lineEnd);
  if (before.length > CONTEXT_BEFORE) {
    const tail = before.slice(-CONTEXT_BEFORE);
    const wordStart = tail.search(/\s\S/);
    before = `…${wordStart === -1 ? tail : tail.slice(wordStart + 1)}`;
  }
  if (after.length > CONTEXT_AFTER) after = `${after.slice(0, CONTEXT_AFTER).trimEnd()}…`;
  return { before: before.trimStart(), after };
}

function ToggleButton({
  label,
  title,
  pressed,
  onToggle,
}: {
  label: string;
  title: string;
  pressed: boolean;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      onClick={onToggle}
      className={`h-7 min-w-7 rounded-md px-1.5 font-mono text-xs transition-colors ${
        pressed ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:bg-hover hover:text-fg'
      }`}
    >
      {label}
    </button>
  );
}

function TriStateCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}): React.ReactElement {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-accent"
    />
  );
}

const ResultGroup = React.memo(function ResultGroup({
  group,
  showReplacement,
  excluded,
  collapsed,
  onToggleCollapsed,
  onSetExcluded,
  onJump,
}: {
  group: FindTargetMatches;
  showReplacement: boolean;
  excluded: ReadonlySet<string>;
  collapsed: boolean;
  onToggleCollapsed: (targetId: string) => void;
  onSetExcluded: (ids: string[], excluded: boolean) => void;
  onJump: (targetId: string) => void;
}): React.ReactElement {
  const { target, matches } = group;
  const excludedCount = matches.filter((match) => excluded.has(match.id)).length;
  const title = groupTitle(target);
  const Chevron = collapsed ? ChevronRight : ChevronDown;

  return (
    <li>
      <div
        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-hover"
        onClick={() => onToggleCollapsed(target.id)}
      >
        <Chevron className="h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden="true" />
        <TriStateCheckbox
          label={`Include all matches in ${title}`}
          checked={excludedCount === 0}
          indeterminate={excludedCount > 0 && excludedCount < matches.length}
          onChange={(checked) => onSetExcluded(matches.map((match) => match.id), !checked)}
        />
        <span className="min-w-0 truncate font-medium text-fg">{title}</span>
        <span className="ml-auto shrink-0 rounded-full bg-hover px-1.5 text-xs tabular-nums text-fg-muted">
          {matches.length}
        </span>
      </div>
      {!collapsed && (
        <ul>
          {matches.map((match) => {
            const { before, after } = matchContext(target.text, match);
            const isExcluded = excluded.has(match.id);
            return (
              <li key={match.id}>
                <div
                  className={`flex cursor-pointer items-start gap-2 rounded-md py-1 pl-9 pr-2 text-sm hover:bg-hover ${
                    isExcluded ? 'opacity-50' : ''
                  }`}
                  onClick={() => onJump(target.id)}
                >
                  <TriStateCheckbox
                    label="Include this match"
                    checked={!isExcluded}
                    indeterminate={false}
                    onChange={(checked) => onSetExcluded([match.id], !checked)}
                  />
                  <span className="-mt-0.5 min-w-0 truncate whitespace-pre text-fg-muted">
                    {showBreaks(before)}
                    <mark
                      className={`rounded-sm px-0.5 ${
                        showReplacement && !isExcluded
                          ? 'bg-danger/20 text-danger line-through'
                          : 'bg-accent-soft text-accent'
                      }`}
                    >
                      {showBreaks(match.text)}
                    </mark>
                    {showReplacement && !isExcluded && match.replacement && (
                      <ins className="rounded-sm bg-success/20 px-0.5 text-success no-underline">
                        {showBreaks(match.replacement)}
                      </ins>
                    )}
                    {showBreaks(after)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
});

export function FindReplaceModal({
  isOpen,
  onClose,
  loadCard,
  onJump,
  onApply,
  prefill,
  requiredTargetIds,
}: FindReplaceModalProps): React.ReactElement | null {
  const [query, setQuery] = React.useState('');
  const [replacement, setReplacement] = React.useState('');
  const [options, setOptions] = React.useState<FindReplaceOptions>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    preserveCase: false,
  });
  const [card, setCard] = React.useState<FindReplaceCard | null>(null);
  const [excluded, setExcluded] = React.useState<Set<string>>(() => new Set());
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const [notice, setNotice] = React.useState<string | null>(null);
  const [isApplying, setIsApplying] = React.useState(false);
  const [isPreviewingApply, setIsPreviewingApply] = React.useState(false);
  const findInputRef = React.useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounced(query, DEBOUNCE_MS);
  const debouncedReplacement = useDebounced(replacement, DEBOUNCE_MS);

  React.useEffect(() => {
    if (!prefill) return;
    setQuery(prefill.text);
    const frame = requestAnimationFrame(() => findInputRef.current?.select());
    return () => cancelAnimationFrame(frame);
  }, [prefill]);

  // Parent callbacks change identity on every save; reading them through refs keeps
  // the open effect from reloading the card and refocusing Find while the modal is open.
  const loadCardRef = React.useRef(loadCard);
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    loadCardRef.current = loadCard;
    onCloseRef.current = onClose;
  });

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void loadCardRef.current().then((loaded) => {
      if (!cancelled) setCard(loaded);
    });
    findInputRef.current?.focus();
    findInputRef.current?.select();
    return () => {
      cancelled = true;
      setCard(null);
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const { caseSensitive, wholeWord, regex } = options;
  React.useEffect(() => {
    setExcluded(new Set());
  }, [debouncedQuery, caseSensitive, wholeWord, regex, card]);

  React.useEffect(() => {
    setNotice(null);
  }, [debouncedQuery, debouncedReplacement, options]);

  const result = React.useMemo(
    () => (card ? findInCard(card, debouncedQuery, debouncedReplacement, options) : null),
    [card, debouncedQuery, debouncedReplacement, options],
  );

  const setMatchesExcluded = React.useCallback((ids: string[], exclude: boolean) => {
    setExcluded((previous) => {
      const next = new Set(previous);
      for (const id of ids) {
        if (exclude) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const toggleCollapsed = React.useCallback((targetId: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(targetId)) next.delete(targetId);
      else next.add(targetId);
      return next;
    });
  }, []);

  const handleJump = React.useCallback(
    (targetId: string) => {
      onClose();
      onJump(targetId);
    },
    [onClose, onJump],
  );

  const isSettled = query === debouncedQuery && replacement === debouncedReplacement;
  const includedCount = result?.ok ? result.total - excluded.size : 0;
  const canApply =
    !!card && !!result?.ok && !result.truncated && includedCount > 0 && isSettled && !isApplying;

  const handleApply = async () => {
    if (!card || !result?.ok || !canApply) return;
    const applied = applyFindReplace(card, result.groups, excluded, requiredTargetIds);
    if (!applied.ok) {
      setNotice(applied.error);
      return;
    }
    if (applied.places === 0) {
      setNotice('Nothing would change.');
      return;
    }
    setIsApplying(true);
    try {
      const saved = await onApply(
        card,
        { spec: applied.spec, book: applied.book },
        { count: applied.count, places: applied.places },
      );
      if (saved) {
        setIsPreviewingApply(false);
        onClose();
        return;
      }
      setCard(await loadCardRef.current());
      setNotice('Changed since the search. Matches updated.');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  const showReplacement = debouncedReplacement.length > 0 || (isPreviewingApply && canApply);
  let summary: React.ReactNode = null;
  if (notice) {
    summary = <span className="text-warning">{notice}</span>;
  } else if (result && !result.ok) {
    summary = <span className="text-danger">{result.error}</span>;
  } else if (result && debouncedQuery) {
    if (result.total === 0) {
      summary = 'No matches';
    } else {
      summary = (
        <>
          {result.truncated ? `First ${MAX_FIND_MATCHES.toLocaleString()} matches` : `${result.total.toLocaleString()} match${result.total === 1 ? '' : 'es'}`}
          {` in ${result.groups.length} place${result.groups.length === 1 ? '' : 's'}`}
          {result.truncated && ' · refine to replace'}
          {!result.truncated && excluded.size > 0 && ` · ${includedCount.toLocaleString()} selected`}
        </>
      );
    }
  }

  const inputClass =
    'min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-none!';
  const fieldClass =
    'flex items-center gap-1 rounded-lg border border-border bg-bg pr-1 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent';

  return createPortal(
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-overlay backdrop-blur-sm sm:p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="find-replace-title"
        className="relative z-10 flex h-full w-full flex-col overflow-hidden border-border bg-surface shadow-2xl sm:h-[85vh] sm:max-w-3xl sm:rounded-2xl sm:border"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <h3 id="find-replace-title" className="text-base font-semibold text-fg">
            Find &amp; Replace
          </h3>
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
            className="rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 border-b border-border px-4 py-3">
          <div className={fieldClass}>
            <input
              ref={findInputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find"
              aria-label="Find"
              spellCheck={false}
              className={inputClass}
            />
            {OPTION_TOGGLES.map(({ key, label, title }) => (
              <ToggleButton
                key={key}
                label={label}
                title={title}
                pressed={options[key]}
                onToggle={() => setOptions((previous) => ({ ...previous, [key]: !previous[key] }))}
              />
            ))}
          </div>
          <div className={fieldClass}>
            <input
              type="text"
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
              placeholder="Replace"
              aria-label="Replace"
              spellCheck={false}
              className={inputClass}
            />
            <ToggleButton
              label={PRESERVE_TOGGLE.label}
              title={PRESERVE_TOGGLE.title}
              pressed={options.preserveCase}
              onToggle={() => setOptions((previous) => ({ ...previous, preserveCase: !previous.preserveCase }))}
            />
          </div>
          <div className="flex min-h-8 items-center gap-3">
            <p className="min-w-0 flex-1 text-xs text-fg-muted" aria-live="polite">
              {summary}
            </p>
            {result?.ok && result.total > 0 && (
              <button
                type="button"
                onClick={() => { void handleApply(); }}
                onMouseEnter={() => setIsPreviewingApply(true)}
                onMouseLeave={() => setIsPreviewingApply(false)}
                onFocus={() => setIsPreviewingApply(true)}
                onBlur={() => setIsPreviewingApply(false)}
                disabled={!canApply}
                className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {debouncedReplacement ? 'Replace' : 'Remove'} {includedCount.toLocaleString()}
              </button>
            )}
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {result?.ok &&
            result.groups.map((group) => (
              <ResultGroup
                key={group.target.id}
                group={group}
                showReplacement={showReplacement}
                excluded={excluded}
                collapsed={collapsed.has(group.target.id)}
                onToggleCollapsed={toggleCollapsed}
                onSetExcluded={setMatchesExcluded}
                onJump={handleJump}
              />
            ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

export default FindReplaceModal;
