/**
 * @fileoverview Hook to access the editor context.
 * @module context/useEditorContext
 */

import { useContext } from 'react';
import { EditorContext } from './editorContextTypes';
import type { EditorContextValue } from './editorContextTypes';

/**
 * Hook to access the editor context
 * @returns Editor context value
 * @throws Error if used outside of EditorProvider
 */
export function useEditorContext(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditorContext must be used within an EditorProvider');
  }
  return context;
}

export default useEditorContext;
