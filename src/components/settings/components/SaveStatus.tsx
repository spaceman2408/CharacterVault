import React from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';

export const SaveStatus: React.FC<{
  isDirty: boolean;
  isSaving: boolean;
  isEditingText: boolean;
  saveError: string | null;
  lastSavedAt: number | null;
}> = ({ isDirty, isSaving, isEditingText, saveError, lastSavedAt }) => {
  let content: React.ReactNode;
  if (saveError) {
    const [first, ...rest] = saveError.split('\n');
    content = (
      <span className="flex items-start gap-1.5 text-danger" title={saveError}>
        <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
        <span className="min-w-0">
          Not saved: {first}
          {rest.length > 0 && ` (+${rest.length} more)`}
        </span>
      </span>
    );
  } else if (isSaving || (isDirty && !isEditingText)) {
    content = (
      <span className="flex items-center gap-1.5">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        Saving…
      </span>
    );
  } else if (isDirty) {
    content = 'Saves when you leave this field';
  } else if (lastSavedAt !== null) {
    content = (
      <span className="flex items-center gap-1.5">
        <Check className="h-4 w-4 shrink-0 text-success" />
        Saved
      </span>
    );
  } else {
    content = 'Changes save automatically';
  }

  return (
    <div role="status" aria-live="polite" className="min-w-0 flex-1 text-xs text-fg-muted">
      {content}
    </div>
  );
};
