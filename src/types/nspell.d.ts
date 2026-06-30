/**
 * @fileoverview Minimal ambient type declarations for the `nspell` module.
 *
 * `nspell` is a pure-JS Hunspell-compatible spellchecker that ships without
 * bundled type definitions. We only need the subset of its API used by the
 * spellcheck extension.
 *
 * @module types/nspell
 */

declare module 'nspell' {
  export interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string, model?: string): NSpell;
    remove(word: string): NSpell;
    dictionary(words: string): NSpell;
    personal(words: string): NSpell;
    spell(word: string): {
      correct: boolean;
      forbidden: boolean;
      warn: boolean;
    };
    wordCharacters(): string | undefined;
  }

  const nspell: {
    (aff: string, dic: string): NSpell;
  };
  export = nspell;
}
