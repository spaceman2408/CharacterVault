import React from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import type { LorebookEntryListItemProps } from './types';

function LorebookEntryListItem({
  entry,
  index,
  tokenCount,
  isSelected,
  isContextEnabled,
  onSelect,
  onDelete,
  onToggleContext,
}: LorebookEntryListItemProps): React.ReactElement {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };
  const handleToggleContext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleContext();
  };

  return (
    <div
      onClick={onSelect}
      className={`
        relative cursor-pointer rounded-xl border p-3 transition-colors touch-manipulation
        ${isSelected
          ? 'border-accent bg-accent-soft ring-1 ring-accent'
          : 'border-border bg-surface hover:border-accent/40 hover:bg-accent-soft/60'
        }
      `}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-fg">
            {entry.comment || entry.name || `Entry ${index}`}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
            <span>
              {entry.keys.length} key{entry.keys.length !== 1 ? 's' : ''}
            </span>
            {tokenCount !== null ? <span>{tokenCount.toLocaleString()} tokens</span> : null}
            {!isContextEnabled ? <span className="text-fg-subtle">Hidden from context</span> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={handleToggleContext}
            className={`
              rounded-lg p-2 transition-colors touch-manipulation
              ${isContextEnabled
                ? 'text-success hover:bg-success-soft'
                : 'text-fg-muted hover:bg-hover hover:text-fg'
              }
            `}
            title={
              isContextEnabled ? 'In context (click to exclude)' : 'Not in context (click to include)'
            }
            aria-label={isContextEnabled ? 'Exclude from context' : 'Include in context'}
          >
            {isContextEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-danger-soft hover:text-danger touch-manipulation"
            title="Delete entry"
            aria-label="Delete entry"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export const MemoizedLorebookEntryListItem = React.memo(LorebookEntryListItem);
