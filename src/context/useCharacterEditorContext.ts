/**
 * @fileoverview Hook for accessing the character editor context.
 * @module context/useCharacterEditorContext
 */

import { useContext } from 'react';
import { CharacterEditorContext } from './characterEditorContextTypes';
import type { CharacterEditorContextValue } from './characterEditorContextTypes';

/**
 * Hook for accessing the character editor context
 * @returns CharacterEditorContextValue
 * @throws Error if used outside of CharacterEditorProvider
 */
export function useCharacterEditorContext(): CharacterEditorContextValue {
  const context = useContext(CharacterEditorContext);
  
  if (!context) {
    throw new Error('useCharacterEditorContext must be used within a CharacterEditorProvider');
  }
  
  return context;
}
