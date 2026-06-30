/**
 * @fileoverview CodeMirror 6 spellcheck extension.
 *
 * Wires the {@link SpellcheckToken} tokenizer and the {@link loadSpellchecker}
 * dictionary loader into a CodeMirror extension that:
 *
 * - Underlines misspelled words with a wavy red marker.
 * - On hover or keyboard focus over a misspelled word, shows a tooltip with
 *   suggestions from nspell, plus "Ignore word" and "Add to dictionary".
 * - Honors the user's `ignoredWords` and `customWords` lists (passed in as
 *   options, refreshed via `Compartment.reconfigure`).
 * - Debounces re-tokenization and only re-spells the visible viewport.
 *
 * No-ops entirely when `enabled === false` (the dictionary is never loaded
 * and no decorations are added).
 *
 * @module editor/spellcheck/spellcheckExtension
 */

import {
  Decoration,
  type DecorationSet,
  EditorView,
  hoverTooltip,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import {
  Compartment,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';
import { tokenize, DEFAULT_TOKENIZER_OPTIONS } from './tokenizer';
import { loadSpellchecker, type LoadedSpellchecker } from './dictionary';
import type { SpellcheckSettings } from '../../db/characterTypes';

const MISSPELLING_DECORATION_CLASS = 'cm-spellerror';
const DECORATION_CAP = 500;
const DEBOUNCE_MS = 300;

export interface SpellcheckExtensionOptions {
  settings: SpellcheckSettings;
}

interface Mistake {
  from: number;
  to: number;
  word: string;
}

const setMistakesEffect = StateEffect.define<readonly Mistake[]>();

const spellMistakesField = StateField.define<readonly Mistake[]>({
  create: () => [],
  update(value, transaction) {
    if (transaction.effects.length === 0) return value;
    for (const effect of transaction.effects) {
      if (effect.is(setMistakesEffect)) return effect.value;
    }
    return value;
  },
  toJSON: () => [] as readonly Mistake[],
  fromJSON: () => [] as readonly Mistake[],
});

const spellDecorationsField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, transaction): DecorationSet {
    for (const effect of transaction.effects) {
      if (effect.is(setMistakesEffect)) {
        return buildDecorations(effect.value);
      }
    }
    return deco.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
  toJSON: () => null,
  fromJSON: () => Decoration.none,
});

const spellcheckCompartment = new Compartment();

function makeBaseTheme(): Extension {
  return EditorView.baseTheme({
    '.cm-spellerror': {
      textDecoration: 'underline wavy',
      textDecorationColor: 'rgba(220, 38, 38, 0.85)',
      textDecorationSkipInk: 'none',
      textUnderlinePosition: 'under',
    },
    '&dark .cm-spellerror': {
      textDecorationColor: 'rgba(248, 113, 113, 0.95)',
    },
    '.cm-spellcheck-tooltip': {
      maxHeight: '16rem',
      overflowY: 'auto',
      padding: '4px 0',
      fontSize: '0.85rem',
    },
    '.cm-spellcheck-tooltip .cm-spellcheck-suggestion': {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      padding: '4px 12px',
      cursor: 'pointer',
      border: 'none',
      background: 'transparent',
      color: 'inherit',
    },
    '.cm-spellcheck-tooltip .cm-spellcheck-suggestion:hover, .cm-spellcheck-tooltip .cm-spellcheck-suggestion:focus': {
      backgroundColor: 'rgba(0, 0, 0, 0.06)',
    },
    '&dark .cm-spellcheck-tooltip .cm-spellcheck-suggestion:hover, &dark .cm-spellcheck-tooltip .cm-spellcheck-suggestion:focus': {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    '.cm-spellcheck-tooltip .cm-spellcheck-empty': {
      padding: '6px 12px',
      fontStyle: 'italic',
      opacity: 0.7,
    },
    '.cm-spellcheck-tooltip .cm-spellcheck-actions': {
      display: 'flex',
      flexDirection: 'column',
      borderTop: '1px solid rgba(0, 0, 0, 0.1)',
      marginTop: '4px',
      paddingTop: '4px',
    },
    '&dark .cm-spellcheck-tooltip .cm-spellcheck-actions': {
      borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    '.cm-spellcheck-tooltip .cm-spellcheck-action': {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      padding: '4px 12px',
      cursor: 'pointer',
      border: 'none',
      background: 'transparent',
      color: 'inherit',
      fontSize: '0.8rem',
    },
    '.cm-spellcheck-tooltip .cm-spellcheck-action:hover, .cm-spellcheck-tooltip .cm-spellcheck-action:focus': {
      backgroundColor: 'rgba(0, 0, 0, 0.06)',
    },
    '&dark .cm-spellcheck-tooltip .cm-spellcheck-action:hover, &dark .cm-spellcheck-tooltip .cm-spellcheck-action:focus': {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
  });
}

export function spellcheckExtension(options: SpellcheckExtensionOptions): Extension {
  const baseTheme = makeBaseTheme();
  if (!options.settings.enabled) {
    return [baseTheme];
  }
  return [
    baseTheme,
    spellDecorationsField,
    spellMistakesField,
    spellcheckCompartment.of(buildEnabledExtensions(options.settings)),
    hoverTooltip(spellcheckHover, { hideOnChange: true }),
  ];
}

/**
 * Module-level dictionary cache: reconfigure-with-fresh-closures is cheap, but
 * the dictionary itself is expensive to load.
 */
const loaderCache = new Map<string, Promise<LoadedSpellchecker | null>>();

function ensureSpellchecker(language: string): Promise<LoadedSpellchecker | null> {
  const key = (language || 'en').toLowerCase();
  const cached = loaderCache.get(key);
  if (cached) return cached;
  const promise = loadSpellchecker(key);
  loaderCache.set(key, promise);
  return promise;
}

function buildEnabledExtensions(settings: SpellcheckSettings): Extension[] {
  return [
    ViewPlugin.fromClass(
      class SpellcheckPlugin {
        private view: EditorView;
        private ignored: Set<string>;
        private loaded: LoadedSpellchecker | null = null;
        private language: string;
        private debounceTimer?: ReturnType<typeof setTimeout>;
        private customWords: readonly string[];
        private customWordsAdded: Set<string> = new Set();

        constructor(view: EditorView) {
          this.view = view;
          this.language = settings.language;
          this.ignored = new Set(settings.ignoredWords.map(w => w.toLowerCase()));
          this.customWords = settings.customWords;
          void this.loadDictionaryAndRespell(true);
        }

        update(update: ViewUpdate): void {
          if (!update.docChanged && !update.viewportChanged && !update.selectionSet) return;
          this.scheduleRespell(false);
        }

        destroy(): void {
          if (this.debounceTimer) clearTimeout(this.debounceTimer);
        }

        private async loadDictionaryAndRespell(immediate: boolean): Promise<void> {
          const loaded = await ensureSpellchecker(this.language);
          if (!loaded) return;
          this.loaded = loaded;
          this.syncCustomWords();
          this.scheduleRespell(immediate);
        }

        private syncCustomWords(): void {
          if (!this.loaded) return;
          try {
            for (const word of this.customWords) {
              const key = word.toLowerCase();
              if (this.customWordsAdded.has(key)) continue;
              this.loaded.spell.add(key);
              this.customWordsAdded.add(key);
            }
          } catch {
            // nspell occasionally throws on malformed words; safe to ignore
          }
        }

        private scheduleRespell(immediate: boolean): void {
          if (this.debounceTimer) clearTimeout(this.debounceTimer);
          if (immediate) this.respell();
          else this.debounceTimer = setTimeout(() => this.respell(), DEBOUNCE_MS);
        }

        private respell(): void {
          const view = this.view;
          const loaded = this.loaded;
          if (!loaded) {
            this.commitMistakes([]);
            return;
          }
          const doc = view.state.doc;
          const viewport = view.viewport;
          const mistakes: Mistake[] = [];

          const startLine = doc.lineAt(viewport.from);
          const endLineNumber = Math.min(doc.lines, doc.lineAt(viewport.to).number);

          outer: for (let lineNo = startLine.number; lineNo <= endLineNumber; lineNo += 1) {
            const line = doc.line(lineNo);
            const tokens = tokenize(line.text, DEFAULT_TOKENIZER_OPTIONS);
            for (const t of tokens) {
              if (t.skipped) continue;
              if (this.ignored.has(t.wordLower)) continue;
              if (mistakes.length >= DECORATION_CAP) break outer;
              try {
                // Pass the *original-case* surface form to nspell; the bundled
                // English dictionary stores proper nouns with sentence-case
                // affixes (e.g. `Richard/MS`), so lowercasing first would
                // erroneously reject valid capitalized words.
                if (!loaded.spell.correct(t.word)) {
                  mistakes.push({
                    from: line.from + t.from,
                    to: line.from + t.to,
                    word: t.word,
                  });
                }
              } catch {
                // nspell may throw on weird tokens; skip quietly
              }
            }
          }

          this.commitMistakes(mistakes);
        }

        private commitMistakes(next: readonly Mistake[]): void {
          viewDispatchMistakes(this.view, next);
        }
      },
    ),
  ];
}

function viewDispatchMistakes(view: EditorView, next: readonly Mistake[]): void {
  view.dispatch({ effects: setMistakesEffect.of(next) });
}

/**
 * hoverTooltip source that surfaces suggestions / Ignore / Add-to-dictionary
 * for misspelled words in the viewport.
 *
 * Picks tooltip placement (`above` vs `below`) dynamically so that words near
 * the top of the visible editor render the tooltip below them, preventing the
 * top from being clipped by `overflow: hidden` ancestors or by the top edge
 * of the editor's scroll container.
 */
async function spellcheckHover(
  view: EditorView,
  pos: number,
): Promise<{ pos: number; end: number; above: boolean; strictSide: true; create: (view: EditorView) => { dom: HTMLElement } } | null> {
  const mistakes = view.state.field(spellMistakesField, false) ?? [];
  if (!mistakes.length) return null;
  const mistake = mistakes.find(m => pos >= m.from && pos <= m.to);
  if (!mistake) return null;

  const loaded = await ensureSpellchecker('en');
  const suggestions = loaded ? loaded.spell.suggest(mistake.word).slice(0, 8) : [];

  // Pick the placement that has room. CodeMirror's own flip logic looks at
  // the editor's space rect — but with tall editors and small scroll margins
  // it can believe "above" fits when in practice the tooltip's top is clipped
  // by an ancestor's `overflow: hidden`. We compute it ourselves with a safe
  // margin so the tooltip never ends up clipped at either edge.
  const above = await computeAboveSide(view, mistake.from);

  return {
    pos: mistake.from,
    end: mistake.to,
    above,
    strictSide: true,
    create: () => {
      const dom = document.createElement('div');
      dom.className = 'cm-spellcheck-tooltip';

      const heading = document.createElement('div');
      heading.className = 'cm-spellcheck-empty';
      heading.textContent = mistake.word;
      dom.appendChild(heading);

      if (suggestions.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'cm-spellcheck-empty';
        empty.textContent = 'No suggestions';
        dom.appendChild(empty);
      } else {
        for (const suggestion of suggestions) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'cm-spellcheck-suggestion';
          button.textContent = suggestion;
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            view.dispatch({
              changes: { from: mistake.from, to: mistake.to, insert: suggestion },
              selection: { anchor: mistake.from + suggestion.length },
            });
          });
          dom.appendChild(button);
        }
      }

      const actions = document.createElement('div');
      actions.className = 'cm-spellcheck-actions';

      const ignoreBtn = document.createElement('button');
      ignoreBtn.type = 'button';
      ignoreBtn.className = 'cm-spellcheck-action';
      ignoreBtn.textContent = 'Ignore word';
      ignoreBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void globalThis.__cv_spellcheck_ignore?.(mistake.word);
      });
      actions.appendChild(ignoreBtn);

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'cm-spellcheck-action';
      addBtn.textContent = 'Add to dictionary';
      addBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void globalThis.__cv_spellcheck_add?.(mistake.word);
      });
      actions.appendChild(addBtn);

      dom.appendChild(actions);
      return { dom };
    },
  };
}

/** Estimated worst-case tooltip height in pixels. Used to pick a safe side. */
const TOOLTIP_ESTIMATED_HEIGHT = 220;

/**
 * Returns `true` when the tooltip should render above the misspelled word,
 * `false` when below. Picks the side that can accommodate the tooltip without
 * clipping it against the top or bottom of the visible viewport.
 */
async function computeAboveSide(view: EditorView, pos: number): Promise<boolean> {
  const coords = view.coordsAtPos(pos);
  const scrollDOM = view.scrollDOM;
  const editorRect = scrollDOM.getBoundingClientRect();
  if (!coords) return true;
  const lineHeight = view.defaultLineHeight;
  const spaceAbove = coords.top - editorRect.top;
  const spaceBelow = editorRect.bottom - coords.bottom;
  // Use the larger of the two allowances: tooltip max-height plus a buffer.
  const needed = TOOLTIP_ESTIMATED_HEIGHT;
  const comfortableAbove = spaceAbove >= needed + lineHeight;
  const comfortableBelow = spaceBelow >= needed + lineHeight;
  if (comfortableAbove && !comfortableBelow) return true;
  if (comfortableBelow && !comfortableAbove) return false;
  // Both fit (or neither fits). Default to below for words near the top
  // since a partially-clipped top is more disruptive than covering the next
  // line briefly.
  return !comfortableBelow && spaceAbove > spaceBelow;
}

function buildDecorations(mistakes: readonly Mistake[]): DecorationSet {
  if (mistakes.length === 0) return Decoration.none;
  const mark = Decoration.mark({ class: MISSPELLING_DECORATION_CLASS });
  const ranges = mistakes.map((mistake) => mark.range(mistake.from, mistake.to));
  return Decoration.set(ranges);
}

/**
 * Reconfigure the spellcheck extension with new settings.
 * Use after the user toggles the spellcheck setting, switches language, or
 * updates the custom/ignored word lists.
 */
export function setSpellcheckSettings(view: EditorView, settings: SpellcheckSettings): void {
  if (!settings.enabled) {
    view.dispatch({ effects: spellcheckCompartment.reconfigure([]) });
    view.dispatch({ effects: setMistakesEffect.of([]) });
    return;
  }
  view.dispatch({
    effects: spellcheckCompartment.reconfigure(buildEnabledExtensions(settings)),
  });
}

// ---------------------------------------------------------------------------
// Ignore / Add hooks (set by the host app; see `bindSpellcheckCallbacks`)
// ---------------------------------------------------------------------------

declare global {
  var __cv_spellcheck_ignore: undefined | ((word: string) => Promise<void> | void);
  var __cv_spellcheck_add: undefined | ((word: string) => Promise<void> | void);
}

/** Callbacks the extension uses to push ignore/add actions back to the app. */
export interface SpellcheckCallbacks {
  ignoreWord: (word: string) => Promise<void> | void;
  addWord: (word: string) => Promise<void> | void;
}

/**
 * Bind app-level callbacks so ignore/add actions can update settings.
 * Pass the same object for every editor instance — the latest binding wins.
 */
export function bindSpellcheckCallbacks(callbacks: SpellcheckCallbacks): void {
  globalThis.__cv_spellcheck_ignore = (word) => callbacks.ignoreWord(word);
  globalThis.__cv_spellcheck_add = (word) => callbacks.addWord(word);
}

/** Helper used by tests and consumers that want plain tokenization output. */
export { tokenize, DEFAULT_TOKENIZER_OPTIONS };
