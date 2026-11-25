import React, { useEffect, useRef, useState } from 'react';
import { Check, Star, Trash2 } from 'lucide-react';

interface TagChipProps {
  label: string;
  selected: boolean;
  favorite: boolean;
  onToggle: () => void;
  onToggleFavorite: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  excluded?: boolean;
  custom?: boolean;
  favoriteTitles?: { add: string; remove: string };
}

const DEFAULT_FAVORITE_TITLES = { add: 'Add to favorites', remove: 'Remove from favorites' };
const DELETE_CONFIRM_TIMEOUT_MS = 4000;

const ChipDeleteButton: React.FC<{ label: string; disabled: boolean; onDelete: () => void }> = ({
  label,
  disabled,
  onDelete,
}) => {
  const [confirming, setConfirming] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), DELETE_CONFIRM_TIMEOUT_MS);
    const onPointerDown = (e: PointerEvent) => {
      if (!buttonRef.current?.contains(e.target as Node)) setConfirming(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [confirming]);

  const showConfirm = confirming && !disabled;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => {
        if (disabled) return;
        if (confirming) {
          setConfirming(false);
          onDelete();
        } else {
          setConfirming(true);
        }
      }}
      disabled={disabled}
      className={`py-1 rounded transition-colors disabled:cursor-not-allowed ${
        showConfirm ? 'text-danger' : 'opacity-60 hover:opacity-100 hover:text-danger'
      }`}
      aria-label={showConfirm ? `Confirm delete custom tag ${label}` : `Delete custom tag ${label}`}
      title={showConfirm ? 'Click again to delete' : 'Delete this custom tag'}
    >
      {showConfirm ? <Check className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
    </button>
  );
};

export const TagChip: React.FC<TagChipProps> = ({
  label,
  selected,
  favorite,
  onToggle,
  onToggleFavorite,
  onDelete,
  disabled = false,
  excluded = false,
  custom = false,
  favoriteTitles = DEFAULT_FAVORITE_TITLES,
}) => {
  const showStar = (selected || favorite) && !excluded;
  const hasControls = showStar || !!onDelete;
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
        className={`py-1 text-xs font-medium disabled:cursor-not-allowed ${hasControls ? 'pl-2.5 pr-1' : 'px-2.5'}`}
      >
        {label}
      </button>
      {hasControls && (
        <span className="inline-flex items-center gap-1 pr-2">
          {showStar && (
            <button
              type="button"
              onClick={onToggleFavorite}
              disabled={disabled}
              className="py-1 hover:opacity-75 transition-opacity disabled:cursor-not-allowed"
              aria-label={`${starTitle}: ${label}`}
              title={starTitle}
            >
              <Star className={`w-3 h-3 ${favorite ? 'fill-current' : ''}`} />
            </button>
          )}
          {onDelete && <ChipDeleteButton label={label} disabled={disabled} onDelete={onDelete} />}
        </span>
      )}
    </span>
  );
};
