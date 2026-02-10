/**
 * @fileoverview Hook for managing character state and operations.
 * @module @hooks/useCharacter
 */

import { useState, useEffect, useCallback } from 'react';
import { characterDb } from '../db/CharacterDatabase';
import type {
  Character,
  CreateCharacterInput,
  UpdateCharacterInput,
  CharacterVaultSettings,
} from '../db/characterTypes';

/**
 * Result type for character operations
 */
interface CharacterResult {
  characters: Character[];
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
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [settings, setSettings] = useState<CharacterVaultSettings | null>(null);

  /**
   * Load all characters and settings on mount
   */
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [chars, prefs] = await Promise.all([
          characterDb.getAllCharacters(),
          characterDb.getSettings(),
        ]);
        setCharacters(chars);
        setSettings(prefs);

        // Restore last active character if available
        if (prefs.lastActiveCharacterId) {
          const lastChar = chars.find(c => c.id === prefs.lastActiveCharacterId);
          if (lastChar) {
            setCurrentCharacter(lastChar);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load characters'));
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  /**
   * Refresh characters list
   */
  const refreshCharacters = useCallback(async () => {
    try {
      const chars = await characterDb.getAllCharacters();
      setCharacters(chars);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh characters'));
    }
  }, []);

  /**
   * Create a new character
   */
  const createCharacter = useCallback(async (input: CreateCharacterInput): Promise<Character> => {
    const character = await characterDb.createCharacter(input);
    setCharacters(prev => [character, ...prev]);
    setCurrentCharacter(character);

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
        await characterDb.updateLastOpened(characterId);
        setCurrentCharacter(character);

        // Update last active character in settings
        if (settings) {
          await characterDb.updateSettings({ lastActiveCharacterId: characterId });
          setSettings({ ...settings, lastActiveCharacterId: characterId });
        }

        // Refresh the list to update lastOpenedAt
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
    setCurrentCharacter(null);
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
      setCharacters(prev => prev.filter(c => c.id !== characterId));

      if (currentCharacter?.id === characterId) {
        setCurrentCharacter(null);
        if (settings) {
          await characterDb.updateSettings({ lastActiveCharacterId: undefined });
          setSettings({ ...settings, lastActiveCharacterId: undefined });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete character'));
      throw err;
    }
  }, [currentCharacter, settings]);

  /**
   * Update a character
   */
  const updateCharacter = useCallback(async (
    characterId: string,
    input: UpdateCharacterInput
  ): Promise<Character> => {
    try {
      const updated = await characterDb.updateCharacter(characterId, input);
      setCharacters(prev =>
        prev.map(c => (c.id === characterId ? updated : c))
      );
      if (currentCharacter?.id === characterId) {
        setCurrentCharacter(updated);
      }
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update character'));
      throw err;
    }
  }, [currentCharacter]);

  /**
   * Update a specific spec field
   */
  const updateSpecField = useCallback(async (
    characterId: string,
    field: keyof Character['data']['spec'],
    value: string | string[]
  ): Promise<Character> => {
    try {
      const updated = await characterDb.updateSpecField(characterId, field, value);
      setCharacters(prev =>
        prev.map(c => (c.id === characterId ? updated : c))
      );
      if (currentCharacter?.id === characterId) {
        setCurrentCharacter(updated);
      }
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update spec field'));
      throw err;
    }
  }, [currentCharacter]);

  /**
   * Duplicate a character
   */
  const duplicateCharacter = useCallback(async (
    characterId: string,
    newName: string
  ): Promise<Character> => {
    try {
      const duplicated = await characterDb.duplicateCharacter(characterId, newName);
      setCharacters(prev => [duplicated, ...prev]);
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
