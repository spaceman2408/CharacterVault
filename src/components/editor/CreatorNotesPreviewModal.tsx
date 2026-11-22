/**
 * @fileoverview Sandboxed preview modal for Creator Notes HTML/CSS content.
 * @module components/editor/CreatorNotesPreviewModal
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { Columns2 } from 'lucide-react';
import { CreatorNotesPreviewPane } from './CreatorNotesPreviewPane';
import type { CreatorNotesPreviewPrefs } from './useCreatorNotesPreviewPrefs';

interface CreatorNotesPreviewModalProps {
  content: string;
  charName: string;
  prefs: CreatorNotesPreviewPrefs;
  onPrefsChange: (patch: Partial<CreatorNotesPreviewPrefs>) => void;
  showRemoteWarning?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onDock: () => void;
}

export function CreatorNotesPreviewModal({
  content,
  charName,
  prefs,
  onPrefsChange,
  showRemoteWarning,
  isOpen,
  onClose,
  onDock,
}: CreatorNotesPreviewModalProps): React.ReactElement | null {
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Creator Notes Preview"
        className="relative z-10 flex h-[90vh] w-[90vw] flex-col overflow-hidden rounded-2xl border shadow-2xl border-border bg-surface"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4 border-border">
          <h3 className="text-lg font-semibold text-fg">
            Creator Notes Preview
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDock}
              className="hidden items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-accent-soft hover:text-accent sm:inline-flex"
            >
              <Columns2 className="h-4 w-4" aria-hidden="true" />
              Dock
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors border-border text-fg hover:bg-hover"
            >
              Close
            </button>
          </div>
        </div>

        <CreatorNotesPreviewPane
          content={content}
          charName={charName}
          prefs={prefs}
          onPrefsChange={onPrefsChange}
          showRemoteWarning={showRemoteWarning}
          frameClassName="flex-1 overflow-auto rounded-[1.25rem] border border-vault-600 bg-vault-800 shadow-[0_20px_60px_rgba(17,24,39,0.35)]"
          emptyClassName="flex-1 overflow-auto rounded-[1.25rem] border-dashed border-vault-500 bg-vault-800 px-5 py-6 text-center text-sm text-fg-subtle"
        />
      </div>
    </div>,
    document.body
  );
}

export default CreatorNotesPreviewModal;
