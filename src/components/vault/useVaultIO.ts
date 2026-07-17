import { useCallback, useEffect, useRef, useState } from 'react';
import { characterImportService } from '../../services/CharacterImportService';
import { characterExportService } from '../../services/CharacterExportService';
import { characterDb } from '../../db/CharacterDatabase';
import type { CardExportFormat } from './types';
import { downloadBlob } from './utils';

interface UseVaultIOOptions {
  characterCount: number;
  refreshCharacters: () => Promise<void>;
}

export function useVaultIO({ characterCount, refreshCharacters }: UseVaultIOOptions) {
  const [isImporting, setIsImporting] = useState(false);
  const [isExportingVault, setIsExportingVault] = useState(false);
  const [exportingCardId, setExportingCardId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [backupConfirmOpen, setBackupConfirmOpen] = useState(false);
  const dragDepthRef = useRef(0);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter(
        (f) =>
          f.type === 'application/json' ||
          f.name.toLowerCase().endsWith('.json') ||
          f.type === 'image/png' ||
          f.name.toLowerCase().endsWith('.png')
      );

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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    await importFiles(files);
    e.target.value = '';
  };

  const handleBackupClick = () => {
    if (characterCount === 0 || isExportingVault) return;
    setBackupConfirmOpen(true);
  };

  const handleBackupCancel = () => {
    if (isExportingVault) return;
    setBackupConfirmOpen(false);
  };

  const handleExportVault = async () => {
    if (characterCount === 0 || isExportingVault) return;
    setIsExportingVault(true);
    try {
      // Stream full cards one-by-one from IndexedDB — never materialize the whole vault
      const result = await characterExportService.exportVaultAsZip(
        characterDb.iterateAllCharacters()
      );
      if (result.success && result.blob && result.filename) {
        downloadBlob(result.blob, result.filename);
        showStatus(
          result.error
            ? `Backup downloaded. ${result.error}`
            : `Vault backup downloaded (${characterCount} cards).`,
          6000
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
    return Array.from(items).some(
      (item) =>
        item.kind === 'file' &&
        (item.type === 'application/json' ||
          item.type === 'image/png' ||
          item.type === '' ||
          item.type.startsWith('image/'))
    );
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
    backupConfirmOpen,
    showStatus,
    handleImport,
    handleBackupClick,
    handleBackupCancel,
    handleExportVault,
    handleCardExport,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    openFilePicker: () => fileInputRef.current?.click(),
  };
}
