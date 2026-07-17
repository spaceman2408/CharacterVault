/**
 * @fileoverview CodeMirror panel extension for AI toolbar.
 * Fixed panel at top of editor - no floating, no drag needed.
 * AI body text is previewed in-editor as a ghost; this chrome shows
 * status, collapsible thinking, and Accept/Reject.
 * @module @editor/extensions/aiToolbarPanel
 */

import { EditorView, showPanel, type Panel, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { SelectionRange, StateEffect } from '@codemirror/state';
import type { AIOperation } from '../../db/characterTypes';
import { toggleToolbarSearch, searchPanelOpen, closeToolbarSearch } from './toolbarSearch';
import { createFontSizeControl } from './fontSizeControl';
import { AIService } from '../../services/AIService';
import type { SamplerSettings } from '../../db/characterTypes';

/**
 * Callback for AI operations
 */
export type AIToolbarActionCallback = (
  operation: AIOperation,
  selectedText: string,
  selection: SelectionRange,
  customPrompt?: string
) => void;

/**
 * Callback for streaming updates
 */
export type AIStreamingCallback = (update: {
  isProcessing?: boolean;
  isStreaming?: boolean;
  streamingContent?: string;
  streamingReasoning?: string;
  aiResult?: string | null;
  aiReasoning?: string;
  currentOperation?: AIOperation | null;
  error?: string | null;
  instructPrompt?: string | null;
  stats?: { ttft?: number; tokensPerSecond?: number; modelId?: string; providerId?: string };
}) => void;

/**
 * Callback for aborting AI operations
 */
export type AIAbortCallback = () => void;

/**
 * Callback for font size changes
 */
export type FontSizeChangeCallback = (size: number) => void;

export interface ToolbarActionConfig {
  id: string;
  label: string;
  title?: string;
  onClick: (view: EditorView) => void;
}

// Registry to store panel update functions by editor view
const panelRegistry = new WeakMap<EditorView, AIStreamingCallback>();

/**
 * Get the panel's updateAIState function for a given editor view
 */
export function getPanelUpdateFunction(view: EditorView): AIStreamingCallback | undefined {
  return panelRegistry.get(view);
}

/**
 * Panel state for AI operations
 */
interface AIPanelState {
  isProcessing: boolean;
  isStreaming: boolean;
  streamingContent: string;
  streamingReasoning: string;
  aiResult: string | null;
  aiReasoning: string;
  currentOperation: AIOperation | null;
  error: string | null;
  showReasoning: boolean;
  instructPrompt: string | null;
  stats: { ttft?: number; tokensPerSecond?: number; modelId?: string; providerId?: string } | null;
}

/**
 * Create the AI toolbar panel DOM element
 */
function createToolbarPanel(
  view: EditorView,
  sampler: SamplerSettings,
  onAction: AIToolbarActionCallback,
  onAccept: () => void,
  onReject: () => void,
  onAbort: AIAbortCallback,
  onFontSizeChange?: FontSizeChangeCallback,
  toolbarActions: ToolbarActionConfig[] = [],
): Panel & { updateState: () => void; updateAIState: AIStreamingCallback; updateSampler: (s: SamplerSettings) => void } {
  const dom = document.createElement('div');
  dom.className = 'ai-toolbar-panel';

  // Styles
  dom.style.cssText = `
    display: flex;
    flex-direction: column;
    background: var(--ai-toolbar-bg);
    border-bottom: 1px solid var(--ai-toolbar-border);
  `;

  // AI Panel State
  const state: AIPanelState = {
    isProcessing: false,
    isStreaming: false,
    streamingContent: '',
    streamingReasoning: '',
    aiResult: null,
    aiReasoning: '',
    currentOperation: null,
    error: null,
    showReasoning: false,
    instructPrompt: null,
    stats: null,
  };
  
  let currentSampler = sampler;
  const SAFETY_MARGIN = 256; // Match AIService.SAFETY_MARGIN

  const toolbarContainer = document.createElement('div');
  toolbarContainer.className = 'ai-toolbar-controls';
  toolbarContainer.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    min-height: 44px;
  `;
  dom.appendChild(toolbarContainer);

  // Compact result chrome (thinking + actions). AI body text is an in-editor ghost.
  const resultContainer = document.createElement('div');
  resultContainer.className = 'ai-result-container';
  resultContainer.style.cssText = `
    display: none;
    flex-direction: column;
    padding: 8px 12px;
    border-top: 1px solid var(--ai-toolbar-border);
    background: var(--ai-toolbar-result-bg);
    max-height: min(40vh, 220px);
    overflow-y: auto;
  `;
  dom.appendChild(resultContainer);

  // Primary operations - colors reference CSS variables from index.css
  const primaryOps: { id: AIOperation; label: string; icon: string; color: string }[] = [
    { id: 'expand', label: 'Enhance', icon: '✨', color: 'var(--ai-toolbar-accent-primary)' },
    { id: 'rewrite', label: 'Rephrase', icon: '🔄', color: 'var(--ai-toolbar-accent-secondary)' },
    { id: 'instruct', label: 'Custom', icon: '💬', color: 'var(--ai-toolbar-accent-success)' },
  ];

  // Polish operations (in dropdown) - colors reference CSS variables from index.css
  const polishOps: { id: AIOperation; label: string; icon: string; color: string }[] = [
    { id: 'shorten', label: 'Shorten', icon: '✂️', color: 'var(--ai-toolbar-accent-warning)' },
    { id: 'lengthen', label: 'Lengthen', icon: '📄', color: 'var(--ai-toolbar-accent-info)' },
    { id: 'vivid', label: 'Vivid', icon: '🎨', color: 'var(--ai-toolbar-accent-pink)' },
    { id: 'emotion', label: 'Emotion', icon: '❤️', color: 'var(--ai-toolbar-accent-rose)' },
    { id: 'grammar', label: 'Fix', icon: '🪄', color: 'var(--ai-toolbar-accent-neutral)' },
  ];

  let hasSelection = false;
  let currentSelection: SelectionRange | null = null;
  let selectedText = '';
  let isInstructMode = false;
  let hasSamplerError = false;
  /** Set in destroy() so delayed rAF focus work cannot touch a dead view. */
  let panelDestroyed = false;
  /** Pending ensureEditorFocus / instruct focus frames — cancelled on destroy. */
  const pendingFocusRafs = new Set<number>();

  function scheduleFocusWork(work: () => void) {
    if (panelDestroyed) return;
    const id = requestAnimationFrame(() => {
      pendingFocusRafs.delete(id);
      if (panelDestroyed) return;
      work();
    });
    pendingFocusRafs.add(id);
  }

  /**
   * Keep keyboard shortcuts / Accept working after toolbar buttons are hidden.
   * Hiding the focused button (processing UI swap) drops focus to <body>, which
   * used to disable Mod-Enter / Escape until the user clicked the editor again.
   */
  function ensureEditorFocus() {
    if (panelDestroyed) return;
    // Leave the custom-instruction box alone while the user is typing there
    if (document.activeElement === instructInput) return;
    try {
      view.focus();
    } catch {
      // view may be mid-destroy
    }
  }

  /** True when focus is in a text field that is not part of this editor/panel. */
  function isForeignTextInput(el: EventTarget | null): boolean {
    if (!(el instanceof HTMLElement)) return false;
    if (dom.contains(el) || view.dom.contains(el)) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  /** Whether this panel should handle Accept/Reject shortcuts right now. */
  function shouldHandleAiShortcuts(e: KeyboardEvent): boolean {
    const hasSession =
      state.isProcessing || state.isStreaming || !!state.aiResult || !!state.error;
    if (!hasSession) return false;

    // Never hijack typing in unrelated inputs (chat, settings, etc.)
    if (isForeignTextInput(e.target) || isForeignTextInput(document.activeElement)) {
      return false;
    }

    // If another CodeMirror editor has focus, let that instance handle keys
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      const otherEditor = active.closest('.cm-editor');
      if (otherEditor && !view.dom.contains(active)) {
        return false;
      }
    }

    return true;
  }

  // Create button helper
  function createButton(
    op: { id: AIOperation; label: string; icon: string; color: string },
    isPrimary: boolean
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = `ai-toolbar-btn ai-toolbar-btn-${op.id}`;
    btn.innerHTML = `<span style="margin-right: 4px;">${op.icon}</span>${op.label}`;
    btn.style.cssText = `
      display: flex;
      align-items: center;
      padding: ${isPrimary ? '6px 12px' : '4px 8px'};
      font-size: ${isPrimary ? '13px' : '12px'};
      font-weight: 500;
      color: white;
      background: ${op.color};
      border: none;
      border-radius: 6px;
      cursor: pointer;
      opacity: 0.5;
      pointer-events: none;
      transition: opacity 0.2s, transform 0.1s;
    `;

    btn.addEventListener('click', () => {
      if (hasSelection && currentSelection) {
        // Close dropdown for polish operations
        if (!isPrimary) {
          dropdown.style.display = 'none';
        }
        onAction(op.id, selectedText, currentSelection);
        // Focus after the processing UI swaps (hidden button would otherwise blur to body)
        scheduleFocusWork(() => ensureEditorFocus());
      }
    });

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Keep editor focused instead of focusing the button
    });

    return btn;
  }

  // Custom instruction input (hidden by default)
  const instructContainer = document.createElement('div');
  instructContainer.className = 'ai-toolbar-instruct';
  instructContainer.style.cssText = 'display: none; align-items: center; gap: 6px; flex: 1; min-width: 200px;';

  const instructInput = document.createElement('textarea');
  instructInput.className = 'ai-toolbar-instruct-input';
  instructInput.placeholder = 'What would you like me to do?';
  instructInput.rows = 1;
  instructInput.style.cssText = `
    flex: 1;
    padding: 6px 10px;
    font-size: 13px;
    background: var(--ai-toolbar-input-bg);
    border: 1px solid var(--ai-toolbar-input-border);
    border-radius: 6px;
    color: var(--ai-toolbar-text);
    outline: none;
    resize: none;
    overflow-y: auto;
    min-height: 34px;
    max-height: 120px;
    font-family: inherit;
    line-height: 1.4;
  `;

  const instructSendBtn = document.createElement('button');
  instructSendBtn.className = 'ai-toolbar-instruct-send';
  instructSendBtn.innerHTML = 'Send';
  instructSendBtn.style.cssText = `
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 500;
    color: white;
    background: var(--ai-toolbar-accent-success);
    border: none;
    border-radius: 6px;
    cursor: pointer;
  `;

  const instructCancelBtn = document.createElement('button');
  instructCancelBtn.className = 'ai-toolbar-instruct-cancel';
  instructCancelBtn.innerHTML = 'Cancel';
  instructCancelBtn.style.cssText = `
    padding: 6px 10px;
    font-size: 12px;
    color: var(--ai-toolbar-text-secondary);
    background: transparent;
    border: 1px solid var(--ai-toolbar-input-border);
    border-radius: 6px;
    cursor: pointer;
  `;

  // Append input elements to instruct container
  instructContainer.appendChild(instructInput);
  instructContainer.appendChild(instructSendBtn);
  instructContainer.appendChild(instructCancelBtn);
  toolbarContainer.appendChild(instructContainer);

  // Add primary buttons
  const primaryContainer = document.createElement('div');
  primaryContainer.className = 'ai-toolbar-primary';
  primaryContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px;';

  const primaryButtons = new Map<AIOperation, HTMLButtonElement>();
  for (const op of primaryOps) {
    // Skip instruct button - we'll create it specially
    if (op.id === 'instruct') continue;
    const btn = createButton(op, true);
    primaryButtons.set(op.id, btn);
    primaryContainer.appendChild(btn);
  }

  // Create instruct button specially (without the default click handler)
  const instructBtn = document.createElement('button');
  instructBtn.className = 'ai-toolbar-btn ai-toolbar-btn-instruct';
  instructBtn.innerHTML = `<span style="margin-right: 4px;">💬</span>Custom`;
  instructBtn.style.cssText = `
    display: flex;
    align-items: center;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 500;
    color: white;
    background: var(--ai-toolbar-accent-success);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    opacity: 0.5;
    pointer-events: none;
    transition: opacity 0.2s, transform 0.1s;
  `;
  instructBtn.addEventListener('mousedown', (e) => {
    e.preventDefault(); // Prevent editor losing focus
  });
  instructBtn.addEventListener('click', () => {
    isInstructMode = true;
    updateState();
    instructInput.focus();
  });
  primaryButtons.set('instruct', instructBtn);
  primaryContainer.appendChild(instructBtn);

  toolbarContainer.appendChild(primaryContainer);

  // Handle instruct send
  const sendInstruct = () => {
    const prompt = instructInput.value.trim();
    if (!prompt) return;

    // Store the prompt in state for error recovery
    state.instructPrompt = prompt;
    isInstructMode = false;
    // Call the action with instruct operation and custom prompt
    // If no selection, pass empty text and use current cursor position
    const text = hasSelection ? selectedText : '';
    const selection = currentSelection ?? view.state.selection.main;
    onAction('instruct', text, selection, prompt);

    // Reset UI
    instructInput.value = '';
    updateState();
    // Leave the instruct textarea so shortcuts work during generation
    scheduleFocusWork(() => ensureEditorFocus());
  };

  instructSendBtn.addEventListener('click', sendInstruct);
  instructInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendInstruct();
    }
    if (e.key === 'Escape') {
      isInstructMode = false;
      instructInput.value = '';
      updateState();
    }
  });

  // Auto-grow textarea as user types
  instructInput.addEventListener('input', () => {
    instructInput.style.height = 'auto';
    const newHeight = Math.min(instructInput.scrollHeight, 120);
    instructInput.style.height = `${newHeight}px`;
  });

  // Handle instruct cancel
  instructCancelBtn.addEventListener('click', () => {
    isInstructMode = false;
    instructInput.value = '';
    updateState();
  });

  // Add "More" dropdown
  const moreBtn = document.createElement('button');
  moreBtn.className = 'ai-toolbar-btn-more';
  moreBtn.innerHTML = '▼ More';
  moreBtn.style.cssText = `
    display: flex;
    align-items: center;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 500;
    color: var(--ai-toolbar-text-secondary);
    background: transparent;
    border: 1px solid var(--ai-toolbar-input-border);
    border-radius: 6px;
    cursor: pointer;
    opacity: 0.5;
    pointer-events: none;
  `;

  // Dropdown menu — stacked above search panel via CSS (see index.css)
  const dropdown = document.createElement('div');
  dropdown.className = 'ai-toolbar-more-dropdown';

  const polishButtons = new Map<AIOperation, HTMLButtonElement>();
  for (const op of polishOps) {
    const btn = createButton(op, false);
    polishButtons.set(op.id, btn);
    dropdown.appendChild(btn);
  }

  const moreContainer = document.createElement('div');
  moreContainer.className = 'ai-toolbar-more';
  moreContainer.appendChild(moreBtn);
  moreContainer.appendChild(dropdown);
  toolbarContainer.appendChild(moreContainer);

  // Search button (magnifying glass)
  const searchBtn = document.createElement('button');
  searchBtn.className = 'ai-toolbar-btn-search';
  searchBtn.innerHTML = '🔍';
  searchBtn.title = 'Search & Replace (Ctrl+F)';
  searchBtn.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    font-size: 14px;
    background: transparent;
    border: 1px solid var(--ai-toolbar-input-border);
    border-radius: 6px;
    cursor: pointer;
    color: var(--ai-toolbar-text-secondary);
    transition: all 0.15s ease;
    margin-left: 4px;
  `;
  searchBtn.addEventListener('click', () => {
    toggleToolbarSearch(view);
  });
  searchBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  // Update search button appearance based on search panel state (matches aA button styling)
  const updateSearchButtonState = () => {
    const isOpen = view.state.field(searchPanelOpen);
    if (isOpen) {
      searchBtn.style.background = 'var(--ai-toolbar-active-bg)';
      searchBtn.style.borderColor = 'var(--ai-toolbar-active)';
      searchBtn.style.color = 'var(--ai-toolbar-active)';
    } else {
      searchBtn.style.background = 'transparent';
      searchBtn.style.borderColor = 'var(--ai-toolbar-input-border)';
      searchBtn.style.color = 'var(--ai-toolbar-text-secondary)';
    }
  };

  // Set initial state
  updateSearchButtonState();

  // Listen for search panel state changes - defer dispatch to avoid "update in progress" error
  const searchPanelListener = EditorView.updateListener.of((update) => {
    const wasOpen = update.startState.field(searchPanelOpen);
    const isOpen = update.state.field(searchPanelOpen);
    if (wasOpen !== isOpen) {
      updateSearchButtonState();
    }
  });
  
  // Defer the dispatch to avoid "update in progress" error
  const searchPanelTimer = setTimeout(() => {
    view.dispatch({ effects: StateEffect.appendConfig.of([searchPanelListener]) });
  }, 0);

  toolbarContainer.appendChild(searchBtn);

  const customActionContainers: HTMLElement[] = [];
  for (const action of toolbarActions) {
    const button = document.createElement('button');
    button.className = `ai-toolbar-btn-custom ai-toolbar-btn-custom-${action.id}`;
    button.textContent = action.label;
    button.title = action.title ?? action.label;
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
    button.addEventListener('click', () => {
      action.onClick(view);
    });
    button.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    toolbarContainer.appendChild(button);
    customActionContainers.push(button);
  }

  // Font size control (aA button with slider popup)
  let fontSizeBtn: HTMLElement | undefined;
  let fontSizeCleanup: (() => void) | undefined;
  if (onFontSizeChange) {
    const { button: fontSizeBtnContainer, cleanup } = createFontSizeControl(view, onFontSizeChange);
    fontSizeBtn = fontSizeBtnContainer;
    toolbarContainer.appendChild(fontSizeBtnContainer);
    fontSizeCleanup = cleanup;
  }

  // Abort button (shown during processing)
  const abortBtn = document.createElement('button');
  abortBtn.className = 'ai-toolbar-btn-abort';
  abortBtn.innerHTML = '⏹ Stop';
  abortBtn.title = 'Stop AI operation (Escape)';
  abortBtn.style.cssText = `
    display: none;
    align-items: center;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 500;
    color: white;
    background: var(--danger);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  `;
  abortBtn.addEventListener('click', () => {
    onAbort();
  });
  abortBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });
  toolbarContainer.appendChild(abortBtn);

  // Toggle dropdown
  moreBtn.addEventListener('click', () => {
    if (!hasSelection) return;
    const isOpen = dropdown.style.display === 'flex';
    dropdown.style.display = isOpen ? 'none' : 'flex';
  });

  moreBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  // Close dropdown when clicking outside
  const closeDropdownOnOutsideClick = (e: MouseEvent) => {
    if (!moreContainer.contains(e.target as Node)) {
      dropdown.style.display = 'none';
    }
  };
  document.addEventListener('click', closeDropdownOnOutsideClick);

  // Separator
  const separator = document.createElement('div');
  separator.className = 'ai-toolbar-separator';
  separator.style.cssText = 'width: 1px; height: 24px; background: var(--ai-toolbar-border); margin: 0 4px;';
  toolbarContainer.appendChild(separator);

  // Selection info
  const infoText = document.createElement('span');
  infoText.className = 'ai-toolbar-info';
  infoText.textContent = 'Select text to use AI';
  infoText.style.cssText = `
    font-size: 12px;
    color: var(--ai-toolbar-text-muted);
    margin-left: auto;
  `;
  toolbarContainer.appendChild(infoText);

  // Result container content elements
  const resultHeader = document.createElement('div');
  resultHeader.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  `;
  resultContainer.appendChild(resultHeader);

  const resultTitle = document.createElement('span');
  resultTitle.style.cssText = `
    font-size: 12px;
    font-weight: 600;
    color: var(--ai-toolbar-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `;
  resultHeader.appendChild(resultTitle);

  // Stats display (shown when result is complete)
  const resultStats = document.createElement('span');
  resultStats.style.cssText = `
    display: none;
    font-size: 11px;
    color: var(--ai-toolbar-text-muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    margin-left: auto;
    white-space: nowrap;
  `;
  resultHeader.appendChild(resultStats);

  const resultCloseBtn = document.createElement('button');
  resultCloseBtn.innerHTML = '✕';
  resultCloseBtn.style.cssText = `
    padding: 2px 6px;
    font-size: 14px;
    color: var(--ai-toolbar-text-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 4px;
  `;
  resultCloseBtn.addEventListener('click', () => {
    onReject();
  });
  resultHeader.appendChild(resultCloseBtn);

  // Error display
  const errorDisplay = document.createElement('div');
  errorDisplay.style.cssText = `
    display: none;
    padding: 8px 12px;
    background: var(--ai-toolbar-error-bg);
    border: 1px solid var(--ai-toolbar-error-border);
    border-radius: 6px;
    color: var(--ai-toolbar-error-text);
    font-size: 13px;
    margin-bottom: 8px;
  `;
  resultContainer.appendChild(errorDisplay);

  // Compact processing indicator (body text streams as an in-editor ghost)
  const processingIndicator = document.createElement('div');
  processingIndicator.style.cssText = `
    display: none;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    padding: 4px 0 8px;
    gap: 8px;
  `;
  processingIndicator.innerHTML = `
    <div style="
      width: 14px;
      height: 14px;
      border: 2px solid var(--ai-toolbar-input-border);
      border-top-color: var(--ai-toolbar-text-muted);
      border-radius: 50%;
      animation: ai-spin 1s linear infinite;
      flex-shrink: 0;
    "></div>
    <span style="font-size: 12px; color: var(--ai-toolbar-text-muted);">Writing in editor…</span>
    <style>
      @keyframes ai-spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;
  resultContainer.appendChild(processingIndicator);

  // Reasoning section (collapsible)
  const reasoningSection = document.createElement('div');
  reasoningSection.style.cssText = `
    display: none;
    margin-bottom: 8px;
    border: 1px solid var(--ai-toolbar-border);
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
  `;
  resultContainer.appendChild(reasoningSection);

  const reasoningHeader = document.createElement('button');
  reasoningHeader.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 8px 12px;
    background: var(--ai-toolbar-reasoning-bg);
    border: none;
    color: var(--ai-toolbar-text-muted);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  `;
  reasoningHeader.innerHTML = `
    <span style="display: flex; align-items: center; gap: 4px;">
      <span>✨</span> Thinking process
    </span>
    <span class="reasoning-toggle">Show</span>
  `;
  reasoningSection.appendChild(reasoningHeader);

  const reasoningContent = document.createElement('div');
  reasoningContent.style.cssText = `
    display: none;
    max-height: 150px;
    overflow-y: auto;
    padding: 8px 12px;
    background: var(--ai-toolbar-reasoning-bg);
    border-top: 1px solid var(--ai-toolbar-border);
  `;
  reasoningSection.appendChild(reasoningContent);

  const reasoningText = document.createElement('pre');
  reasoningText.style.cssText = `
    margin: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    color: var(--ai-toolbar-text-muted);
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
  `;
  reasoningContent.appendChild(reasoningText);

  // Toggle reasoning visibility
  reasoningHeader.addEventListener('click', () => {
    const isVisible = reasoningContent.style.display === 'block';
    reasoningContent.style.display = isVisible ? 'none' : 'block';
    const toggle = reasoningHeader.querySelector('.reasoning-toggle');
    if (toggle) toggle.textContent = isVisible ? 'Show' : 'Hide';
    state.showReasoning = !isVisible;
  });

  // Action buttons container (AI body is previewed in-editor as a ghost)
  const actionButtons = document.createElement('div');
  actionButtons.style.cssText = `
    display: none;
    gap: 8px;
    margin-top: 4px;
  `;
  resultContainer.appendChild(actionButtons);

  const isMacPlatform =
    typeof navigator !== 'undefined' &&
    (/Mac|iPhone|iPad|iPod/i.test(navigator.platform) ||
      // navigator.platform is deprecated; userAgentData is not everywhere yet
      (typeof navigator.userAgent === 'string' && /Mac OS X|Macintosh/i.test(navigator.userAgent)));
  const modShortcutLabel = isMacPlatform ? '⌘' : 'Ctrl';

  const acceptBtn = document.createElement('button');
  acceptBtn.innerHTML = '✓ Accept';
  acceptBtn.title = `Accept (${modShortcutLabel}+Enter)`;
  acceptBtn.setAttribute('aria-keyshortcuts', 'Control+Enter Meta+Enter');
  acceptBtn.style.cssText = `
    flex: 1;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    color: white;
    background: var(--ai-toolbar-accept-bg);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  `;
  acceptBtn.addEventListener('click', () => {
    onAccept();
    scheduleFocusWork(() => ensureEditorFocus());
  });
  acceptBtn.addEventListener('mousedown', (e) => {
    // Keep / restore editor focus so click + keyboard stay consistent
    e.preventDefault();
    ensureEditorFocus();
  });
  actionButtons.appendChild(acceptBtn);

  const rejectBtn = document.createElement('button');
  rejectBtn.innerHTML = '✕ Reject';
  rejectBtn.title = 'Reject (Escape)';
  rejectBtn.setAttribute('aria-keyshortcuts', 'Escape');
  rejectBtn.style.cssText = `
    flex: 1;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    color: var(--ai-toolbar-text);
    background: var(--ai-toolbar-btn-hover);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  `;
  rejectBtn.addEventListener('click', () => {
    onReject();
    scheduleFocusWork(() => ensureEditorFocus());
  });
  rejectBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    ensureEditorFocus();
  });
  actionButtons.appendChild(rejectBtn);

  // Shortcuts for this editor's AI session — work even when focus fell to <body>
  // after the processing UI hid the button that was focused.
  const onPanelKeyDown = (e: KeyboardEvent) => {
    if (panelDestroyed) return;
    const target = e.target as Node | null;

    // Don't steal Escape from the custom-instruction textarea (local cancel)
    if (
      e.key === 'Escape' &&
      target instanceof HTMLElement &&
      (target === instructInput || instructInput.contains(target))
    ) {
      return;
    }

    if (!shouldHandleAiShortcuts(e)) return;

    // Search panel owns Escape first
    if (e.key === 'Escape' && view.state.field(searchPanelOpen, false)) {
      e.preventDefault();
      e.stopPropagation();
      closeToolbarSearch(view);
      return;
    }

    const canAccept =
      !state.isProcessing && !state.isStreaming && !!state.aiResult && !state.error;
    const canDismiss =
      canAccept ||
      !!state.error ||
      state.isProcessing ||
      state.isStreaming;

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canAccept) {
      e.preventDefault();
      e.stopPropagation();
      onAccept();
      scheduleFocusWork(() => ensureEditorFocus());
      return;
    }

    if (e.key === 'Escape' && canDismiss) {
      // Prefer abort while running; reject/dismiss when done or on error
      e.preventDefault();
      e.stopPropagation();
      if (state.isProcessing || state.isStreaming) {
        onAbort();
      } else {
        onReject();
      }
      scheduleFocusWork(() => ensureEditorFocus());
    }
  };
  // Capture phase: still fire when focus is body or panel controls
  document.addEventListener('keydown', onPanelKeyDown, true);

  // Autoscroll only when the user has expanded thinking
  let prevReasoningLength = 0;
  let userScrolledReasoning = false;

  reasoningContent.addEventListener('scroll', () => {
    const isAtBottom =
      reasoningContent.scrollTop + reasoningContent.clientHeight >= reasoningContent.scrollHeight - 5;
    userScrolledReasoning = !isAtBottom;
  });

  // Update result chrome based on state (body text is an in-editor ghost)
  function updateResultDisplay() {
    const hasContent = state.isProcessing || state.isStreaming || state.aiResult || state.error;

    if (!hasContent) {
      resultContainer.style.display = 'none';
      return;
    }

    resultContainer.style.display = 'flex';

    // Update title / one-line status
    const opLabel = state.currentOperation
      ? { expand: 'Enhance', rewrite: 'Rephrase', instruct: 'Custom', shorten: 'Shorten', lengthen: 'Lengthen', vivid: 'Vivid', emotion: 'Emotion', grammar: 'Fix' }[state.currentOperation]
      : 'AI Result';
    if (state.error) {
      resultTitle.textContent = opLabel;
    } else if (state.isStreaming) {
      resultTitle.textContent = `${opLabel} · streaming…`;
    } else if (state.isProcessing) {
      resultTitle.textContent = `${opLabel} · working…`;
    } else if (state.aiResult) {
      resultTitle.textContent = `${opLabel} · ready`;
    } else {
      resultTitle.textContent = opLabel;
    }

    // Error display
    if (state.error) {
      errorDisplay.style.display = 'block';
      errorDisplay.textContent = state.error;
      processingIndicator.style.display = 'none';
      reasoningSection.style.display = 'none';
      actionButtons.style.display = 'none';
      return;
    } else {
      errorDisplay.style.display = 'none';
    }

    // Compact processing row until first stream tokens / while waiting
    processingIndicator.style.display =
      state.isProcessing && !state.isStreaming && !state.aiResult ? 'flex' : 'none';

    // Reasoning section — collapsed by default (user expands if they want thinking)
    const hasReasoning =
      (state.streamingReasoning?.trim()?.length ?? 0) > 0 ||
      (state.aiReasoning?.trim()?.length ?? 0) > 0;
    reasoningSection.style.display = hasReasoning ? 'block' : 'none';
    if (hasReasoning) {
      reasoningText.textContent = state.isStreaming ? state.streamingReasoning : state.aiReasoning;

      if (state.showReasoning) {
        reasoningContent.style.display = 'block';
        const toggle = reasoningHeader.querySelector('.reasoning-toggle');
        if (toggle) toggle.textContent = 'Hide';
      } else {
        reasoningContent.style.display = 'none';
        const toggle = reasoningHeader.querySelector('.reasoning-toggle');
        if (toggle) toggle.textContent = 'Show';
      }

      if (state.isStreaming && state.streamingReasoning && state.showReasoning) {
        const currentLength = state.streamingReasoning.length;
        if (currentLength > prevReasoningLength && !userScrolledReasoning) {
          requestAnimationFrame(() => {
            reasoningContent.scrollTop = reasoningContent.scrollHeight;
          });
        }
        prevReasoningLength = currentLength;
      }
    }

    // Stats display (only when complete and has result)
    const hasStats = state.stats && !state.isProcessing && !state.isStreaming && state.aiResult && !state.error;
    if (hasStats) {
      const s = state.stats!;
      const parts: string[] = [];
      if (typeof s.ttft === 'number') parts.push(`TTFT: ${s.ttft}ms`);
      if (typeof s.tokensPerSecond === 'number') parts.push(`T/S: ${s.tokensPerSecond.toFixed(2)}`);
      resultStats.textContent = parts.join(' ');
      resultStats.style.display = 'inline';
    } else {
      resultStats.style.display = 'none';
    }

    // Action buttons (only when complete and has result)
    const showActions = !state.isProcessing && !state.isStreaming && state.aiResult && !state.error;
    actionButtons.style.display = showActions ? 'flex' : 'none';

    if (!state.isStreaming) {
      prevReasoningLength = 0;
      userScrolledReasoning = false;
    }
  }

  // Update function - called when selection changes
  function updateState() {
    const selection = view.state.selection.main;
    hasSelection = selection.from !== selection.to;

    if (hasSelection) {
      currentSelection = selection;
      selectedText = view.state.doc.sliceString(selection.from, selection.to);
      const charCount = selectedText.length;
      const estimatedTokens = AIService.estimateTokens(selectedText);
      const limit = Math.max(0, currentSampler.contextLength - currentSampler.maxTokens - SAFETY_MARGIN);
      
      if (currentSampler.maxTokens >= currentSampler.contextLength) {
        infoText.textContent = `⚠️ Please adjust Max Tokens to be less than Context Length`;
        infoText.style.color = 'var(--ai-toolbar-error-text)';
        infoText.classList.add('warning');
        hasSelection = false;
        hasSamplerError = true;
      } else if (estimatedTokens > limit) {
        if (limit <= 0) {
          infoText.textContent = `⚠️ AI needs a larger context window`;
        } else {
          infoText.textContent = `⚠️ Selection is too long (${estimatedTokens}/${limit} tokens)`;
        }
        infoText.style.color = 'var(--ai-toolbar-error-text)';
        infoText.classList.add('warning');
        hasSelection = false; // Disable buttons
        hasSamplerError = true;
      } else {
        infoText.textContent = `${charCount} chars selected`;
        infoText.style.color = 'var(--ai-toolbar-text-muted)';
        infoText.classList.remove('warning');
        hasSamplerError = false;
      }
    } else {
      currentSelection = null;
      selectedText = '';
      if (!isInstructMode) {
        // Don't clear instruct mode if we're in it - user can still type their prompt
        instructInput.value = '';
      }
      // Keep sampler error state - it applies regardless of selection
      if (!hasSamplerError) {
        infoText.textContent = 'Select text to use AI';
        infoText.style.color = 'var(--ai-toolbar-text-muted)';
        infoText.classList.remove('warning');
      }
      dropdown.style.display = 'none';
    }

    // Show/hide abort button based on processing state
    if (state.isProcessing) {
      abortBtn.style.display = 'flex';
      instructContainer.style.display = 'none';
      primaryContainer.style.display = 'none';
      moreContainer.style.display = 'none';
      separator.style.display = 'none';
      infoText.style.display = 'none';
    } else if (isInstructMode) {
      abortBtn.style.display = 'none';
      instructContainer.style.display = 'flex';
      primaryContainer.style.display = 'none';
      moreContainer.style.display = 'none';
      separator.style.display = 'none';
      infoText.style.display = 'none';
    } else {
      abortBtn.style.display = 'none';
      instructContainer.style.display = 'none';
      primaryContainer.style.display = 'flex';
      moreContainer.style.display = 'block';
      const showInfo = infoText.classList.contains('warning');
      separator.style.display = showInfo ? 'block' : 'none';
      infoText.style.display = showInfo ? 'block' : 'none';
    }

    const isCompactCustomLayout = !state.isProcessing && isInstructMode;
    toolbarContainer.classList.toggle('ai-toolbar-instruct-mode', isCompactCustomLayout);
    searchBtn.style.display = isCompactCustomLayout || state.isProcessing ? 'none' : 'flex';
    for (const actionButton of customActionContainers) {
      actionButton.style.display = isCompactCustomLayout || state.isProcessing ? 'none' : 'flex';
    }
    if (fontSizeBtn) {
      fontSizeBtn.style.display = isCompactCustomLayout || state.isProcessing ? 'none' : 'flex';
    }

    // Update all buttons
    // When there's a sampler error, all buttons are disabled including Custom
    // When no sampler error, Custom is always available but other buttons need selection
    const opacity = hasSamplerError ? '0.5' : (hasSelection ? '1' : '0.5');
    const pointerEvents = hasSamplerError ? 'none' : (hasSelection ? 'auto' : 'none');

    for (const btn of primaryButtons.values()) {
      // Instruct button is always enabled unless there's a sampler error
      if (btn === instructBtn) {
        if (hasSamplerError) {
          btn.style.opacity = '0.5';
          btn.style.pointerEvents = 'none';
        } else {
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
        }
      } else {
        btn.style.opacity = opacity;
        btn.style.pointerEvents = pointerEvents;
      }
    }

    for (const btn of polishButtons.values()) {
      btn.style.opacity = opacity;
      btn.style.pointerEvents = pointerEvents;
    }

    moreBtn.style.opacity = opacity;
    moreBtn.style.pointerEvents = pointerEvents;
  }

  // AI state update function
  const updateAIState: AIStreamingCallback = (update) => {
    const wasProcessing = state.isProcessing;
    const hadResult = !!state.aiResult;
    if (update.isProcessing !== undefined) state.isProcessing = update.isProcessing;
    if (update.isStreaming !== undefined) state.isStreaming = update.isStreaming;
    if (update.streamingContent !== undefined) state.streamingContent = update.streamingContent;
    if (update.streamingReasoning !== undefined) state.streamingReasoning = update.streamingReasoning;
    if (update.aiResult !== undefined) state.aiResult = update.aiResult;
    if (update.aiReasoning !== undefined) state.aiReasoning = update.aiReasoning;
    if (update.currentOperation !== undefined) state.currentOperation = update.currentOperation;
    if (update.error !== undefined) state.error = update.error;
    if (update.instructPrompt !== undefined) state.instructPrompt = update.instructPrompt;
    if (update.stats !== undefined) state.stats = update.stats;
    // Clear stats / collapse thinking when a new operation starts
    if (update.isProcessing === true) {
      state.stats = null;
      state.showReasoning = false;
      reasoningContent.style.display = 'none';
      const toggle = reasoningHeader.querySelector('.reasoning-toggle');
      if (toggle) toggle.textContent = 'Show';
    }

    // If there's an error and we have a stored instruct prompt, restore instruct mode
    let restoredInstructMode = false;
    if (update.error && state.instructPrompt && state.currentOperation === 'instruct') {
      isInstructMode = true;
      instructInput.value = state.instructPrompt;
      restoredInstructMode = true;
      // Clear the stored prompt so we don't re-enter instruct mode on subsequent updates
      state.instructPrompt = null;
    }

    // Update toolbar button visibility when processing state changes or when we restored instruct mode
    if (wasProcessing !== state.isProcessing || restoredInstructMode) {
      updateState();
    }

    updateResultDisplay();

    // After UI swaps (ops hidden / Accept shown), reclaim focus so shortcuts work
    // without requiring a manual click into the editor.
    const startedProcessing = !wasProcessing && state.isProcessing;
    const finishedWithResult =
      wasProcessing &&
      !state.isProcessing &&
      !state.isStreaming &&
      !!state.aiResult &&
      !hadResult;
    const showedError =
      !!update.error && !state.isProcessing && !state.isStreaming;
    if (startedProcessing || finishedWithResult || showedError) {
      scheduleFocusWork(() => ensureEditorFocus());
    }

    // Error recovery: put the user back in the instruct box
    if (restoredInstructMode) {
      scheduleFocusWork(() => {
        if (!panelDestroyed) instructInput.focus();
      });
    }
  };

  // Initial state
  updateState();

  // Register the update function so it can be accessed from outside
  panelRegistry.set(view, updateAIState);

  // Return panel with update methods
  const panelInstance = {
    dom,
    top: true,
    update: updateState,
    updateState,
    updateAIState,
    updateSampler: (s: SamplerSettings) => {
      currentSampler = s;
      updateState();
    },
    destroy: () => {
      panelDestroyed = true;
      for (const id of pendingFocusRafs) {
        cancelAnimationFrame(id);
      }
      pendingFocusRafs.clear();
      document.removeEventListener('click', closeDropdownOnOutsideClick);
      document.removeEventListener('keydown', onPanelKeyDown, true);
      window.clearTimeout(searchPanelTimer);
      // Drop registry entry early so updateAIState closures are not retained
      // solely by the WeakMap until the EditorView is GC'd.
      panelRegistry.delete(view);
      if (fontSizeCleanup) {
        fontSizeCleanup();
      }
    },
  };

  // Store panel instance on DOM for useAIEditor to access
  (dom as unknown as { __panel: typeof panelInstance }).__panel = panelInstance;

  return panelInstance;
}

/**
 * View plugin to track selection changes and update toolbar
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function toolbarPanelPlugin(_onAction: AIToolbarActionCallback) {
  return ViewPlugin.fromClass(
    class {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_view: EditorView) {
        // Panel is created by showPanel, we just track updates
      }

      update(update: ViewUpdate) {
        if (update.selectionSet) {
          // Trigger panel update through registry
          const updateFunc = panelRegistry.get(update.view);
          if (updateFunc) {
            // Just trigger a re-render by calling with current state
            // The panel's internal update function handles selection changes
          }
        }
      }
    }
  );
}

/**
 * Create the AI toolbar panel extension
 * This adds a fixed panel at the top of the editor with AI action buttons
 * and result display with streaming support
 */
export function aiToolbarPanel(
  sampler: SamplerSettings,
  onAction: AIToolbarActionCallback,
  onAccept: () => void,
  onReject: () => void,
  onAbort: AIAbortCallback,
  onFontSizeChange?: FontSizeChangeCallback,
  toolbarActions: ToolbarActionConfig[] = [],
) {
  return [
    showPanel.of((view) => createToolbarPanel(view, sampler, onAction, onAccept, onReject, onAbort, onFontSizeChange, toolbarActions)),
    toolbarPanelPlugin(onAction),
  ];
}

/**
 * Helper to check if there's a meaningful selection
 */
export function hasSelection(view: EditorView): boolean {
  const sel = view.state.selection.main;
  return sel.from !== sel.to;
}

/**
 * Helper to get selected text
 */
export function getSelectedText(view: EditorView): string {
  const sel = view.state.selection.main;
  return view.state.doc.sliceString(sel.from, sel.to);
}

/**
 * Helper to get current selection range
 */
export function getCurrentSelection(view: EditorView): SelectionRange | null {
  const sel = view.state.selection.main;
  return sel.from !== sel.to ? sel : null;
}
