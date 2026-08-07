/**
 * @fileoverview Barrel export for CodeMirror editor extensions.
 * @module editor/extensions
 */

export { themeSync, getCurrentTheme, refreshTheme, getThemeColor } from './themeSync';

export {
  createSyntaxHighlightStyle,
  resolveSyntaxColors,
  syntaxHighlightExtension,
} from './syntaxHighlight';


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
  aiGhostPreview,
  aiGhostPreviewField,
  setAIGhostPreview,
  updateAIGhostPreview,
  clearAIGhostPreview,
} from './aiGhostPreview';

export type { AIGhostPreviewData } from './aiGhostPreview';

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
  markdownImageLinks,
  setMarkdownImageOpenLinks,
} from './markdownImageLinks';

export type { MarkdownImageLinksOptions } from './markdownImageLinks';

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
