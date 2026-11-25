import React from 'react';
import { Star } from 'lucide-react';

interface TagChipProps {
  label: string;
  selected: boolean;
  favorite: boolean;
  onToggle: () => void;
  onToggleFavorite: () => void;
  disabled?: boolean;
  excluded?: boolean;
  custom?: boolean;
  favoriteTitles?: { add: string; remove: string };
}

const DEFAULT_FAVORITE_TITLES = { add: 'Add to favorites', remove: 'Remove from favorites' };

export const TagChip: React.FC<TagChipProps> = ({
  label,
  selected,
  favorite,
  onToggle,
  onToggleFavorite,
  disabled = false,
  excluded = false,
  custom = false,
  favoriteTitles = DEFAULT_FAVORITE_TITLES,
}) => {
  const showStar = (selected || favorite) && !excluded;
  const starTitle = favorite ? favoriteTitles.remove : favoriteTitles.add;
  const stateClass = selected
    ? 'bg-accent-soft text-accent border-accent ring-1 ring-accent'
    : excluded
    ? 'opacity-30 border-border text-fg-subtle line-through'
    : custom
    ? 'border-dashed border-accent/60 text-fg-muted hover:border-accent hover:bg-accent-soft hover:text-accent'
    : 'border-border text-fg-muted hover:border-accent/40 hover:bg-accent-soft hover:text-accent';

  return (
    <span
      className={`inline-flex items-center rounded-lg border transition-all ${stateClass} ${
        disabled && !excluded ? 'opacity-50' : ''
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled || excluded}
        title={excluded ? 'This tag conflicts with your current selection' : undefined}
        className={`py-1 text-xs font-medium disabled:cursor-not-allowed ${showStar ? 'pl-2.5 pr-1' : 'px-2.5'}`}
      >
        {label}
      </button>
      {showStar && (
        <button
          type="button"
          onClick={onToggleFavorite}
          disabled={disabled}
          className="py-1 pr-2 hover:opacity-75 transition-opacity disabled:cursor-not-allowed"
          aria-label={`${starTitle}: ${label}`}
          title={starTitle}
        >
          <Star className={`w-3 h-3 ${favorite ? 'fill-current' : ''}`} />
        </button>
      )}
    </span>
  );
};
