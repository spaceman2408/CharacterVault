/**
 * @fileoverview Theme synchronization extension for CodeMirror 6.
 * Syncs CodeMirror theme with Tailwind dark mode using CSS variables from index.css.
 * @module editor/extensions/themeSync
 */

import type { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { Compartment } from '@codemirror/state';

// Create a compartment for dynamic theme switching
const themeCompartment = new Compartment();

/**
 * Get CSS variable value from the document
 * Falls back to default values if CSS variables are not set
 */
function getCSSVariable(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Light theme configuration using CSS variables from index.css
 * All colors reference CSS custom properties for consistency
 */
const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--editor-bg, transparent)',
    color: 'var(--editor-text, #0f172a)',
  },
  '.cm-content': {
    caretColor: 'var(--editor-caret, #475569)',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: 'var(--editor-caret, #475569)',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--editor-selection, rgba(148, 163, 184, 0.3))',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: 'none',
    color: 'var(--editor-gutter, #94a3b8)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--editor-active-line-gutter, rgba(226, 232, 240, 0.5))',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--editor-active-line, rgba(241, 245, 249, 0.5))',
  },
  '.cm-lineNumbers': {
    color: 'var(--editor-gutter, #94a3b8)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--editor-fold-bg, #e2e8f0)',
    border: 'none',
    color: 'var(--editor-fold-text, #475569)',
    borderRadius: '4px',
  },
}, { dark: false });

/**
 * Dark theme configuration using CSS variables from index.css
 * All colors reference CSS custom properties for consistency
 */
const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--editor-bg, transparent)',
    color: 'var(--editor-text, #f1f5f9)',
  },
  '.cm-content': {
    caretColor: 'var(--editor-caret, #94a3b8)',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: 'var(--editor-caret, #94a3b8)',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--editor-selection, rgba(71, 85, 105, 0.4))',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: 'none',
    color: 'var(--editor-gutter, #64748b)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--editor-active-line-gutter, rgba(30, 41, 59, 0.5))',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--editor-active-line, rgba(30, 41, 59, 0.3))',
  },
  '.cm-lineNumbers': {
    color: 'var(--editor-gutter, #64748b)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--editor-fold-bg, #334155)',
    border: 'none',
    color: 'var(--editor-fold-text, #94a3b8)',
    borderRadius: '4px',
  },
}, { dark: true });

/**
 * Check if dark mode is currently active
 * Uses the Tailwind 'dark' class on the document
 */
function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/**
 * Get the appropriate theme based on current dark mode status
 */
function getTheme(): Extension {
  return isDarkMode() ? darkTheme : lightTheme;
}

/**
 * View plugin that watches for theme changes and reconfigures the editor
 */
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
          // Reconfigure the theme compartment with the new theme
          view.dispatch({
            effects: themeCompartment.reconfigure(getTheme()),
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
  }
);

/**
 * Creates the theme synchronization extension.
 * 
 * This extension:
 * - Watches for Tailwind dark class changes on document.documentElement
 * - Switches CodeMirror theme between light and dark
 * - Uses CSS variables from index.css for all colors
 * 
 * @returns CodeMirror extension array
 */
export function themeSync(): Extension[] {
  return [
    // Theme compartment with initial theme
    themeCompartment.of(getTheme()),
    // One dark theme for syntax highlighting in dark mode
    oneDark,
    // Watch for theme changes
    themeSyncPlugin,
  ];
}

/**
 * Get the current theme extension based on dark mode status
 * This can be used for dynamic theme switching
 * 
 * @returns The appropriate theme extension
 */
export function getCurrentTheme(): Extension {
  return getTheme();
}

/**
 * Force a theme update on the editor view
 * 
 * @param view - The EditorView instance
 */
export function refreshTheme(view: EditorView): void {
  view.dispatch({
    effects: themeCompartment.reconfigure(getTheme()),
  });
}

/**
 * Utility to get a theme color value from CSS variables
 * Useful for components that need to match the editor theme
 * 
 * @param variable - CSS variable name (e.g., '--editor-text')
 * @param fallback - Fallback color value
 * @returns The computed color value
 */
export function getThemeColor(variable: string, fallback: string): string {
  return getCSSVariable(variable, fallback);
}

export default themeSync;
