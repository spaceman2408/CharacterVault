import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { addKey, parseKeyList, removeKey, replaceKey } from './recursionGraph';

export type RecursionKeyChipsProps = {
  keys: string[];
  onChange: (keys: string[]) => void;
  /** When set, only these keys are shown and the add field is hidden. */
  displayKeys?: string[];
  placeholder?: string;
  'aria-label'?: string;
};

export function RecursionKeyChips({
  keys,
  onChange,
  displayKeys,
  placeholder = 'Add a key',
  'aria-label': ariaLabel = 'Primary keys',
}: RecursionKeyChipsProps): React.ReactElement {
  const shown = displayKeys ?? keys;
  const allowAdd = displayKeys == null;
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [addValue, setAddValue] = useState('');
  const editingRef = useRef<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const keysRef = useRef(keys);
  const draftRef = useRef(draft);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    keysRef.current = keys;
    draftRef.current = draft;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (editing != null) editInputRef.current?.focus();
  }, [editing]);

  const commitPendingEdit = (applyLocalState: boolean) => {
    const from = editingRef.current;
    if (from == null) return;
    const currentKeys = keysRef.current;
    const next = replaceKey(currentKeys, from, draftRef.current);
    editingRef.current = null;
    if (applyLocalState) {
      setEditing(null);
      setDraft('');
    }
    if (next !== currentKeys) onChangeRef.current(next);
  };

  useEffect(() => {
    return () => {
      // Closing the map (or dropping this hop) can unmount a focused rename
      // input without a blur. Persist through refs; skip setState.
      commitPendingEdit(false);
    };
  }, []);

  const startEdit = (key: string) => {
    editingRef.current = key;
    setEditing(key);
    setDraft(key);
  };

  const commitEdit = () => {
    commitPendingEdit(true);
  };

  const cancelEdit = () => {
    editingRef.current = null;
    setEditing(null);
    setDraft('');
  };

  const commitAdd = (raw: string) => {
    const parsed = parseKeyList(raw);
    let next = keys;
    for (const key of parsed) {
      next = addKey(next, key);
    }
    if (next !== keys) onChange(next);
    setAddValue('');
  };

  return (
    <div className="flex flex-wrap items-center gap-1" aria-label={ariaLabel}>
      {shown.map((key) =>
        editing === key ? (
          <input
            key={`edit-${key}`}
            ref={editInputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitEdit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cancelEdit();
              }
            }}
            aria-label={`Rename key ${key}`}
            className="min-w-16 max-w-40 rounded-md border border-accent bg-surface px-1.5 py-0.5 text-[11px] text-fg outline-none focus:ring-2 focus:ring-accent/20"
          />
        ) : (
          <span
            key={key}
            className="inline-flex max-w-full items-center rounded-md border border-border bg-muted text-fg-muted"
          >
            <button
              type="button"
              onClick={() => startEdit(key)}
              title="Click to rename"
              className="max-w-36 truncate px-1.5 py-0.5 text-[11px] font-medium hover:text-fg touch-manipulation"
            >
              {key}
            </button>
            <button
              type="button"
              aria-label={`Remove key ${key}`}
              title={`Remove ${key}`}
              onClick={() => {
                const next = removeKey(keys, key);
                if (next !== keys) onChange(next);
              }}
              className="rounded-r-md px-1 py-0.5 text-fg-subtle hover:bg-hover hover:text-fg touch-manipulation"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ),
      )}
      {allowAdd && (
        <input
          value={addValue}
          onChange={(e) => {
            const value = e.target.value;
            if (value.includes(',')) {
              commitAdd(value);
              return;
            }
            setAddValue(value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitAdd(addValue);
            } else if (e.key === 'Escape' && addValue) {
              e.preventDefault();
              e.stopPropagation();
              setAddValue('');
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-20 flex-1 basis-20 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[11px] text-fg placeholder:text-fg-subtle outline-none focus:border-border focus:bg-surface"
        />
      )}
    </div>
  );
}
