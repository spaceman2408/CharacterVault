import { ArrowUpDown, Play, User } from 'lucide-react';
import type { CharacterListItem } from '../../db';
import type { VaultSortMode } from './types';

export interface VaultToolbarProps {
  totalCount: number;
  filteredCount: number;
  searchQuery: string;
  sortMode: VaultSortMode;
  onSortChange: (mode: VaultSortMode) => void;
  lastActive?: CharacterListItem;
  onContinue?: (id: string) => void;
}

export function VaultToolbar({
  totalCount,
  filteredCount,
  searchQuery,
  sortMode,
  onSortChange,
  lastActive,
  onContinue,
}: VaultToolbarProps): React.ReactElement | null {
  if (totalCount === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-fg">Library</h2>
        <p className="text-fg-muted text-sm mt-1">
          {searchQuery
            ? `${filteredCount} of ${totalCount} ${totalCount === 1 ? 'character' : 'characters'}`
            : `${totalCount} ${totalCount === 1 ? 'character' : 'characters'} stored locally`}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1 shadow-xs">
          <ArrowUpDown className="w-3.5 h-3.5 text-fg-subtle ml-2" />
          <button
            type="button"
            onClick={() => onSortChange('name')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              sortMode === 'name'
                ? 'bg-accent text-accent-fg'
                : 'text-fg-muted hover:text-fg hover:bg-accent-soft'
            }`}
          >
            Name
          </button>
          <button
            type="button"
            onClick={() => onSortChange('recent')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              sortMode === 'recent'
                ? 'bg-accent text-accent-fg'
                : 'text-fg-muted hover:text-fg hover:bg-accent-soft'
            }`}
          >
            Recent
          </button>
        </div>

        {!searchQuery && lastActive && onContinue && (
          <button
            type="button"
            onClick={() => onContinue(lastActive.id)}
            className="group flex items-center gap-3 pl-3 pr-2 py-1.5 bg-surface border border-border rounded-full hover:border-accent/40 hover:shadow-md transition-all"
          >
            <div className="text-right min-w-0">
              <p className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider">
                Continue
              </p>
              <p className="text-sm font-semibold max-w-36 truncate text-fg">
                {lastActive.name}
              </p>
            </div>
            <div className="relative w-9 h-9 rounded-full overflow-hidden bg-muted border border-border shrink-0 group-hover:border-accent transition-colors">
              {lastActive.thumbnailData ? (
                <img
                  src={lastActive.thumbnailData}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-fg-subtle">
                  <User className="w-4 h-4" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-overlay/0 group-hover:bg-overlay/40 transition-colors">
                <Play className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 fill-current transition-opacity" />
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
