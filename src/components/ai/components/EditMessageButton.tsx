import React, { memo } from 'react';
import { Pencil, X } from 'lucide-react';

export interface EditMessageButtonProps {
  /** Pass only for the last user message. */
  onEdit?: () => void;
  /** Pass only while this message is being edited; shows Cancel instead of Edit. */
  onCancelEdit?: () => void;
  disabled?: boolean;
}

export const EditMessageButton: React.FC<EditMessageButtonProps> = memo(
  ({ onEdit, onCancelEdit, disabled = false }) => {
    if (onCancelEdit) {
      return (
        <button
          type="button"
          onClick={onCancelEdit}
          disabled={disabled}
          className="p-1.5 rounded-md transition-all disabled:opacity-40 disabled:pointer-events-none text-accent-fg bg-white/20 hover:bg-white/25"
          title="Cancel edit"
          aria-label="Cancel edit"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      );
    }
    if (!onEdit) return null;
    return (
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled}
        className="p-1.5 rounded-md transition-all focus:opacity-100 disabled:opacity-40 disabled:pointer-events-none opacity-100 md:opacity-0 md:group-hover:opacity-100 text-accent-fg/70 hover:text-accent-fg hover:bg-white/15"
        title="Edit and resend"
        aria-label="Edit and resend"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    );
  }
);

EditMessageButton.displayName = 'EditMessageButton';
