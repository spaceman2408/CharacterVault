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
