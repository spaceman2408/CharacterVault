/**
 * @fileoverview HTML/CSS syntax highlighting extension for CodeMirror 6.
 * Provides language mode and custom highlight style for creator notes.
 * Uses a Compartment to reconfigure the highlight style when dark mode toggles.
 * @module @editor/extensions/htmlHighlight
 */

import { Compartment } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { html } from '@codemirror/lang-html';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const creatorNotesLightStyle = HighlightStyle.define([
  { tag: tags.tagName, color: '#7c3aed' },
  { tag: tags.attributeName, color: '#2563eb' },
  { tag: tags.attributeValue, color: '#059669' },
  { tag: tags.angleBracket, color: '#6b7280' },
  { tag: tags.propertyName, color: '#0891b2' },
  { tag: tags.variableName, color: '#db2777' },
  { tag: tags.className, color: '#d97706' },
  { tag: tags.labelName, color: '#d97706' },
  { tag: tags.number, color: '#d97706' },
  { tag: tags.unit, color: '#d97706' },
  { tag: tags.color, color: '#d97706' },
  { tag: tags.string, color: '#059669' },
  { tag: tags.comment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: tags.keyword, color: '#7c3aed' },
  { tag: tags.operator, color: '#6b7280' },
  { tag: tags.punctuation, color: '#6b7280' },
  { tag: tags.bracket, color: '#6b7280' },
  { tag: tags.separator, color: '#6b7280' },
  { tag: tags.meta, color: '#94a3b8' },
  { tag: tags.processingInstruction, color: '#7c3aed' },
  { tag: tags.definition(tags.variableName), color: '#2563eb' },
  { tag: tags.typeName, color: '#e11d48' },
]);

const creatorNotesDarkStyle = HighlightStyle.define([
  { tag: tags.tagName, color: '#c678dd' },
  { tag: tags.attributeName, color: '#61afef' },
  { tag: tags.attributeValue, color: '#98c379' },
  { tag: tags.angleBracket, color: '#7d8799' },
  { tag: tags.propertyName, color: '#56b6c2' },
  { tag: tags.variableName, color: '#e06c75' },
  { tag: tags.className, color: '#e5c07b' },
  { tag: tags.labelName, color: '#e5c07b' },
  { tag: tags.number, color: '#d19a66' },
  { tag: tags.unit, color: '#d19a66' },
  { tag: tags.color, color: '#d19a66' },
  { tag: tags.string, color: '#98c379' },
  { tag: tags.comment, color: '#7d8799', fontStyle: 'italic' },
  { tag: tags.keyword, color: '#c678dd' },
  { tag: tags.operator, color: '#abb2bf' },
  { tag: tags.punctuation, color: '#abb2bf' },
  { tag: tags.bracket, color: '#7d8799' },
  { tag: tags.separator, color: '#7d8799' },
  { tag: tags.meta, color: '#7d8799' },
  { tag: tags.processingInstruction, color: '#c678dd' },
  { tag: tags.definition(tags.variableName), color: '#61afef' },
  { tag: tags.typeName, color: '#e5c07b' },
]);

function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

function getHighlightStyle() {
  return isDarkMode() ? creatorNotesDarkStyle : creatorNotesLightStyle;
}

const htmlHighlightCompartment = new Compartment();

const htmlHighlightSyncPlugin = ViewPlugin.fromClass(
  class {
    private observer: MutationObserver | null = null;
    private currentDarkMode: boolean;

    constructor(view: EditorView) {
      this.currentDarkMode = isDarkMode();
      this.setupObserver(view);
    }

    private setupObserver(view: EditorView): void {
      if (typeof document === 'undefined') return;

      this.observer = new MutationObserver(() => {
        const newDarkMode = isDarkMode();
        if (newDarkMode !== this.currentDarkMode) {
          this.currentDarkMode = newDarkMode;
          view.dispatch({
            effects: htmlHighlightCompartment.reconfigure(
              syntaxHighlighting(getHighlightStyle()),
            ),
          });
        }
      });

      this.observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    destroy(): void {
      this.observer?.disconnect();
    }
  },
);

const htmlLanguage = html();

export function creatorNotesExtensions(): Extension[] {
  return [
    htmlLanguage,
    htmlHighlightCompartment.of(syntaxHighlighting(getHighlightStyle())),
    htmlHighlightSyncPlugin,
  ];
}
