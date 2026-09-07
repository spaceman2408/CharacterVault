import { AlertCircle, Copy, Download, Loader2, Trash2, Upload, X } from 'lucide-react';
import { IconButton } from './IconButton';
import type { ConfirmTarget } from './types';
import type {
  RestorePreview,
  RestoreResult,
} from '../../services/VaultRestoreService';

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
  includeBackupKeys: boolean;
  onIncludeBackupKeysChange: (include: boolean) => void;
  restorePreview: RestorePreview | null;
  isRestoring: boolean;
  restoreProgress: { done: number; total: number } | null;
  restoreResult: RestoreResult | null;
  onRestoreConfirm: () => void;
  onRestoreCancel: () => void;
  onRestoreDismiss: () => void;
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
  includeBackupKeys,
  onIncludeBackupKeysChange,
  restorePreview,
  isRestoring,
  restoreProgress,
  restoreResult,
  onRestoreConfirm,
  onRestoreCancel,
  onRestoreDismiss,
  createPlaceholder = 'Character name...',
}: VaultModalsProps): React.ReactElement {
  const restoredAt =
    restorePreview?.exportedAt && !Number.isNaN(Date.parse(restorePreview.exportedAt))
      ? new Date(restorePreview.exportedAt).toLocaleString()
      : null;
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
              Download a ZIP of every character, standalone lorebook, and your settings.
            </p>
            <p className="text-sm text-fg-subtle mb-4">
              Cards with images export as PNG; cards without export as JSON. Lorebooks export
              as SillyTavern JSON. This may take a moment for large vaults.
            </p>
            <label className="flex items-start gap-3 text-sm text-fg-muted cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={includeBackupKeys}
                disabled={isExportingVault}
                onChange={(e) => onIncludeBackupKeysChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
              />
              <span>
                <span className="font-medium text-fg">Include API keys</span>
                <span className="block text-xs mt-0.5">
                  Off by default. Only turn on to move your own setup between browsers.
                </span>
              </span>
            </label>
            {includeBackupKeys && (
              <div
                role="alert"
                className="mb-4 flex gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-warning-soft-fg"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  <span className="font-semibold">This file will contain live API keys.</span>{' '}
                  Anyone with it can spend your AI quota. Store it somewhere private and never
                  share it publicly.
                </p>
              </div>
            )}
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

      {(restorePreview || restoreResult) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-md w-full p-6 border border-border animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-accent-soft rounded-full">
                <Upload className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-fg">
                {restoreResult ? 'Restore Finished' : 'Restore Backup?'}
              </h3>
            </div>

            {restorePreview && !restoreResult && !isRestoring && (
              <>
                <ul className="text-fg-muted mb-2 space-y-1">
                  <li>
                    {restorePreview.characterPaths.length} card
                    {restorePreview.characterPaths.length === 1 ? '' : 's'}
                    {', '}
                    {restorePreview.lorebookPaths.length} lorebook
                    {restorePreview.lorebookPaths.length === 1 ? '' : 's'}
                  </li>
                  {restorePreview.settings && (
                    <li>
                      Settings from {restoredAt ?? 'unknown date'}
                      {restorePreview.includeKeys ? ' (contains API keys)' : ' (no API keys)'}
                    </li>
                  )}
                  {!restorePreview.settings && (
                    <li>No settings in this backup. Cards and lorebooks only.</li>
                  )}
                </ul>
                {restorePreview.mode === 'legacy' && (
                  <p className="text-xs text-fg-subtle mb-2">
                    This looks like an older cards-only backup. It will restore as content only.
                  </p>
                )}
                {restorePreview.settingsError && (
                  <p className="text-xs text-danger mb-2">
                    The settings entry could not be read ({restorePreview.settingsError}).
                    Content will still restore.
                  </p>
                )}
                {restorePreview.includeKeys && restorePreview.settings && (
                  <div
                    role="alert"
                    className="mb-2 flex gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-warning-soft-fg"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>
                      <span className="font-semibold">This backup contains live API keys.</span>{' '}
                      Restoring will replace the API keys on this device.
                    </p>
                  </div>
                )}
                <p className="text-sm text-fg-subtle mb-6">
                  Restore adds copies. Nothing already in your vault is changed or deleted.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={onRestoreCancel}
                    className="px-4 py-2.5 sm:py-2 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onRestoreConfirm}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 text-sm font-medium bg-accent text-accent-fg hover:opacity-90 rounded-lg transition-opacity touch-manipulation"
                  >
                    <Upload className="w-4 h-4" />
                    Restore
                  </button>
                </div>
              </>
            )}

            {isRestoring && (
              <div className="mb-2">
                <p className="text-fg-muted mb-3">
                  Restoring{restoreProgress ? ` ${restoreProgress.done} of ${restoreProgress.total}…` : '…'}
                </p>
                {restoreProgress && restoreProgress.total > 0 && (
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{
                        width: `${Math.min(100, (restoreProgress.done / restoreProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {restoreResult && (
              <>
                <ul className="text-fg-muted mb-2 space-y-1">
                  <li>
                    Imported {restoreResult.charactersImported} card
                    {restoreResult.charactersImported === 1 ? '' : 's'}
                    {', '}
                    {restoreResult.lorebooksImported} lorebook
                    {restoreResult.lorebooksImported === 1 ? '' : 's'}
                  </li>
                  {restoreResult.settingsApplied && <li>Settings applied.</li>}
                  {(restoreResult.charactersFailed > 0 || restoreResult.lorebooksFailed > 0) && (
                    <li className="text-danger">
                      {restoreResult.charactersFailed + restoreResult.lorebooksFailed} file
                      {restoreResult.charactersFailed + restoreResult.lorebooksFailed === 1 ? '' : 's'} failed.
                    </li>
                  )}
                </ul>
                {restoreResult.errors.slice(0, 5).map((entry) => (
                  <p key={entry.path} className="text-xs text-danger mb-1">
                    {entry.path}: {entry.error}
                  </p>
                ))}
                {restoreResult.errors.length > 5 && (
                  <p className="text-xs text-fg-subtle mb-2">
                    And {restoreResult.errors.length - 5} more.
                  </p>
                )}
                <div className="flex gap-3 justify-end mt-4">
                  <button
                    type="button"
                    onClick={onRestoreDismiss}
                    className="px-4 py-2.5 sm:py-2 text-sm font-medium bg-accent text-accent-fg hover:opacity-90 rounded-lg transition-opacity touch-manipulation"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
