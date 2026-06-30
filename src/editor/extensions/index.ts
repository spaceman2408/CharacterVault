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
  ToolbarActionConfig,
} from './aiToolbarPanel';

export {
  normalizeHtmlEntities,
  normalizeHtmlEntitiesInView,
} from './normalizeHtmlEntities';

export {
  creatorNotesExtensions,
} from './htmlHighlight';

export {
  characterMacroHelper,
} from './characterMacroHelper';

export {
  spellcheckExtension,
  setSpellcheckSettings,
  bindSpellcheckCallbacks,
  tokenize,
  DEFAULT_TOKENIZER_OPTIONS,
} from './spellcheck';

export type {
  SpellcheckExtensionOptions,
  SpellcheckCallbacks,
} from './spellcheck';
