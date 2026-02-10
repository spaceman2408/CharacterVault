/**
 * @fileoverview Hook for accessing the character context.
 * @module @context/useCharacterContext
 */

import { useContext } from 'react';
import { CharacterContext } from './CharacterContext';

/**
 * Hook for accessing the character context.
 * Must be used within a CharacterProvider.
 * @returns {NonNullable<typeof CharacterContext>} Character context value
 * @throws {Error} If used outside of CharacterProvider
 */
export function useCharacterContext() {
  const context = useContext(CharacterContext);
  if (!context) {
    throw new Error('useCharacterContext must be used within a CharacterProvider');
  }
  return context;
}
