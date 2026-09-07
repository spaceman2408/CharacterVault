import { useCallback, useEffect, useRef, useState } from 'react';
import { characterImportService } from '../../services/CharacterImportService';
import { characterExportService } from '../../services/CharacterExportService';
import { characterSettingsService } from '../../services/CharacterSettingsService';
import { buildSettingsBackup } from '../../services/SettingsBackupService';
import {
  vaultRestoreService,
  type LoadedRestore,
  type RestoreResult,
} from '../../services/VaultRestoreService';
import { getFavoriteTags } from '../../pages/ai-creation-studio/tags/tagData';
import { characterDb } from '../../db/CharacterDatabase';
import type { CardExportFormat, VaultTab } from './types';
import { downloadBlob } from './utils';

interface UseVaultIOOptions {
  characterCount: number;
  lorebookCount: number;
  vaultTab: VaultTab;
  refreshCharacters: () => Promise<void>;
  refreshLorebooks: () => Promise<void>;
  importLorebookFile: (file: File) => Promise<unknown>;
}

function isZipFile(file: File): boolean {
  return (
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed' ||
    file.name.toLowerCase().endsWith('.zip')
  );
}

function isJsonFile(file: File): boolean {
  return file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
}

function isCharacterImportFile(file: File): boolean {
  return (
    isJsonFile(file) ||
    file.type === 'image/png' ||
    file.name.toLowerCase().endsWith('.png')
  );
}

export function useVaultIO({
  characterCount,
  lorebookCount,
  vaultTab,
  refreshCharacters,
  refreshLorebooks,
  importLorebookFile,
}: UseVaultIOOptions) {
  const [isImporting, setIsImporting] = useState(false);
  const [isExportingVault, setIsExportingVault] = useState(false);
  const [exportingCardId, setExportingCardId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [backupConfirmOpen, setBackupConfirmOpen] = useState(false);
  const [includeBackupKeys, setIncludeBackupKeys] = useState(false);
  const [restoreLoaded, setRestoreLoaded] = useState<LoadedRestore | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ done: number; total: number } | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const dragDepthRef = useRef(0);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const vaultTabRef = useRef(vaultTab);
  vaultTabRef.current = vaultTab;

  const showStatus = useCallback((message: string, durationMs = 5000) => {
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    setStatusMessage(message);
    statusTimeoutRef.current = setTimeout(() => setStatusMessage(null), durationMs);
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  const importCharacterFiles = useCallback(
    async (files: File[]) => {
      const fileArray = files.filter(isCharacterImportFile);
      if (fileArray.length === 0) {
        showStatus('No PNG or JSON character files found.');
        return;
      }

      setIsImporting(true);
      try {
        const result = await characterImportService.importFromFiles(fileArray);
        await refreshCharacters();

        if (result.successCount === 0) {
          const firstError = result.errors[0];
          showStatus(
            firstError
              ? `Import failed: ${firstError.filename} — ${firstError.error}`
              : 'Import failed.',
            7000
          );
        } else if (result.failCount > 0) {
          showStatus(
            `Imported ${result.successCount} of ${fileArray.length}. ${result.failCount} failed.`,
            7000
          );
        } else {
          showStatus(
            result.successCount === 1
              ? `Imported “${result.firstImportedName ?? 'character'}”.`
              : `Imported ${result.successCount} characters.`
          );
        }
      } catch {
        showStatus('Import failed.');
      } finally {
        setIsImporting(false);
      }
    },
    [refreshCharacters, showStatus]
  );

  const importLorebookFiles = useCallback(
    async (files: File[]) => {
      const fileArray = files.filter(isJsonFile);
      if (fileArray.length === 0) {
        showStatus('No JSON lorebook files found.');
        return;
      }

      setIsImporting(true);
      let successCount = 0;
      const errors: string[] = [];
      try {
        for (const file of fileArray) {
          try {
            await importLorebookFile(file);
            successCount += 1;
          } catch (err) {
            errors.push(
              `${file.name} — ${err instanceof Error ? err.message : 'Import failed'}`,
            );
          }
        }

        if (successCount === 0) {
          showStatus(
            errors[0] ? `Import failed: ${errors[0]}` : 'Import failed.',
            7000,
          );
        } else if (errors.length > 0) {
          showStatus(
            `Imported ${successCount} of ${fileArray.length}. ${errors.length} failed.`,
            7000,
          );
        } else {
          showStatus(
            successCount === 1
              ? `Imported “${fileArray[0].name.replace(/\.json$/i, '')}”.`
              : `Imported ${successCount} lorebooks.`,
          );
        }
      } catch {
        showStatus('Import failed.');
      } finally {
        setIsImporting(false);
      }
    },
    [importLorebookFile, showStatus]
  );

  const openRestore = useCallback(
    async (file: File) => {
      setIsImporting(true);
      try {
        const loaded = await vaultRestoreService.loadPreview(file);
        setRestoreResult(null);
        setRestoreProgress(null);
        setRestoreLoaded(loaded);
      } catch (err) {
        showStatus(err instanceof Error ? err.message : 'Could not read that backup file.', 7000);
      } finally {
        setIsImporting(false);
      }
    },
    [showStatus]
  );

  const cancelRestore = useCallback(() => {
    if (isRestoring) return;
    setRestoreLoaded(null);
    setRestoreProgress(null);
  }, [isRestoring]);

  const dismissRestoreResult = useCallback(() => {
    setRestoreResult(null);
    setRestoreLoaded(null);
    setRestoreProgress(null);
  }, []);

  const confirmRestore = useCallback(async () => {
    if (!restoreLoaded || isRestoring) return;
    setIsRestoring(true);
    setRestoreProgress({ done: 0, total: 1 });
    try {
      const result = await vaultRestoreService.restore(restoreLoaded, (done, total) =>
        setRestoreProgress({ done, total })
      );
      await refreshCharacters();
      await refreshLorebooks();
      setRestoreLoaded(null);
      setRestoreProgress(null);
      setRestoreResult(result);
    } catch {
      showStatus('Restore failed.', 7000);
      setRestoreLoaded(null);
      setRestoreProgress(null);
    } finally {
      setIsRestoring(false);
    }
  }, [restoreLoaded, isRestoring, refreshCharacters, refreshLorebooks, showStatus]);

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      const zip = list.find(isZipFile);
      if (zip) {
        await openRestore(zip);
        return;
      }
      if (vaultTabRef.current === 'lorebooks') {
        await importLorebookFiles(list);
        return;
      }
      await importCharacterFiles(list);
    },
    [importCharacterFiles, importLorebookFiles, openRestore]
  );

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    await importFiles(files);
    e.target.value = '';
  };

  const canBackup = true;

  const handleBackupClick = () => {
    if (isExportingVault) return;
    setBackupConfirmOpen(true);
  };

  const handleBackupCancel = () => {
    if (isExportingVault) return;
    setBackupConfirmOpen(false);
  };

  const handleExportVault = async () => {
    if (isExportingVault) return;
    setIsExportingVault(true);
    try {
      const saved = await characterSettingsService.getSettings();
      const settings = buildSettingsBackup(saved, includeBackupKeys, getFavoriteTags());
      const result = await characterExportService.exportFullVaultAsZip(
        characterDb.iterateAllCharacters(),
        characterDb.iterateAllLorebooks(),
        settings,
      );
      if (result.success && result.blob && result.filename) {
        downloadBlob(result.blob, result.filename);
        const parts: string[] = [];
        if (characterCount > 0) {
          parts.push(`${characterCount} card${characterCount === 1 ? '' : 's'}`);
        }
        if (lorebookCount > 0) {
          parts.push(`${lorebookCount} lorebook${lorebookCount === 1 ? '' : 's'}`);
        }
        parts.push('settings');
        showStatus(
          result.error
            ? `Backup downloaded. ${result.error}`
            : `Full backup downloaded (${parts.join(', ')})${includeBackupKeys ? '. It includes API keys, so store it somewhere private.' : '.'}`,
          7000
        );
        setBackupConfirmOpen(false);
      } else {
        showStatus(result.error || 'Failed to export vault backup.', 7000);
      }
    } catch {
      showStatus('Failed to export vault backup.');
    } finally {
      setIsExportingVault(false);
    }
  };

  const handleCardExport = useCallback(
    async (id: string, format: CardExportFormat) => {
      if (exportingCardId) return;
      setExportingCardId(id);
      try {
        const character = await characterDb.getCharacter(id);
        if (!character) {
          showStatus('Character not found.');
          return;
        }

        const result =
          format === 'png'
            ? await characterExportService.exportAsPNG(character)
            : await characterExportService.exportAsJSON(character);

        if (result.success && result.blob && result.filename) {
          downloadBlob(result.blob, result.filename);
          showStatus(
            format === 'png'
              ? `Exported “${character.name}” as PNG.`
              : `Exported “${character.name}” as JSON.`
          );
        } else {
          showStatus(
            result.error ||
              (format === 'png'
                ? 'PNG export failed. Add an image or export as JSON.'
                : 'Export failed.'),
            7000
          );
        }
      } catch {
        showStatus('Export failed.');
      } finally {
        setExportingCardId(null);
      }
    },
    [exportingCardId, showStatus]
  );

  const isImportableDrag = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return false;
    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return true;
    return Array.from(items).some((item) => {
      if (item.kind !== 'file') return false;
      if (
        item.type === 'application/zip' ||
        item.type === 'application/x-zip-compressed' ||
        item.type === ''
      ) {
        return true;
      }
      if (vaultTabRef.current === 'lorebooks') {
        return item.type === 'application/json';
      }
      return (
        item.type === 'application/json' ||
        item.type === 'image/png' ||
        item.type.startsWith('image/')
      );
    });
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!isImportableDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isImportableDrag(e) && dragDepthRef.current === 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isImportableDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    if (isImporting) return;
    const files = e.dataTransfer.files;
    if (files?.length) {
      await importFiles(files);
    }
  };

  return {
    fileInputRef,
    isImporting,
    isExportingVault,
    exportingCardId,
    isDragOver,
    statusMessage,
    setStatusMessage,
    canBackup,
    backupConfirmOpen,
    includeBackupKeys,
    setIncludeBackupKeys,
    restoreLoaded,
    isRestoring,
    restoreProgress,
    restoreResult,
    showStatus,
    handleImport,
    handleBackupClick,
    handleBackupCancel,
    handleExportVault,
    confirmRestore,
    cancelRestore,
    dismissRestoreResult,
    handleCardExport,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    openFilePicker: () => fileInputRef.current?.click(),
  };
}
