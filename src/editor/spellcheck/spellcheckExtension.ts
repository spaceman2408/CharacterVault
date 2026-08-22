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
 * - In `html` and `json` modes, also queries the editor's syntax tree so that
 *   HTML tag structure (element names, attributes, CSS classes) and JSON
 *   property keys are skipped automatically — they are technical tokens the
 *   user does not author as prose.
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
  Transaction,
  type EditorState,
  type Extension,
} from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { tokenize, DEFAULT_TOKENIZER_OPTIONS } from './tokenizer';
import { loadSpellchecker, type LoadedSpellchecker } from './dictionary';
import { isWordCorrect } from './wordCheck';
import type { SpellcheckSettings } from '../../db/characterTypes';

const MISSPELLING_DECORATION_CLASS = 'cm-spellerror';
const DECORATION_CAP = 500;
const DEBOUNCE_MS = 300;

export interface SpellcheckExtensionOptions {
  settings: SpellcheckSettings;
  /**
   * Language mode of the editor being spellchecked.
   *
   * - `'prose'` (default) — plain prose; only the tokenizer's ignore rules apply.
   * - `'html'` — also skip tokens inside HTML element names / attribute names /
   *   attribute values / `<tag>` brackets / comments / `<script>` / `<style>`.
   *   Requires the host editor to be running `@codemirror/lang-html` (or
   *   anything built on `@lezer/html`).
   * - `'json'` — also skip tokens inside JSON `PropertyName` nodes (the
   *   `"key"` part of `"key": "value"` pairs). Requires the host editor to be
   *   running `@codemirror/lang-json` (or anything built on `@lezer/json`).
   *   String values are still spellchecked.
   */
  mode?: 'prose' | 'html' | 'json';
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
    spellcheckCompartment.of(buildEnabledExtensions(options.settings, options.mode ?? 'prose')),
    hoverTooltip(spellcheckHover, { hideOnChange: true }),
  ];
}

/**
 * Robust character-by-character scanner that emits "skip" ranges for every
 * piece of HTML markup in `text` — comments, tag names, attribute names,
 * attribute values, opening/closing tags, and the contents of `<style>` /
 * `<script>` blocks.
 *
 * Used as a defensive net in `html` mode because the integrated
 * `@codemirror/lang-html` parser can lose structure when faced with the kind
 * of heavily-scripted creator-notes content users author here (we observed
 * it emit only 7 of 22 comments and stop parsing partway through a CSS
 * block, leaving CSS body tokens unmissed). The walk handles:
 *
 *  - `<!-- … -->` comments (including odd `>:( -->` content)
 *  - `<style …> … </style>` and `<script …> … </script>` blocks — content
 *    included so CSS / JS words are skipped wholesale
 *  - tag openers (`<tag attr="value" attr='value'>`), self-closing
 *    (`<tag />`), and closers (`</tag>`), including attribute values
 *    delimited by `'…'` or `"…"`
 *  - `<![ … ]>` / `<!DOCTYPE …>` declarations
 *
 * Prose text (anything between markup tokens) stays out of these ranges and
 * is therefore still spell-checked.
 *
 * The walk runs in O(n) and is allocated once per spellcheck re-spell.
 */
function findMarkupBlockSkips(text: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  const push = (from: number, to: number) => ranges.push({ from, to });

  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];

    // Plain text — emit nothing; fall through to finding markup.
    if (ch !== '<') {
      i += 1;
      continue;
    }

    // Start of a markup node at offset `i`. Find its end (inclusive) by
    // walking through tag/attribute syntax.
    const tagStart = i;
    i += 1;

    // Comment: `<!-- … -->`
    if (text.startsWith('!--', i)) {
      i = i + 3;
      const close = text.indexOf('-->', i);
      const end = close === -1 ? n : close + 3;
      push(tagStart, end);
      i = end;
      continue;
    }

    // Doctype / CDATA / processing instruction: `<![ … ]>` or `<! … >`. Treat
    // the entire declaration as a skip range.
    if (text[i] === '!') {
      i += 1;
      const close = text.indexOf('>', i);
      const end = close === -1 ? n : close + 1;
      push(tagStart, end);
      i = end;
      continue;
    }

    // Skip an HTML comment more leniently (in case the input is malformed
    // and `<!--` is followed by `>` early — `<!---->` etc.). Already handled
    // by the dedicated branch above.

    // Closing tag or opening tag.
    if (text[i] === '/') i += 1;

    // Tag name (or no name at all if this is bogus `<>`) — scan letters or
    // hyphen until we hit whitespace, `/`, or `>`.
    while (i < n) {
      const c = text[i];
      if (/[\p{L}\p{N}_:-]/u.test(c)) i += 1;
      else break;
    }
    // Walk attributes.
    while (i < n) {
      // Whitespace between attributes.
      while (i < n && /[ \t\r\n\f]/u.test(text[i])) i += 1;
      if (i >= n) break;
      const after = text[i];
      if (after === '>') {
        i += 1;
        break;
      }
      if (after === '/') {
        i += 1;
        if (text[i] === '>') i += 1;
        break;
      }
      // Attribute name (with optional `:`, `.`, `-`, `_`).
      const attrNameStart = i;
      while (i < n) {
        const c = text[i];
        if (/[\p{L}\p{N}_:.-]/u.test(c)) i += 1;
        else break;
      }
      // If the cursor didn't advance (e.g. a stray `(`, `@`, `*`, emoji, or
      // any char that isn't whitespace / `>` / `/` / a valid attr-name char),
      // skip it so we make forward progress. Otherwise the `continue` below
      // would loop forever on the same offset and hang the renderer.
      if (i === attrNameStart) i += 1;
      // Whitespace, then optional `=`, then value.
      while (i < n && /[ \t\r\n\f]/u.test(text[i])) i += 1;
      if (text[i] !== '=') continue;
      i += 1;
      while (i < n && /[ \t\r\n\f]/u.test(text[i])) i += 1;
      const quote = text[i];
      if (quote === '"' || quote === "'") {
        i += 1;
        while (i < n && text[i] !== quote) i += 1;
        if (i < n) i += 1; // skip closing quote
      } else {
        // Unquoted value — scan until whitespace or `>`.
        while (i < n) {
          const c = text[i];
          if (c === '>' || c === '/' || /[ \t\r\n\f]/u.test(c)) break;
          i += 1;
        }
      }
    }

    // `tagStart..i` is the entire opening or closing tag including attribute
    // values. Record it.
    push(tagStart, i);

    // For `<style>` or `<script>` openings, additionally consume the content
    // up to the matching closer.
    const recentOpen = text.slice(tagStart, i);
    let closeName: string | null = null;
    if (/^<style\b/i.test(recentOpen)) closeName = 'style';
    else if (/^<script\b/i.test(recentOpen)) closeName = 'script';
    if (closeName) {
      const closeTag = `</${closeName}>`;
      const closeIdx = text.indexOf(closeTag, i);
      if (closeIdx === -1) {
        // Unterminated — eat to end of document.
        push(i, n);
        i = n;
      } else {
        push(i, closeIdx);
        i = closeIdx;
      }
    }
  }

  // Merge adjacent/overlapping ranges.
  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: Array<{ from: number; to: number }> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.from <= last.to) {
      last.to = Math.max(last.to, r.to);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
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

function buildEnabledExtensions(
  settings: SpellcheckSettings,
  mode: 'prose' | 'html' | 'json',
): Extension[] {
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
        private mode: 'prose' | 'html' | 'json';

        constructor(view: EditorView) {
          this.view = view;
          this.language = settings.language;
          this.ignored = new Set(settings.ignoredWords.map(w => w.toLowerCase()));
          this.customWords = settings.customWords;
          this.mode = mode;
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
          const inSkipRange = makeSkipRangePredicate(view.state, this.mode);

          outer: for (let lineNo = startLine.number; lineNo <= endLineNumber; lineNo += 1) {
            const line = doc.line(lineNo);
            const lineBase = line.from;
            const tokens = tokenize(line.text, DEFAULT_TOKENIZER_OPTIONS);
            for (const t of tokens) {
              if (t.skipped) continue;
              const absoluteFrom = lineBase + t.from;
              if (inSkipRange(absoluteFrom)) continue;
              if (this.ignored.has(t.wordLower)) continue;
              if (mistakes.length >= DECORATION_CAP) break outer;
              if (!isWordCorrect(loaded.spell, t.word)) {
                mistakes.push({
                  from: absoluteFrom,
                  to: lineBase + t.to,
                  word: t.word,
                });
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

/**
 * Skip-node predicates for `html` and `json` modes. Tokens whose midpoint falls
 * inside any of these ranges are skipped, on top of the tokenizer's textual
 * rules.
 *
 * The predicate is recomputed per-respell from the live syntax tree, so it
 * stays in sync with document edits.
 *
 * Note: `@codemirror/lang-html` wraps `<script>`/`<style>`/`<textarea>`
 * content using `configureNesting`, embedding the **CSS** parser for
 * `<style>` and the **JavaScript** parser for `<script>`. That means the
 * content of `<style>` is a CSS parse tree (`StyleSheet` …), NOT raw
 * `StyleText`. We list both the raw HTML grammar names and the nested-parse
 * wrapper names so a stripped `lang-html` and a vanilla `@lezer/html` both
 * work. CSS/JS leaves (`PropertyName`, `ClassSelector`, `KeyValue`, …) fall
 * inside the wrappers and inherit the skip automatically.
 */
const HTML_SKIP_NODE_NAMES: ReadonlySet<string> = new Set([
  // `<tag>` itself (the `<` .. `>` brackets and their contents)
  'OpenTag',
  'CloseTag',
  'SelfClosingTag',
  'MismatchedCloseTag',
  'NoMatchCloseTag',
  // The tag/element name (`span`, `div`, `br`, …)
  'TagName',
  // Attribute structure (`<tag ...>`)
  'Attribute',
  'AttributeName',
  'AttributeValue',
  'UnquotedAttributeValue',
  // Comments
  'Comment',
  // Embedded CSS / JavaScript / raw text containers (raw HTML grammar names)
  'Script',
  'Style',
  'Textarea',
  'ScriptText',
  'StyleText',
  'TextareaText',
  // Embeds produced by `@codemirror/lang-html`'s `configureNesting`:
  // the `<style>` body is wrapped as a CSS `StyleSheet`, the `<script>`
  // body as a JS program node, etc. Skipping these parents also skips every
  // CSS / JS leaf inside them (and every word token they contain).
  'StyleSheet',
  'ScriptContent', // some lang-html versions use this instead of `Script`
  'Styles',         // CSS parser top node, just in case
]);

/**
 * JSON: skip ranges where tokens are likely technical data, not prose.
 *
 * - `PropertyName` covers the `"key":` side.
 * - `String` covers string _values_; most JSON in character-card extensions
 *   is data (paths, IDs, hashed slugs, CSS export strings), so values are
 *   skipped wholesale. Users who need prose checks inside JSON values can
 *   paste the text into a description field first.
 */
const JSON_SKIP_NODE_NAMES: ReadonlySet<string> = new Set([
  'PropertyName',
  'String',
]);

function makeSkipRangePredicate(
  state: EditorState,
  mode: 'prose' | 'html' | 'json',
): (offset: number) => boolean {
  if (mode === 'prose') return () => false;
  const nodeNames = mode === 'html' ? HTML_SKIP_NODE_NAMES : JSON_SKIP_NODE_NAMES;
  const ranges: Array<{ from: number; to: number }> = [];

  // First, range derived from the syntax tree.
  const tree = syntaxTree(state);
  tree.iterate({
    enter(node) {
      if (nodeNames.has(node.name)) {
        ranges.push({ from: node.from, to: node.to });
      }
    },
  });

  // In HTML mode, also pick up `<style>`, `<script>`, and comment blocks via a
  // text-level scan. The integrated `lang-html` parser loses structure when
  // it encounters heavily-scripted docs (we saw it emit only 7 of 22 comments
  // and stop somewhere mid-doc, leaving CSS body tokens unmissed). The text
  // scan is dumb but robust.
  if (mode === 'html') {
    for (const r of findMarkupBlockSkips(state.doc.toString())) {
      ranges.push(r);
    }
  }

  // Sort by `from` and dedupe overlaps. Ranges are then walked linearly. A
  // binary search is tempting but breaks for overlapping ranges that share
  // a `from` (e.g. `<style>` element's `TagName [994, 1000]` next to its nested
  // `StyleSheet [994, 1256]` — picking the small one at mid sends the search
  // right past the wider one).
  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  if (ranges.length === 0) return () => false;
  return (offset: number): boolean => {
    for (const r of ranges) {
      if (r.from > offset) break;
      if (offset >= r.from && offset < r.to) return true;
    }
    return false;
  };
}

function viewDispatchMistakes(view: EditorView, next: readonly Mistake[]): void {
  view.dispatch({
    effects: setMistakesEffect.of(next),
    annotations: [Transaction.addToHistory.of(false)],
  });
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
 * updates the custom/ignored word lists. `mode` is the same language mode
 * that was originally passed to {@link spellcheckExtension}; it is preserved
 * across reconfigure so HTML/JSON skip rules remain in effect.
 */
export function setSpellcheckSettings(
  view: EditorView,
  settings: SpellcheckSettings,
  mode: 'prose' | 'html' | 'json' = 'prose',
): void {
  if (!settings.enabled) {
    view.dispatch({
      effects: spellcheckCompartment.reconfigure([]),
      annotations: [Transaction.addToHistory.of(false)],
    });
    view.dispatch({
      effects: setMistakesEffect.of([]),
      annotations: [Transaction.addToHistory.of(false)],
    });
    return;
  }
  view.dispatch({
    effects: spellcheckCompartment.reconfigure(buildEnabledExtensions(settings, mode)),
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
