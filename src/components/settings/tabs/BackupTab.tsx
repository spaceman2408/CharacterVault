import React, { useRef, useState } from 'react';
import { AlertCircle, Check, Download, Loader2, Upload } from 'lucide-react';
import { characterSettingsService } from '../../../services/CharacterSettingsService';
import {
  applyBackupToDraft,
  buildBackupFilename,
  buildSettingsBackup,
  downloadSettingsBackup,
  parseSettingsBackup,
} from '../../../services/SettingsBackupService';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsToggle } from '../components/SettingsToggle';
import type { SettingsTabProps } from '../types';

export const BackupTab: React.FC<SettingsTabProps> = ({ setDraft, addToast }) => {
  const [includeKeys, setIncludeKeys] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const saved = await characterSettingsService.getSettings();
      const file = buildSettingsBackup(saved, includeKeys);
      downloadSettingsBackup(file, buildBackupFilename());
      addToast?.(
        'success',
        includeKeys
          ? 'Settings exported with API keys. Store the file somewhere private.'
          : 'Settings exported without API keys.'
      );
    } catch {
      addToast?.('error', 'Failed to export settings');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFile = async (file: File) => {
    setIsImporting(true);
    setImportError(null);
    setImportNotice(null);
    try {
      const backup = parseSettingsBackup(JSON.parse(await file.text()));
      setDraft((prev) => applyBackupToDraft(prev, backup));
      const when = Number.isNaN(Date.parse(backup.exportedAt))
        ? 'unknown date'
        : new Date(backup.exportedAt).toLocaleString();
      setImportNotice(
        `Loaded backup from ${when}${backup.includeKeys ? ' (contains API keys)' : ' (no API keys)'}. Review the tabs, then Save Settings to apply.`
      );
      addToast?.('success', 'Backup loaded into the draft. Save to apply.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not read that backup file.';
      setImportError(message);
      addToast?.('error', message);
    } finally {
      setIsImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <SettingsCard>
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-2 flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export settings
        </h3>
        <p className="text-xs text-fg-muted mb-4 leading-relaxed">
          Downloads AI config, sampler, prompts, studio, workspace, and layout preferences as a
          JSON file. Export uses your saved settings. Save first if you changed anything.
        </p>
        <SettingsToggle
          stacked
          checked={includeKeys}
          onChange={setIncludeKeys}
          label="Include API keys"
          description="Off by default. Only turn on to move your own setup between browsers."
        />
        {includeKeys && (
          <div
            role="alert"
            className="mt-3 flex gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-warning-soft-fg"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              <span className="font-semibold">This file will contain live API keys.</span>{' '}
              Anyone with it can spend your AI quota. Store it somewhere private and never share
              it publicly.
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={isExporting}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {includeKeys ? 'Export with API keys' : 'Export settings'}
        </button>
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-2 flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Import settings
        </h3>
        <p className="text-xs text-fg-muted mb-4 leading-relaxed">
          Loads a backup into the editing draft without overwriting anything yet. A backup
          without keys keeps your current keys; review everything, then Save Settings.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label="Choose a settings backup file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isImporting}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isImporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Choose backup file
        </button>
        {importNotice && (
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-success">
            <Check className="h-4 w-4 shrink-0" />
            {importNotice}
          </p>
        )}
        {importError && (
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {importError}
          </p>
        )}
      </SettingsCard>
    </div>
  );
};
