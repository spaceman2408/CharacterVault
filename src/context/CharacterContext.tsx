/**
 * @fileoverview Global character state context provider.
 * @module @context/CharacterContext
 */

import React, { createContext, type ReactNode } from 'react';
import { useCharacter } from '../hooks/useCharacter';
import type {
  Character,
  CreateCharacterInput,
  UpdateCharacterInput,
  CharacterVaultSettings,
} from '../db/characterTypes';

/**
 * Context value type
 */
interface CharacterContextValue {
  // Current character state
  currentCharacter: Character | null;
  isCharacterOpen: boolean;

  // Character operations
  createCharacter: (input: CreateCharacterInput) => Promise<Character>;
  openCharacter: (characterId: string) => Promise<void>;
  closeCharacter: () => void;
  deleteCharacter: (characterId: string) => Promise<void>;
  updateCharacter: (characterId: string, input: UpdateCharacterInput) => Promise<Character>;
  duplicateCharacter: (characterId: string, newName: string) => Promise<Character>;
  updateSpecField: (characterId: string, field: keyof Character['data']['spec'], value: string | string[]) => Promise<Character>;

  // Character list
  characters: Character[];
  refreshCharacters: () => Promise<void>;

  // Settings
  settings: CharacterVaultSettings | null;
  updateSettings: (updates: Partial<Omit<CharacterVaultSettings, 'id'>>) => Promise<void>;

  // Loading state
  isLoading: boolean;
  error: Error | null;
}

/**
 * Character context
 */
const CharacterContext = createContext<CharacterContextValue | null>(null);

/**
 * Props for CharacterProvider
 */
interface CharacterProviderProps {
  children: ReactNode;
}

/**
 * Character context provider component.
 * Wraps the application to provide global character state.
 * @param {CharacterProviderProps} props - Component props
 * @returns {React.ReactElement} Provider component
 */
export function CharacterProvider({ children }: CharacterProviderProps): React.ReactElement {
  const [result, operations] = useCharacter();

  const value: CharacterContextValue = {
    currentCharacter: result.currentCharacter,
    isCharacterOpen: result.currentCharacter !== null,
    createCharacter: operations.createCharacter,
    openCharacter: operations.openCharacter,
    closeCharacter: operations.closeCharacter,
    deleteCharacter: operations.deleteCharacter,
    updateCharacter: operations.updateCharacter,
    duplicateCharacter: operations.duplicateCharacter,
    updateSpecField: operations.updateSpecField,
    characters: result.characters,
    refreshCharacters: operations.refreshCharacters,
    settings: result.settings,
    updateSettings: operations.updateSettings,
    isLoading: result.isLoading,
    error: result.error,
  };

  return (
    <CharacterContext.Provider value={value}>
      {children}
    </CharacterContext.Provider>
  );
}

// Export the context for the hook
export { CharacterContext };
