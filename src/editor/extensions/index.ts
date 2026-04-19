/**
 * @fileoverview Barrel export for CodeMirror editor extensions.
 * @module editor/extensions
 */

export { themeSync, getCurrentTheme, refreshTheme } from './themeSync';

export { 
  toolbarSearch, 
  toolbarSearchTheme,
  openToolbarSearch,
  closeToolbarSearch,
  toggleToolbarSearch,
} from './toolbarSearch';

export {
  fontSizeExtension,
  setFontSize,
  getFontSize,
  createFontSizeControl,
  fontSizeControlTheme,
} from './fontSizeControl';

export type {
  AIToolbarActionCallback,
  AIStreamingCallback,
  AIAbortCallback,
  FontSizeChangeCallback,
} from './aiToolbarPanel';
