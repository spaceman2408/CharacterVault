/**
 * @fileoverview CodeMirror panel extension for AI toolbar.
 * Fixed panel at top of editor - no floating, no drag needed.
 * Includes AI result display with streaming support.
 * @module @editor/extensions/aiToolbarPanel
 */

import { EditorView, showPanel, type Panel, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { SelectionRange } from '@codemirror/state';
import { type AIOperation } from '../../components/ai/AIToolbar';
import { toggleToolbarSearch } from './toolbarSearch';
import { AIService } from '../../services/AIService';
import type { SamplerSettings } from '../../db/types';

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
}) => void;

/**
 * Callback for aborting AI operations
 */
export type AIAbortCallback = () => void;

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
  onAbort: AIAbortCallback
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
  };
  
  let currentSampler = sampler;
  const SAFETY_MARGIN = 100; // Match AIService.SAFETY_MARGIN

  const toolbarContainer = document.createElement('div');
  toolbarContainer.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    min-height: 44px;
  `;
  dom.appendChild(toolbarContainer);

  // Result container (hidden by default)
  const resultContainer = document.createElement('div');
  resultContainer.className = 'ai-result-container';
  resultContainer.style.cssText = `
    display: none;
    flex-direction: column;
    padding: 12px;
    border-top: 1px solid var(--ai-toolbar-border);
    background: var(--ai-toolbar-result-bg);
    max-height: 500px;
    overflow-y: auto;
  `;
  dom.appendChild(resultContainer);

  // Primary operations - colors reference CSS variables from index.css
  const primaryOps: { id: AIOperation; label: string; icon: string; color: string }[] = [
    { id: 'expand', label: 'Enhance', icon: '✨', color: 'var(--ai-toolbar-accent-primary, #7c3aed)' },
    { id: 'rewrite', label: 'Rephrase', icon: '🔄', color: 'var(--ai-toolbar-accent-secondary, #2563eb)' },
    { id: 'instruct', label: 'Custom', icon: '💬', color: 'var(--ai-toolbar-accent-success, #059669)' },
  ];

  // Polish operations (in dropdown) - colors reference CSS variables from index.css
  const polishOps: { id: AIOperation; label: string; icon: string; color: string }[] = [
    { id: 'shorten', label: 'Shorten', icon: '✂️', color: 'var(--ai-toolbar-accent-warning, #d97706)' },
    { id: 'lengthen', label: 'Lengthen', icon: '📄', color: 'var(--ai-toolbar-accent-info, #0891b2)' },
    { id: 'vivid', label: 'Vivid', icon: '🎨', color: 'var(--ai-toolbar-accent-pink, #db2777)' },
    { id: 'emotion', label: 'Emotion', icon: '❤️', color: 'var(--ai-toolbar-accent-rose, #e11d48)' },
    { id: 'grammar', label: 'Fix', icon: '🪄', color: 'var(--ai-toolbar-accent-neutral, #475569)' },
  ];

  let hasSelection = false;
  let currentSelection: SelectionRange | null = null;
  let selectedText = '';
  let isInstructMode = false;

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
      }
    });

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent editor losing focus
    });

    return btn;
  }

  // Custom instruction input (hidden by default)
  const instructContainer = document.createElement('div');
  instructContainer.style.cssText = 'display: none; align-items: center; gap: 6px; flex: 1; min-width: 200px;';

  const instructInput = document.createElement('input');
  instructInput.type = 'text';
  instructInput.placeholder = 'What would you like me to do?';
  instructInput.style.cssText = `
    flex: 1;
    padding: 6px 10px;
    font-size: 13px;
    background: var(--ai-toolbar-input-bg);
    border: 1px solid var(--ai-toolbar-input-border);
    border-radius: 6px;
    color: var(--ai-toolbar-text);
    outline: none;
  `;

  const instructSendBtn = document.createElement('button');
  instructSendBtn.innerHTML = 'Send';
  instructSendBtn.style.cssText = `
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 500;
    color: white;
    background: var(--ai-toolbar-accent-success, #059669);
    border: none;
    border-radius: 6px;
    cursor: pointer;
  `;

  const instructCancelBtn = document.createElement('button');
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
    background: var(--ai-toolbar-accent-success, #059669);
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
    if (!hasSelection) return;
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
    if (!prompt || !hasSelection || !currentSelection) return;

    isInstructMode = false;
    // Call the action with instruct operation and custom prompt
    onAction('instruct', selectedText, currentSelection, prompt);

    // Reset UI
    instructInput.value = '';
    updateState();
  };

  instructSendBtn.addEventListener('click', sendInstruct);
  instructInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendInstruct();
    if (e.key === 'Escape') {
      isInstructMode = false;
      instructInput.value = '';
      updateState();
    }
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

  // Dropdown menu
  const dropdown = document.createElement('div');
  dropdown.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background: var(--ai-toolbar-bg);
    border: 1px solid var(--ai-toolbar-border);
    border-radius: 6px;
    padding: 4px;
    display: none;
    flex-direction: column;
    gap: 2px;
    z-index: 100;
    min-width: 120px;
  `;

  const polishButtons = new Map<AIOperation, HTMLButtonElement>();
  for (const op of polishOps) {
    const btn = createButton(op, false);
    polishButtons.set(op.id, btn);
    dropdown.appendChild(btn);
  }

  const moreContainer = document.createElement('div');
  moreContainer.style.cssText = 'position: relative;';
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
  toolbarContainer.appendChild(searchBtn);

  // Abort button (shown during processing)
  const abortBtn = document.createElement('button');
  abortBtn.className = 'ai-toolbar-btn-abort';
  abortBtn.innerHTML = '⏹ Stop';
  abortBtn.title = 'Stop AI operation';
  abortBtn.style.cssText = `
    display: none;
    align-items: center;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 500;
    color: white;
    background: #dc2626;
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
  document.addEventListener('click', (e) => {
    if (!moreContainer.contains(e.target as Node)) {
      dropdown.style.display = 'none';
    }
  });

  // Separator
  const separator = document.createElement('div');
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
    justify-content: space-between;
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

  // Processing indicator
  const processingIndicator = document.createElement('div');
  processingIndicator.style.cssText = `
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    gap: 12px;
  `;
  processingIndicator.innerHTML = `
    <div style="
      width: 32px;
      height: 32px;
      border: 3px solid var(--ai-toolbar-input-border);
      border-top-color: var(--ai-toolbar-text-muted);
      border-radius: 50%;
      animation: ai-spin 1s linear infinite;
    "></div>
    <span style="font-size: 13px; color: var(--ai-toolbar-text-muted);">AI is working...</span>
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

  // Content display
  const contentDisplay = document.createElement('div');
  contentDisplay.style.cssText = `
    display: none;
    padding: 12px;
    background: var(--ai-toolbar-bg);
    border: 1px solid var(--ai-toolbar-border);
    border-radius: 6px;
    margin-bottom: 12px;
  `;
  resultContainer.appendChild(contentDisplay);

  const contentText = document.createElement('p');
  contentText.style.cssText = `
    margin: 0;
    font-size: 13px;
    color: var(--ai-toolbar-text);
    white-space: pre-wrap;
    line-height: 1.6;
  `;
  contentDisplay.appendChild(contentText);

  // Streaming cursor
  const streamingCursor = document.createElement('span');
  streamingCursor.style.cssText = `
    display: inline-block;
    width: 2px;
    height: 1.2em;
    background: var(--ai-toolbar-text-muted);
    margin-left: 2px;
    animation: ai-blink 1s step-end infinite;
    vertical-align: text-bottom;
  `;
  streamingCursor.innerHTML = `
    <style>
      @keyframes ai-blink {
        50% { opacity: 0; }
      }
    </style>
  `;

  // Action buttons container
  const actionButtons = document.createElement('div');
  actionButtons.style.cssText = `
    display: none;
    gap: 8px;
  `;
  resultContainer.appendChild(actionButtons);

  const acceptBtn = document.createElement('button');
  acceptBtn.innerHTML = '✓ Accept';
  acceptBtn.style.cssText = `
    flex: 1;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    color: white;
    background: var(--ai-toolbar-accept-bg, #16a34a);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  `;
  acceptBtn.addEventListener('click', () => {
    onAccept();
  });
  acceptBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });
  actionButtons.appendChild(acceptBtn);

  const rejectBtn = document.createElement('button');
  rejectBtn.innerHTML = '✕ Reject';
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
  });
  rejectBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });
  actionButtons.appendChild(rejectBtn);

  // Track previous content lengths for autoscroll detection
  let prevReasoningLength = 0;
  let prevContentLength = 0;
  let userScrolled = false;

  // Detect user scroll in result container
  resultContainer.addEventListener('scroll', () => {
    // Check if user scrolled up (not at bottom)
    const isAtBottom = resultContainer.scrollTop + resultContainer.clientHeight >= resultContainer.scrollHeight - 10;
    userScrolled = !isAtBottom;
  });

  // Detect user scroll in reasoning content
  reasoningContent.addEventListener('scroll', () => {
    const isAtBottom = reasoningContent.scrollTop + reasoningContent.clientHeight >= reasoningContent.scrollHeight - 5;
    if (!isAtBottom) {
      userScrolled = true;
    }
  });

  // Update result display based on state
  function updateResultDisplay() {
    const hasContent = state.isProcessing || state.isStreaming || state.aiResult || state.error;

    if (!hasContent) {
      resultContainer.style.display = 'none';
      return;
    }

    resultContainer.style.display = 'flex';

    // Update title
    const opLabel = state.currentOperation
      ? { expand: 'Enhance', rewrite: 'Rephrase', instruct: 'Custom', shorten: 'Shorten', lengthen: 'Lengthen', vivid: 'Vivid', emotion: 'Emotion', grammar: 'Fix' }[state.currentOperation]
      : 'AI Result';
    resultTitle.textContent = state.isStreaming ? `${opLabel}...` : opLabel;

    // Error display
    if (state.error) {
      errorDisplay.style.display = 'block';
      errorDisplay.textContent = state.error;
      processingIndicator.style.display = 'none';
      reasoningSection.style.display = 'none';
      contentDisplay.style.display = 'none';
      actionButtons.style.display = 'none';
      return;
    } else {
      errorDisplay.style.display = 'none';
    }

    // Processing indicator
    processingIndicator.style.display = state.isProcessing && !state.isStreaming ? 'flex' : 'none';

    // Reasoning section
    const hasReasoning = (state.streamingReasoning?.trim()?.length ?? 0) > 0 || (state.aiReasoning?.trim()?.length ?? 0) > 0;
    reasoningSection.style.display = hasReasoning ? 'block' : 'none';
    if (hasReasoning) {
      reasoningText.textContent = state.isStreaming ? state.streamingReasoning : state.aiReasoning;

      // Auto-expand during streaming and keep expanded after
      if (state.isStreaming && !state.showReasoning) {
        reasoningContent.style.display = 'block';
        const toggle = reasoningHeader.querySelector('.reasoning-toggle');
        if (toggle) toggle.textContent = 'Hide';
        state.showReasoning = true; // Remember that we auto-expanded it
      } else if (!state.isStreaming && state.aiReasoning && state.showReasoning) {
        // Keep reasoning visible after streaming completes
        reasoningContent.style.display = 'block';
        const toggle = reasoningHeader.querySelector('.reasoning-toggle');
        if (toggle) toggle.textContent = 'Hide';
      }

      // Autoscroll reasoning content during streaming
      if (state.isStreaming && state.streamingReasoning) {
        const currentLength = state.streamingReasoning.length;
        if (currentLength > prevReasoningLength && !userScrolled) {
          requestAnimationFrame(() => {
            reasoningContent.scrollTop = reasoningContent.scrollHeight;
          });
        }
        prevReasoningLength = currentLength;
      }
    }

    // Content display
    const displayContent = state.isStreaming ? state.streamingContent : (state.aiResult || '');
    if (displayContent) {
      contentDisplay.style.display = 'block';
      contentText.textContent = displayContent;
      if (state.isStreaming) {
        contentText.appendChild(streamingCursor);
      }

      // Autoscroll content during streaming
      if (state.isStreaming && state.streamingContent) {
        const currentLength = state.streamingContent.length;
        if (currentLength > prevContentLength && !userScrolled) {
          requestAnimationFrame(() => {
            contentDisplay.scrollTop = contentDisplay.scrollHeight;
            // Also scroll the main result container to ensure content is visible
            resultContainer.scrollTop = resultContainer.scrollHeight;
          });
        }
        prevContentLength = currentLength;
      }
    } else {
      contentDisplay.style.display = 'none';
    }

    // Action buttons (only when complete and has result)
    const showActions = !state.isProcessing && !state.isStreaming && state.aiResult && !state.error;
    actionButtons.style.display = showActions ? 'flex' : 'none';

    // Final scroll to bottom when streaming completes
    if (!state.isStreaming && (state.aiResult || state.aiReasoning)) {
      requestAnimationFrame(() => {
        reasoningContent.scrollTop = reasoningContent.scrollHeight;
        contentDisplay.scrollTop = contentDisplay.scrollHeight;
        resultContainer.scrollTop = resultContainer.scrollHeight;
      });
      // Reset tracking variables when done
      prevReasoningLength = 0;
      prevContentLength = 0;
      userScrolled = false;
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
        infoText.style.color = 'var(--ai-toolbar-error-text, #ef4444)';
        infoText.classList.add('warning');
        hasSelection = false;
      } else if (estimatedTokens > limit) {
        if (limit <= 0) {
          infoText.textContent = `⚠️ AI needs a larger context window`;
        } else {
          infoText.textContent = `⚠️ Selection is too long (${estimatedTokens}/${limit} tokens)`;
        }
        infoText.style.color = 'var(--ai-toolbar-error-text, #ef4444)';
        infoText.classList.add('warning');
        hasSelection = false; // Disable buttons
      } else {
        infoText.textContent = `${charCount} chars selected`;
        infoText.style.color = 'var(--ai-toolbar-text-muted)';
        infoText.classList.remove('warning');
      }
    } else {
      currentSelection = null;
      selectedText = '';
      isInstructMode = false;
      instructInput.value = '';
      infoText.textContent = 'Select text to use AI';
      infoText.style.color = 'var(--ai-toolbar-text-muted)';
      infoText.classList.remove('warning');
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
      separator.style.display = 'block';
      infoText.style.display = 'block';
    }

    // Update all buttons
    const opacity = hasSelection ? '1' : '0.5';
    const pointerEvents = hasSelection ? 'auto' : 'none';

    for (const btn of primaryButtons.values()) {
      btn.style.opacity = opacity;
      btn.style.pointerEvents = pointerEvents;
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
    if (update.isProcessing !== undefined) state.isProcessing = update.isProcessing;
    if (update.isStreaming !== undefined) state.isStreaming = update.isStreaming;
    if (update.streamingContent !== undefined) state.streamingContent = update.streamingContent;
    if (update.streamingReasoning !== undefined) state.streamingReasoning = update.streamingReasoning;
    if (update.aiResult !== undefined) state.aiResult = update.aiResult;
    if (update.aiReasoning !== undefined) state.aiReasoning = update.aiReasoning;
    if (update.currentOperation !== undefined) state.currentOperation = update.currentOperation;
    if (update.error !== undefined) state.error = update.error;

    // Update toolbar button visibility when processing state changes
    if (wasProcessing !== state.isProcessing) {
      updateState();
    }

    updateResultDisplay();
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
    }
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
  onAbort: AIAbortCallback
) {
  return [
    showPanel.of((view) => createToolbarPanel(view, sampler, onAction, onAccept, onReject, onAbort)),
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
