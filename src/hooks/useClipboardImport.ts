/**
 * @fileoverview Hook for importing characters from clipboard (SillyTavern integration)
 * @module @hooks/useClipboardImport
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { characterImportService } from '../services/CharacterImportService';
import type { Character, CharacterCardV2, ClipboardValidationResult } from '../db/characterTypes';

export type ImportState =
  | 'idle'
  | 'reading'
  | 'clipboard-unavailable'
  | 'preview'
  | 'importing'
  | 'success'
  | 'error';

export interface UseClipboardImportReturn {
  // State
  importState: ImportState;
  errorMessage: string | null;
  previewData: CharacterCardV2 | null;
  avatarData: string | null;
  importedCharacter: Character | null;

  // Actions
  readClipboard: () => Promise<void>;
  parseManualInput: (text: string) => void;
  importCharacter: () => Promise<void>;
  reset: () => void;
  goToLibrary: () => void;
  openImportedCharacter: () => void;
}

/**
 * Validates parsed clipboard data and extracts character info
 */
function validateClipboardData(data: unknown): ClipboardValidationResult {
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Invalid data: expected an object' };
  }

  const d = data as Record<string, unknown>;

  // Check for SillyTavern payload wrapper
  if (d.source === 'st') {
    const characterData = d.character;
    const avatarData = typeof d.avatar === 'string' ? d.avatar : null;

    if (!characterData || typeof characterData !== 'object') {
      return { success: false, error: 'Invalid SillyTavern payload: missing character data' };
    }

    // Validate the inner character data
    const charResult = validateCharacterData(characterData);
    if (!charResult.success) {
      return charResult;
    }

    return {
      success: true,
      characterData: charResult.characterData,
      avatarData: avatarData || undefined,
    };
  }

  // Treat as raw character data
  return validateCharacterData(data);
}

/**
 * Validates character card data (V2 or V3)
 */
function validateCharacterData(data: unknown): ClipboardValidationResult {
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Invalid character data: expected an object' };
  }

  const d = data as Record<string, unknown>;

  // Check for V2 wrapped format (spec: "chara_card_v2", data: {...})
  if (d.spec === 'chara_card_v2' && d.data && typeof d.data === 'object') {
    const innerData = d.data as Record<string, unknown>;
    if (typeof innerData.name === 'string') {
      // Return the inner data for preview
      return {
        success: true,
        characterData: innerData as unknown as CharacterCardV2,
      };
    }
  }

  // Check for V3 format (has spec and data)
  if (d.spec === 'chara_card_v3' && d.data && typeof d.data === 'object') {
    const innerData = d.data as Record<string, unknown>;
    if (typeof innerData.name === 'string') {
      return {
        success: true,
        characterData: innerData as unknown as CharacterCardV2,
      };
    }
  }

  // Check for V2 format (flat structure with name field)
  if (typeof d.name === 'string') {
    return {
      success: true,
      characterData: d as unknown as CharacterCardV2,
    };
  }

  // Check for CharacterVault export format
  if (d.id && typeof d.name === 'string' && d.data) {
    return {
      success: true,
      characterData: d as unknown as CharacterCardV2,
    };
  }

  return {
    success: false,
    error: 'Unrecognized format. Expected Character Card V2, V3, or CharacterVault export.',
  };
}

/**
 * Hook for importing characters from clipboard
 */
export function useClipboardImport(): UseClipboardImportReturn {
  const [importState, setImportState] = useState<ImportState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<CharacterCardV2 | null>(null);
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [importedCharacter, setImportedCharacter] = useState<Character | null>(null);
  const autoReadAttempted = useRef(false);

  /**
   * Attempt to read from clipboard automatically
   */
  const readClipboard = useCallback(async () => {
    if (autoReadAttempted.current) return;
    autoReadAttempted.current = true;

    setImportState('reading');
    setErrorMessage(null);

    try {
      // Check if clipboard API is available
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        setImportState('clipboard-unavailable');
        setErrorMessage('Clipboard API not available in this browser');
        return;
      }

      // Attempt to read clipboard
      const text = await navigator.clipboard.readText();

      if (!text || text.trim().length === 0) {
        setImportState('clipboard-unavailable');
        setErrorMessage('Clipboard is empty');
        return;
      }

      parseManualInput(text);
    } catch (err) {
      // Permission denied or other clipboard errors
      setImportState('clipboard-unavailable');
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not read clipboard. Please paste manually.'
      );
    }
  }, []);

  /**
   * Parse manually pasted text
   */
  const parseManualInput = useCallback((text: string) => {
    setErrorMessage(null);

    try {
      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setImportState('error');
        setErrorMessage('Invalid JSON. Please paste valid character data.');
        return;
      }

      // Validate the data
      const validation = validateClipboardData(parsed);

      if (!validation.success) {
        setImportState('error');
        setErrorMessage(validation.error || 'Invalid character data');
        return;
      }

      // Store preview data
      setPreviewData(validation.characterData || null);
      setAvatarData(validation.avatarData || null);
      setImportState('preview');
    } catch (err) {
      setImportState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  /**
   * Import the character to the database
   */
  const importCharacter = useCallback(async () => {
    if (!previewData) return;

    setImportState('importing');
    setErrorMessage(null);

    try {
      const result = await characterImportService.importFromClipboardData(
        previewData,
        avatarData || ''
      );

      if (!result.success || !result.character) {
        setImportState('error');
        setErrorMessage(result.error || 'Failed to import character');
        return;
      }

      setImportedCharacter(result.character);
      setImportState('success');
    } catch (err) {
      setImportState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error during import');
    }
  }, [previewData, avatarData]);

  /**
   * Reset the import state
   */
  const reset = useCallback(() => {
    setImportState('idle');
    setErrorMessage(null);
    setPreviewData(null);
    setAvatarData(null);
    setImportedCharacter(null);
    autoReadAttempted.current = false;
  }, []);

  /**
   * Navigate to the library (home)
   */
  const goToLibrary = useCallback(() => {
    // Navigate to home using HashRouter format (/#/)
    // This works for both localhost and GitHub Pages
    window.location.href = `${import.meta.env.BASE_URL}#/`)`;
  }, []);

  /**
   * Open the imported character in the editor
   */
  const openImportedCharacter = useCallback(() => {
    if (importedCharacter) {
      // Navigate to home with query param for opening the character
      // Use BASE_URL for GitHub Pages compatibility
      window.location.href = `${import.meta.env.BASE_URL}#/?char=${importedCharacter.id}`;
    }
  }, [importedCharacter]);

  // Auto-read on mount (once)
  useEffect(() => {
    readClipboard();
  }, [readClipboard]);

  return {
    importState,
    errorMessage,
    previewData,
    avatarData,
    importedCharacter,
    readClipboard,
    parseManualInput,
    importCharacter,
    reset,
    goToLibrary,
    openImportedCharacter,
  };
}
