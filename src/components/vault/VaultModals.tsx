import { Copy, Download, Loader2, Trash2, X } from 'lucide-react';
import { IconButton } from './IconButton';
import type { ConfirmTarget } from './types';

export interface VaultModalsProps {
  isCreating: boolean;
  newCharacterName: string;
  onNewCharacterNameChange: (value: string) => void;
  onCreateSubmit: (e: React.FormEvent) => void;
  onCreateCancel: () => void;
  deleteConfirm: ConfirmTarget | null;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  copyConfirm: ConfirmTarget | null;
  onCopyConfirm: () => void;
  onCopyCancel: () => void;
  backupConfirmOpen: boolean;
  isExportingVault: boolean;
  onBackupConfirm: () => void;
  onBackupCancel: () => void;
  createPlaceholder?: string;
}

export function VaultModals({
  isCreating,
  newCharacterName,
  onNewCharacterNameChange,
  onCreateSubmit,
  onCreateCancel,
  deleteConfirm,
  onDeleteConfirm,
  onDeleteCancel,
  copyConfirm,
  onCopyConfirm,
  onCopyCancel,
  backupConfirmOpen,
  isExportingVault,
  onBackupConfirm,
  onBackupCancel,
  createPlaceholder = 'Character name...',
}: VaultModalsProps): React.ReactElement {
  return (
    <>
      {isCreating && (
        <div className="mb-8 animate-in fade-in slide-in-from-top-2">
          <form
            onSubmit={onCreateSubmit}
            className="bg-surface p-4 rounded-2xl border border-border shadow-lg max-w-lg mx-auto flex flex-col sm:flex-row gap-3 sm:gap-2 sm:items-center"
          >
            <input
              autoFocus
              type="text"
              placeholder={createPlaceholder}
              value={newCharacterName}
              onChange={(e) => onNewCharacterNameChange(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-base sm:text-lg font-medium placeholder:text-fg-subtle min-w-0 outline-none"
            />
            <div className="flex gap-2 shrink-0">
              <IconButton icon={X} onClick={onCreateCancel} title="Cancel" />
              <button
                type="submit"
                disabled={!newCharacterName.trim()}
                className="px-4 py-2 bg-accent text-accent-fg rounded-lg text-sm font-medium disabled:opacity-50 whitespace-nowrap hover:opacity-90 transition-opacity"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-border animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-danger-soft rounded-full">
                <Trash2 className="w-6 h-6 text-danger" />
              </div>
              <h3 className="text-lg font-semibold text-fg">Delete Character?</h3>
            </div>
            <p className="text-fg-muted mb-6">
              Are you sure you want to delete{' '}
              <span className="font-medium text-fg">{deleteConfirm.name}</span>? This action
              cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onDeleteCancel}
                className="px-4 py-2 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDeleteConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-danger hover:opacity-90 rounded-lg transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {copyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-border animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-accent-soft rounded-full">
                <Copy className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-fg">Copy Character?</h3>
            </div>
            <p className="text-fg-muted mb-6">
              Create a copy of{' '}
              <span className="font-medium text-fg">{copyConfirm.name}</span>?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onCopyCancel}
                className="px-4 py-2 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onCopyConfirm}
                className="px-4 py-2 text-sm font-medium bg-accent text-accent-fg hover:opacity-90 rounded-lg transition-opacity"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {backupConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-md w-full p-6 border border-border animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-accent-soft rounded-full">
                <Download className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-fg">Backup Vault?</h3>
            </div>
            <p className="text-fg-muted mb-2">
              Download a ZIP of every character and standalone lorebook in your vault.
            </p>
            <p className="text-sm text-fg-subtle mb-6">
              Cards with images export as PNG; cards without export as JSON. Lorebooks export
              as SillyTavern JSON in a lorebooks folder. This may take a moment for large vaults.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onBackupCancel}
                disabled={isExportingVault}
                className="px-4 py-2.5 sm:py-2 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors disabled:opacity-50 touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onBackupConfirm}
                disabled={isExportingVault}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 text-sm font-medium bg-accent text-accent-fg hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50 touch-manipulation"
              >
                {isExportingVault ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Preparing…
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download ZIP
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
