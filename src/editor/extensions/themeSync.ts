/**
 * Theme synchronization for CodeMirror 6.
 * Chrome + syntax colors come from CSS variables in index.css.
 */

import type { Extension } from '@codemirror/state';
import { Compartment } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { createSyntaxHighlightStyle } from './syntaxHighlight';
import { syntaxHighlighting } from '@codemirror/language';

const themeCompartment = new Compartment();
const syntaxCompartment = new Compartment();

function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/** Editor chrome — all colors via CSS vars (light/dark assigned in index.css). */
const editorChromeTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--editor-text)',
  },
  '.cm-content': {
    caretColor: 'var(--editor-caret)',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: 'var(--editor-caret)',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--editor-selection)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'var(--editor-selection)',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: 'none',
    color: 'var(--editor-gutter)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--editor-active-line-gutter)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--editor-active-line)',
  },
  '.cm-lineNumbers': {
    color: 'var(--editor-gutter)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--editor-fold-bg)',
    border: 'none',
    color: 'var(--editor-fold-text)',
    borderRadius: '4px',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--tooltip-bg)',
    border: '1px solid var(--tooltip-border)',
    color: 'var(--tooltip-text)',
  },
});

function buildSyntaxExtension(): Extension {
  return syntaxHighlighting(createSyntaxHighlightStyle());
}

function reconfigureTheme(view: EditorView): void {
  view.dispatch({
    effects: [
      themeCompartment.reconfigure(editorChromeTheme),
      syntaxCompartment.reconfigure(buildSyntaxExtension()),
    ],
  });
}

const themeSyncPlugin = ViewPlugin.fromClass(
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
          reconfigureTheme(view);
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

/**
 * Theme sync extension:
 * - CSS-var editor chrome (no One Dark package)
 * - Syntax highlighting from --syntax-* tokens
 * - Re-resolves colors when .dark toggles
 */
export function themeSync(): Extension[] {
  return [
    themeCompartment.of(editorChromeTheme),
    syntaxCompartment.of(buildSyntaxExtension()),
    themeSyncPlugin,
  ];
}

export function getCurrentTheme(): Extension {
  return editorChromeTheme;
}

export function refreshTheme(view: EditorView): void {
  reconfigureTheme(view);
}

export function getThemeColor(variable: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

export default themeSync;
