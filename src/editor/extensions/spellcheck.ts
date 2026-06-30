/**
 * @fileoverview Barrel export for the spellcheck CodeMirror extension.
 * @module editor/extensions/spellcheck
 */

export {
  spellcheckExtension,
  setSpellcheckSettings,
  bindSpellcheckCallbacks,
  tokenize,
  DEFAULT_TOKENIZER_OPTIONS,
} from '../spellcheck/spellcheckExtension';

export type {
  SpellcheckExtensionOptions,
  SpellcheckCallbacks,
} from '../spellcheck/spellcheckExtension';

export type { SpellcheckSettings } from '../../db/characterTypes';
