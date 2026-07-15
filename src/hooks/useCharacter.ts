/**
 * @fileoverview Hook for managing character state and operations.
 * @module @hooks/useCharacter
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { characterDb, toCharacterListItem } from '../db/CharacterDatabase';
import { characterSnapshotService } from '../services/CharacterSnapshotService';
import type {
  Character,
  CreateCharacterInput,
  UpdateCharacterInput,
  CharacterVaultSettings,
  CharacterListItem,
} from '../db/characterTypes';

const IMPORTED_CHARACTER_FLAG = 'character_vault_imported';

/**
 * Result type for character operations
 */
interface CharacterResult {
  characters: Character[];
  characterListItems: CharacterListItem[];
  currentCharacter: Character | null;
  isLoading: boolean;
  error: Error | null;
  settings: CharacterVaultSettings | null;
}

/**
 * Operations type for character actions
 */
interface CharacterOperations {
  createCharacter: (input: CreateCharacterInput) => Promise<Character>;
  openCharacter: (characterId: string) => Promise<void>;
  closeCharacter: () => void;
  deleteCharacter: (characterId: string) => Promise<void>;
  updateCharacter: (characterId: string, input: UpdateCharacterInput) => Promise<Character>;
  duplicateCharacter: (characterId: string, newName: string) => Promise<Character>;
  refreshCharacters: () => Promise<void>;
  updateSpecField: (characterId: string, field: keyof Character['data']['spec'], value: string | string[]) => Promise<Character>;
  updateSettings: (updates: Partial<Omit<CharacterVaultSettings, 'id'>>) => Promise<void>;
}

/**
 * Hook for managing character state and operations
 * @returns {[CharacterResult, CharacterOperations]} Character state and operations
 */
export function useCharacter(): [CharacterResult, CharacterOperations] {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterListItems, setCharacterListItems] = useState<CharacterListItem[]>([]);
  const [currentCharacterId, setCurrentCharacterId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [settings, setSettings] = useState<CharacterVaultSettings | null>(null);
  const specUpdateSequenceRef = useRef<Map<string, number>>(new Map());
  const currentCharacter = useMemo(
    () => characters.find(character => character.id === currentCharacterId) ?? null,
    [characters, currentCharacterId],
  );

  /**
   * Load list items and settings on mount
   * Full Character objects are loaded only when needed
   */
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [items, prefs] = await Promise.all([
          characterDb.getAllCharacterListItems(),
          characterDb.getSettings(),
        ]);
        setCharacterListItems(items);
        setSettings(prefs);
        // Don't restore last active character - always start at character selection
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load characters'));
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  /**
   * Refresh characters list (list items only)
   */
  const refreshCharacters = useCallback(async () => {
    try {
      const items = await characterDb.getAllCharacterListItems();
      setCharacterListItems(items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh characters'));
    }
  }, []);

  /**
   * Create a new character
   */
  const createCharacter = useCallback(async (input: CreateCharacterInput): Promise<Character> => {
    const character = await characterDb.createCharacter(input);
    // Only keep the open card in memory — never stack full characters
    setCharacters([character]);
    setCharacterListItems((prev) => [toCharacterListItem(character), ...prev]);
    setCurrentCharacterId(character.id);

    // Update last active character in settings
    if (settings) {
      await characterDb.updateSettings({ lastActiveCharacterId: character.id });
      setSettings({ ...settings, lastActiveCharacterId: character.id });
    }

    return character;
  }, [settings]);

  /**
   * Open a character for editing
   */
  const openCharacter = useCallback(async (characterId: string): Promise<void> => {
    try {
      const character = await characterDb.getCharacter(characterId);
      if (character) {
        // Replace — do not accumulate every previously opened card in heap
        setCharacters([character]);

        await characterDb.updateLastOpened(characterId);
        if (character.data.extensions?.[IMPORTED_CHARACTER_FLAG] === true) {
          await characterSnapshotService.createSnapshot(character, 'open').catch(error => {
            console.error('Failed to create baseline snapshot:', error);
          });
        }
        setCurrentCharacterId(characterId);

        // Update last active character in settings
        if (settings) {
          await characterDb.updateSettings({ lastActiveCharacterId: characterId });
          setSettings({ ...settings, lastActiveCharacterId: characterId });
        }

        // Refresh vault index only (lightweight rows — not full cards)
        await refreshCharacters();
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to open character'));
    }
  }, [settings, refreshCharacters]);

  /**
   * Close the current character
   */
  const closeCharacter = useCallback(() => {
    setCurrentCharacterId(null);
    // Drop full card payload (image + lorebook) when returning to the vault
    setCharacters([]);
    if (settings) {
      characterDb.updateSettings({ lastActiveCharacterId: undefined });
      setSettings({ ...settings, lastActiveCharacterId: undefined });
    }
  }, [settings]);

  /**
   * Delete a character
   */
  const deleteCharacter = useCallback(async (characterId: string): Promise<void> => {
    try {
      await characterDb.deleteCharacter(characterId);
      setCharacters((prev) => prev.filter((c) => c.id !== characterId));
      setCharacterListItems((prev) => prev.filter((c) => c.id !== characterId));

      if (currentCharacterId === characterId) {
        setCurrentCharacterId(null);
        setCharacters([]);
        if (settings) {
          await characterDb.updateSettings({ lastActiveCharacterId: undefined });
          setSettings({ ...settings, lastActiveCharacterId: undefined });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete character'));
      throw err;
    }
  }, [currentCharacterId, settings]);

  /**
   * Update a character
   */
  const updateCharacter = useCallback(async (
    characterId: string,
    input: UpdateCharacterInput
  ): Promise<Character> => {
    try {
      const updated = await characterDb.updateCharacter(characterId, input);
      setCharacters((prev) =>
        prev.map((c) => (c.id === characterId ? updated : c))
      );
      setCharacterListItems((prev) =>
        prev.map((c) => (c.id === characterId ? toCharacterListItem(updated) : c))
      );
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update character'));
      throw err;
    }
  }, []);

  /**
   * Update a specific spec field
   */
  const updateSpecField = useCallback(async (
    characterId: string,
    field: keyof Character['data']['spec'],
    value: string | string[]
  ): Promise<Character> => {
    const sequenceKey = `${characterId}:${String(field)}`;
    const nextSequence = (specUpdateSequenceRef.current.get(sequenceKey) ?? 0) + 1;
    specUpdateSequenceRef.current.set(sequenceKey, nextSequence);

    try {
      const updated = await characterDb.updateSpecField(characterId, field, value);
      if (specUpdateSequenceRef.current.get(sequenceKey) !== nextSequence) {
        return updated;
      }

      setCharacters((prev) =>
        prev.map((c) => (c.id === characterId ? updated : c))
      );
      setCharacterListItems((prev) =>
        prev.map((c) => (c.id === characterId ? toCharacterListItem(updated) : c))
      );
      return updated;
    } catch (err) {
      if (specUpdateSequenceRef.current.get(sequenceKey) !== nextSequence) {
        throw err;
      }
      setError(err instanceof Error ? err : new Error('Failed to update spec field'));
      throw err;
    }
  }, []);

  /**
   * Duplicate a character
   */
  const duplicateCharacter = useCallback(async (
    characterId: string,
    newName: string
  ): Promise<Character> => {
    try {
      const duplicated = await characterDb.duplicateCharacter(characterId, newName);
      // List only — do not pin the full duplicate in memory until the user opens it
      setCharacterListItems((prev) => [toCharacterListItem(duplicated), ...prev]);
      return duplicated;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to duplicate character'));
      throw err;
    }
  }, []);

  /**
   * Update settings
   */
  const updateSettings = useCallback(async (
    updates: Partial<Omit<CharacterVaultSettings, 'id'>>
  ): Promise<void> => {
    try {
      const updated = await characterDb.updateSettings(updates);
      setSettings(updated);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update settings'));
      throw err;
    }
  }, []);

  const result: CharacterResult = {
    characters,
    characterListItems,
    currentCharacter,
    isLoading,
    error,
    settings,
  };

  const operations: CharacterOperations = {
    createCharacter,
    openCharacter,
    closeCharacter,
    deleteCharacter,
    updateCharacter,
    duplicateCharacter,
    refreshCharacters,
    updateSpecField,
    updateSettings,
  };

  return [result, operations];
}
