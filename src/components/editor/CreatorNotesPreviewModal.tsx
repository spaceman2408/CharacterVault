/**
 * @fileoverview Sandboxed preview modal for Creator Notes HTML/CSS content.
 * @module components/editor/CreatorNotesPreviewModal
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { CreatorNotesPreviewPane } from './CreatorNotesPreviewPane';

interface CreatorNotesPreviewModalProps {
  content: string;
  isOpen: boolean;
  onClose: () => void;
  onAddToEditor: () => void;
}

export function CreatorNotesPreviewModal({
  content,
  isOpen,
  onClose,
  onAddToEditor,
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
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 flex h-[90vh] w-[90vw] flex-col overflow-hidden rounded-2xl border border-vault-200 bg-white shadow-2xl dark:border-vault-700 dark:bg-vault-900">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-vault-200 px-5 py-4 dark:border-vault-800">
          <h3 className="text-lg font-semibold text-vault-900 dark:text-vault-50">
            Creator Notes Preview
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddToEditor}
              className="hidden rounded-lg bg-vault-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-vault-700 sm:block dark:hover:bg-vault-500"
            >
              Add to Editor
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-vault-200 px-3 py-2 text-sm font-medium text-vault-700 transition-colors hover:bg-vault-100 dark:border-vault-700 dark:text-vault-200 dark:hover:bg-vault-800"
            >
              Close
            </button>
          </div>
        </div>

        <CreatorNotesPreviewPane
          content={content}
          frameClassName="flex-1 overflow-auto rounded-[1.25rem] border border-vault-600 bg-vault-800 shadow-[0_20px_60px_rgba(17,24,39,0.35)]"
          emptyClassName="flex-1 overflow-auto rounded-[1.25rem] border border-dashed border-vault-500 bg-vault-800 px-5 py-6 text-center text-sm text-vault-300"
        />
      </div>
    </div>,
    document.body
  );
}

export default CreatorNotesPreviewModal;
