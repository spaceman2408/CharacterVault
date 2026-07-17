/**
 * @fileoverview Font size control extension for CodeMirror 6.
 * Provides StateField-based font size management with a slider popup UI.
 * @module @editor/extensions/fontSizeControl
 */

import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { StateEffect, StateField, Compartment } from '@codemirror/state';
import { closeToolbarSearch } from './toolbarSearch';

export const MIN_FONT_SIZE = 6;
export const MAX_FONT_SIZE = 32;
export const DEFAULT_FONT_SIZE = 16;

/**
 * StateEffect to set the editor font size
 */
export const setEditorFontSize = StateEffect.define<number>({
  map: (value) => Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, value)),
});

/**
 * StateField that stores the current font size
 */
export const editorFontSizeField = StateField.define<number>({
  create() {
    // Try to read from CSS variable first
    if (typeof document !== 'undefined') {
      const computed = getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size');
      const parsed = parseInt(computed, 10);
      if (!isNaN(parsed) && parsed >= MIN_FONT_SIZE && parsed <= MAX_FONT_SIZE) {
        return parsed;
      }
    }
    return DEFAULT_FONT_SIZE;
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setEditorFontSize)) {
        return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, effect.value));
      }
    }
    return value;
  },
});

/**
 * Compartment for font size theme reconfiguration
 */
const fontSizeThemeCompartment = new Compartment();

/**
 * Create a theme extension that applies the current font size
 */
function createFontSizeTheme(size: number) {
  return EditorView.theme({
    '&': {
      fontSize: `${size}px`,
    },
    '.cm-content': {
      lineHeight: `${Math.max(1.2, 1.4 - (size - 16) * 0.005)}`,
    },
  });
}

/**
 * ViewPlugin that manages font size theme reconfiguration
 * Uses a timeout to defer the compartment reconfiguration outside the update cycle
 */
const fontSizeThemePlugin = ViewPlugin.fromClass(
  class {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_view: EditorView) {
      // Initial theme is set via compartment
    }

    update(update: ViewUpdate) {
      const oldSize = update.startState.field(editorFontSizeField);
      const newSize = update.state.field(editorFontSizeField);
      
      if (oldSize !== newSize) {
        // Schedule the compartment reconfiguration after this update cycle completes
        const view = update.view;
        const size = newSize;
        setTimeout(() => {
          view.dispatch({
            effects: fontSizeThemeCompartment.reconfigure(createFontSizeTheme(size)),
          });
        }, 0);
      }
    }
  }
);

/**
 * Helper to set font size on an editor view
 */
export function setFontSize(view: EditorView, size: number): void {
  const clampedSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
  view.dispatch({
    effects: setEditorFontSize.of(clampedSize),
  });
}

/**
 * Helper to get current font size from an editor view
 */
export function getFontSize(view: EditorView): number {
  return view.state.field(editorFontSizeField);
}

/**
 * Create the font size control popup element
 */
function createFontSizePopup(
  view: EditorView,
  onFontSizeChange: (size: number) => void,
  onClose: () => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cm-font-size-popup';
  
  // Check if mobile (screen width <= 640px)
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
  
  container.style.cssText = `
    position: absolute;
    top: calc(100% + 4px);
    ${isMobile ? 'left: 50%; transform: translateX(-50%);' : 'right: 0;'}
    background: var(--ai-toolbar-bg);
    border: 1px solid var(--ai-toolbar-border);
    border-radius: 8px;
    padding: ${isMobile ? '16px' : '12px 16px'};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    gap: ${isMobile ? '12px' : '8px'};
    min-width: ${isMobile ? '200px' : '180px'};
    max-width: ${isMobile ? 'calc(100vw - 24px)' : '220px'};
    z-index: 30;
  `;

  // Header with label and value
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: var(--ai-toolbar-text);
  `;

  const label = document.createElement('span');
  label.textContent = 'Font Size';
  label.style.fontWeight = '500';

  const valueDisplay = document.createElement('span');
  valueDisplay.style.cssText = `
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    color: var(--ai-toolbar-text-secondary);
  `;

  header.appendChild(label);
  header.appendChild(valueDisplay);
  container.appendChild(header);

  // Slider container
  const sliderContainer = document.createElement('div');
  sliderContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  // Min label
  const minLabel = document.createElement('span');
  minLabel.textContent = `${MIN_FONT_SIZE}`;
  minLabel.style.cssText = `
    font-size: 11px;
    color: var(--ai-toolbar-text-muted);
    min-width: 16px;
    text-align: center;
  `;

  // Range slider
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = `${MIN_FONT_SIZE}`;
  slider.max = `${MAX_FONT_SIZE}`;
  slider.step = '1';
  slider.style.cssText = `
    flex: 1;
    height: ${isMobile ? '8px' : '4px'};
    cursor: pointer;
    accent-color: var(--ai-toolbar-accent-primary);
    min-height: ${isMobile ? '44px' : 'auto'};
    touch-action: manipulation;
  `;

  // Max label
  const maxLabel = document.createElement('span');
  maxLabel.textContent = `${MAX_FONT_SIZE}`;
  maxLabel.style.cssText = `
    font-size: 11px;
    color: var(--ai-toolbar-text-muted);
    min-width: 20px;
    text-align: center;
  `;

  sliderContainer.appendChild(minLabel);
  sliderContainer.appendChild(slider);
  sliderContainer.appendChild(maxLabel);
  container.appendChild(sliderContainer);

  // Initialize slider value
  const currentSize = getFontSize(view);
  slider.value = `${currentSize}`;
  valueDisplay.textContent = `${currentSize}px`;

  // Update display value while dragging, but don't update editor until release
  slider.addEventListener('input', () => {
    const size = parseInt(slider.value, 10);
    valueDisplay.textContent = `${size}px`;
  });

  // Update editor and persist on change (release)
  slider.addEventListener('change', () => {
    const size = parseInt(slider.value, 10);
    setFontSize(view, size);
    onFontSizeChange(size);
  });

  // Close on escape key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  // Store cleanup function on the element
  (container as unknown as Record<string, () => void>).__cleanup = () => {
    document.removeEventListener('keydown', handleKeyDown);
  };

  return container;
}

/**
 * Create the font size toggle button and popup for the AI toolbar
 * Returns the button element and a cleanup function
 */
export function createFontSizeControl(
  view: EditorView,
  onFontSizeChange: (size: number) => void
): { button: HTMLElement; cleanup: () => void } {
  const container = document.createElement('div');
  container.style.cssText = 'position: relative;';

  // Toggle button (aA icon) - styled to match search button
  const button = document.createElement('button');
  button.className = 'ai-toolbar-btn-font-size';
  button.innerHTML = 'aA';
  button.title = 'Font Size';
  button.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    font-size: 14px;
    font-weight: 600;
    background: transparent;
    border: 1px solid var(--ai-toolbar-input-border);
    border-radius: 6px;
    cursor: pointer;
    color: var(--ai-toolbar-text-secondary);
    transition: all 0.15s ease;
    margin-left: 4px;
    font-family: ui-sans-serif, system-ui, sans-serif;
  `;

  let popup: HTMLElement | null = null;

  const closePopup = () => {
    if (popup) {
      const cleanup = (popup as unknown as Record<string, () => void>).__cleanup;
      if (cleanup) cleanup();
      popup.remove();
      popup = null;
      button.style.background = 'transparent';
      button.style.borderColor = 'var(--ai-toolbar-input-border)';
      button.style.color = 'var(--ai-toolbar-text-secondary)';
    }
  };

  const togglePopup = () => {
    if (popup) {
      closePopup();
      return;
    }

    // Close search if open (explicitly close, not toggle)
    closeToolbarSearch(view);

    // Create and show popup
    popup = createFontSizePopup(view, onFontSizeChange, closePopup);
    container.appendChild(popup);

    button.style.background = 'var(--ai-toolbar-active-bg)';
    button.style.borderColor = 'var(--ai-toolbar-active)';
    button.style.color = 'var(--ai-toolbar-active)';
  };

  button.addEventListener('click', togglePopup);
  button.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  // Close popup when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    if (popup && !container.contains(e.target as Node)) {
      closePopup();
    }
  };
  document.addEventListener('click', handleClickOutside);

  container.appendChild(button);

  const cleanup = () => {
    closePopup();
    document.removeEventListener('click', handleClickOutside);
  };

  return { button: container, cleanup };
}

/**
 * Font size extension factory
 * @param initialSize - Initial font size (defaults to 16)
 * @returns Extension array for CodeMirror
 */
export function fontSizeExtension(initialSize?: number) {
  const size = initialSize ?? DEFAULT_FONT_SIZE;
  
  return [
    editorFontSizeField,
    fontSizeThemeCompartment.of(createFontSizeTheme(size)),
    fontSizeThemePlugin,
  ];
}

/**
 * Theme styles for the font size control
 * Adds CSS custom properties for dark mode support
 */
export function fontSizeControlTheme() {
  return EditorView.baseTheme({
    '.cm-font-size-popup': {
      backgroundColor: 'var(--ai-toolbar-bg)',
      borderColor: 'var(--ai-toolbar-border)',
    },
  });
}
