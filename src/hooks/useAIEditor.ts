/**
 * @fileoverview Shared hook for AI-powered CodeMirror editors.
 * Encapsulates all CodeMirror setup, AI toolbar integration, and AI operation handling.
 * @module @hooks/useAIEditor
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { EditorView, drawSelection, keymap, ViewUpdate } from '@codemirror/view';
import { Compartment, EditorState, Prec } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, insertTab, indentLess } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import type { CharacterSection } from '../db/characterTypes';
import type { SamplerSettings, AIConfig, PromptSettings, AIOperation } from '../db/characterTypes';
import { aiToolbarPanel, getPanelUpdateFunction } from '../editor/extensions/aiToolbarPanel';
import type { ToolbarActionConfig } from '../editor/extensions/aiToolbarPanel';
import {
  aiGhostPreview,
  setAIGhostPreview,
  updateAIGhostPreview,
  clearAIGhostPreview,
} from '../editor/extensions/aiGhostPreview';
import { normalizeHtmlEntitiesInView } from '../editor/extensions/normalizeHtmlEntities';
import { searchPanelOpen, toolbarSearch, toolbarSearchTheme } from '../editor/extensions/toolbarSearch';
import { themeSync } from '../editor/extensions/themeSync';
import { fontSizeExtension, setFontSize, editorFontSizeField, DEFAULT_FONT_SIZE } from '../editor/extensions/fontSizeControl';
import { characterMacroHelper } from '../editor/extensions/characterMacroHelper';
import { spellcheckExtension, setSpellcheckSettings } from '../editor/extensions/spellcheck';
import type { SpellcheckSettings } from '../db/characterTypes';
import { DEFAULT_SPELLCHECK_SETTINGS } from '../db/characterTypes';
import { AIService, AIError, estimateTokens } from '../services/AIService';
import { getProviderSelectionId } from '../services/providers';
import { showEphemeralToast } from '../utils/ephemeralToast';

/** Locked editor range for the current AI op (accept replaces this, not the live caret). */
type SelectionLock = { from: number; to: number; text: string };

/**
 * Map a locked range through document changes so Accept stays on the original span
 * even if the user types elsewhere while the AI is running.
 */
function mapSelectionLock(
  lock: SelectionLock,
  changes: { mapPos: (pos: number, assoc?: number) => number },
): SelectionLock {
  const from = changes.mapPos(lock.from, 1);
  const to = changes.mapPos(lock.to, -1);
  return {
    from: Math.min(from, to),
    to: Math.max(from, to),
    text: lock.text,
  };
}

/** Clamp a locked range into the current document bounds. */
function clampSelectionLock(lock: SelectionLock, docLength: number): SelectionLock {
  const from = Math.max(0, Math.min(lock.from, docLength));
  const to = Math.max(from, Math.min(lock.to, docLength));
  return { from, to, text: lock.text };
}

/** Count leading `\n` characters (after CRLF normalization). */
function countLeadingNewlines(s: string): number {
  let n = 0;
  while (n < s.length && s[n] === '\n') n += 1;
  return n;
}

/** Count trailing `\n` characters (after CRLF normalization). */
function countTrailingNewlines(s: string): number {
  let n = 0;
  while (n < s.length && s[s.length - 1 - n] === '\n') n += 1;
  return n;
}

/**
 * Match AI replacement newline boundaries to the original selection.
 *
 * Models often emit extra leading/trailing newlines. Selections can also
 * invisibly include the newline before a line (looks like the line is
 * selected, but `from` is the previous `\n`). If we only strip when the
 * original has *no* leading newline, `\n` + AI's `\n- item` becomes a blank
 * line between bullets. Instead: strip all edge newlines from the AI text,
 * then re-apply exactly the original's leading/trailing counts.
 */
function normalizeAiEditText(original: string, replacement: string): string {
  const orig = original.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let next = replacement.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const leadOrig = countLeadingNewlines(orig);
  const trailOrig = countTrailingNewlines(orig);

  next = next.replace(/^\n+/, '').replace(/\n+$/, '');

  // Drop leading whitespace-only lines the model invents (not present in original)
  if (leadOrig === 0) {
    next = next.replace(/^(?:[ \t\u00A0]*\n)+/, '');
  }
  if (trailOrig === 0) {
    next = next.replace(/(?:\n[ \t\u00A0]*)+$/, '');
  }

  return `${'\n'.repeat(leadOrig)}${next}${'\n'.repeat(trailOrig)}`;
}

const defaultToolbarActions: ToolbarActionConfig[] = [
  {
    id: 'normalize-entities',
    label: ';&',
    title: 'Normalize HTML entities in the selection, or the whole document if nothing is selected',
    onClick: normalizeHtmlEntitiesInView,
  },
];

export interface UseAIEditorOptions {
  /** Key to force re-initialization when changed (e.g., section ID) */
  key?: string;
  /** Initial document content */
  value: string;
  /** Callback when document changes (backward-compatible persist callback) */
  onChange?: (value: string) => void;
  /** Callback for immediate local updates while typing */
  onImmediateChange?: (value: string) => void;
  /** Callback for persisted updates (debounced by default) */
  onPersistChange?: (value: string) => Promise<void> | void;
  /** Save strategy for persist callback */
  saveMode?: 'immediate' | 'debounced';
  /** Debounce interval for persist callback when saveMode is debounced */
  saveDebounceMs?: number;
  /** Callback when text is selected */
  setSelectedText: (text: string) => void;
  /** AI configuration */
  aiConfig: AIConfig;
  /** Sampler settings for AI */
  samplerSettings: SamplerSettings;
  /** Prompt settings for AI */
  promptSettings: PromptSettings;
  /** Function to get context content for AI operations */
  getContextContent: (sectionIds: CharacterSection[]) => string[];
  /** IDs of sections to include in context */
  contextSectionIds: CharacterSection[];
  /** Minimum height for the editor content area */
  minHeight?: string;
  /** Optional max height for the editor scroller (useful for nested/mobile cards) */
  maxHeight?: string;
  /** Additional CSS styles for the editor */
  editorStyles?: Record<string, string>;
  /** Whether the editor is currently active/visible */
  isActive?: boolean;
  /** Initial font size for the editor (defaults to 16) */
  fontSize?: number;
  /** Callback when font size changes (for persistence) */
  onFontSizeChange?: (size: number) => void;
  /** Optional custom toolbar actions shown next to the standard editor controls */
  toolbarActions?: ToolbarActionConfig[];
  /** Additional CodeMirror extensions (e.g., language modes) to include in the editor */
  additionalExtensions?: Extension[];
  /**
   * Spellcheck settings (enabled, language, ignored/custom words).
   * When omitted, defaults to `DEFAULT_SPELLCHECK_SETTINGS` (enabled, English).
   */
  spellcheck?: SpellcheckSettings;
  /**
   * Language mode of the editor being spellchecked. Defaults to `'prose'`.
   * - `'prose'`: skip only the tokenizer's ignore rules
   * - `'html'`: also skip tokens inside HTML tags / attribute values (use with
   *   a host that runs `@codemirror/lang-html`)
   * - `'json'`: also skip JSON property keys (use with a host that runs
   *   `@codemirror/lang-json`)
   */
  spellcheckMode?: 'prose' | 'html' | 'json';
}

export interface UseAIEditorReturn {
  /** Ref to attach to the editor container div */
  editorRef: React.RefObject<HTMLDivElement | null>;
  /** Current editor view (for advanced operations) */
  view: EditorView | null;
  /** Current selection info */
  selection: { from: number; to: number; text: string } | null;
  /** Whether an AI operation is in progress */
  isProcessing: boolean;
  /** Whether AI is currently streaming */
  isStreaming: boolean;
  /** Current AI operation type */
  currentOperation: AIOperation | null;
  /** Current AI result (if complete) */
  aiResult: string | null;
  /** Accept the current AI result and replace selected text */
  accept: () => void;
  /** Reject the current AI result */
  reject: () => void;
  /** Manually update the editor content */
  setContent: (content: string) => void;
}

/**
 * Shared hook for AI-powered CodeMirror editors.
 * Encapsulates all the boilerplate for:
 * - CodeMirror setup with keymaps, history, and theme
 * - AI toolbar panel integration
 * - AI operation handling (expand, rewrite, instruct, etc.)
 * - Accept/reject functionality
 * - Selection tracking
 */
export function useAIEditor(options: UseAIEditorOptions): UseAIEditorReturn {
  const {
    key,
    value,
    onChange,
    onImmediateChange,
    onPersistChange,
    saveMode = 'immediate',
    saveDebounceMs = 250,
    setSelectedText,
    aiConfig,
    samplerSettings,
    promptSettings,
    getContextContent,
    contextSectionIds,
    minHeight = '100px',
    maxHeight,
    editorStyles = {},
    isActive = true,
    fontSize,
    onFontSizeChange,
    toolbarActions = defaultToolbarActions,
    additionalExtensions,
    spellcheck = DEFAULT_SPELLCHECK_SETTINGS,
    spellcheckMode = 'prose',
  } = options;

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  /** Toggles EditorState.readOnly for the open AI decision session. */
  const readOnlyCompartmentRef = useRef(new Compartment());
  const panelUpdateRef = useRef<((update: {
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
  }) => void) | null>(null);
  const aiServiceRef = useRef<AIService | null>(null);
  /** False after the hook unmounts — blocks React setState / panel updates. */
  const isMountedRef = useRef(true);
  /**
   * Bumped when a request is superseded (new op, editor teardown, unmount).
   * In-flight completions with a stale id must not touch UI/state.
   */
  const requestGenerationRef = useRef(0);

  // AI operation state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<AIOperation | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  // Streaming buffers stored in refs to avoid re-render thrashing
  const streamingContentRef = useRef('');
  const streamingReasoningRef = useRef('');
  const aiReasoningRef = useRef('');
  const errorRef = useRef<string | null>(null);
  const lastInstructPromptRef = useRef<string | null>(null);
  const [selection, setSelection] = useState<{ from: number; to: number; text: string } | null>(null);

  // Use refs to avoid closure issues with callbacks
  const aiResultRef = useRef<string | null>(null);
  /** Live caret/selection for UI — may change while AI runs. */
  const selectionRef = useRef<{ from: number; to: number; text: string } | null>(null);
  /**
   * Frozen range from AI op start until accept/reject/cancel.
   * Accept always replaces this (mapped through edits), never the live caret.
   */
  const selectionLockRef = useRef<SelectionLock | null>(null);
  const isProcessingRef = useRef(false);
  const currentOperationRef = useRef<AIOperation | null>(null);
  const contextSectionIdsRef = useRef<CharacterSection[]>(contextSectionIds);
  const persistTimeoutRef = useRef<number | null>(null);
  const pendingPersistValueRef = useRef<string | null>(null);
  const isApplyingExternalSyncRef = useRef(false);
  const isFocusedRef = useRef(false);
  const isLocallyDirtyRef = useRef(false);
  const acceptRef = useRef<() => void>(() => {});
  const rejectRef = useRef<() => void>(() => {});
  const abortRef = useRef<() => void>(() => {});

  const clearSelectionLock = useCallback(() => {
    selectionLockRef.current = null;
  }, []);

  /** Cancel debounce timer so a pre-session keystroke cannot flush mid-AI. */
  const holdPersistForAiSession = useCallback(() => {
    if (persistTimeoutRef.current !== null) {
      window.clearTimeout(persistTimeoutRef.current);
      persistTimeoutRef.current = null;
    }
  }, []);

  /**
   * During an AI session the doc is read-only for user input (caret/scroll still work).
   * Programmatic Accept still applies changes; this just blocks interleaved typing.
   */
  const setEditorReadOnlyForAi = useCallback((readOnly: boolean) => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure(
        EditorState.readOnly.of(readOnly),
      ),
    });
  }, []);

  const dispatchClearGhost = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: clearAIGhostPreview.of(null) });
  }, []);

  const dispatchGhostPreview = useCallback((
    from: number,
    to: number,
    content: string,
    isStreaming: boolean,
  ) => {
    const view = viewRef.current;
    if (!view) return;
    // Collapse the native selection so its mid-line bars don't paint under/over
    // the ghost card (especially ugly for multi-paragraph mid-line starts).
    view.dispatch({
      selection: { anchor: from, head: from },
      effects: setAIGhostPreview.of({ from, to, content, isStreaming }),
    });
  }, []);

  const dispatchGhostContent = useCallback((content: string, isStreaming: boolean) => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: updateAIGhostPreview.of({ content, isStreaming }),
    });
  }, []);

  /**
   * Abort the in-flight AI request (if any) and invalidate its generation so a
   * late resolve/reject cannot update React state or a destroyed panel.
   */
  const abortInFlightRequest = useCallback((reason: 'unmount' | 'editor-teardown' | 'superseded') => {
    requestGenerationRef.current += 1;
    const service = aiServiceRef.current;
    if (service) {
      console.log(`[useAIEditor] Aborting in-flight AI request (${reason})`);
      service.abort();
      aiServiceRef.current = null;
    }
  }, []);

  // Keep refs in sync with state
  useEffect(() => {
    aiResultRef.current = aiResult;
  }, [aiResult]);

  useEffect(() => {
    // Don't let live React selection overwrite the lock used by Accept
    if (!selectionLockRef.current) {
      selectionRef.current = selection;
    }
  }, [selection]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    currentOperationRef.current = currentOperation;
  }, [currentOperation]);

  useEffect(() => {
    contextSectionIdsRef.current = contextSectionIds;
  }, [contextSectionIds]);

  // Use refs to always have access to the latest config/sampler/prompts
  // These avoid stale closures when the CodeMirror toolbar panel captures
  // handleAIOperation during editor initialization and doesn't re-capture it.
  const aiConfigRef = useRef(aiConfig);
  const samplerSettingsRef = useRef(samplerSettings);
  const promptSettingsRef = useRef(promptSettings);
  useEffect(() => {
    aiConfigRef.current = aiConfig;
  }, [aiConfig]);
  useEffect(() => {
    samplerSettingsRef.current = samplerSettings;
  }, [samplerSettings]);
  useEffect(() => {
    promptSettingsRef.current = promptSettings;
  }, [promptSettings]);

  // Use refs to always have access to the latest callbacks/options
  const onImmediateChangeRef = useRef(onImmediateChange);
  const onPersistChangeRef = useRef(onPersistChange ?? onChange);
  const saveModeRef = useRef(saveMode);
  const saveDebounceMsRef = useRef(saveDebounceMs);
  useEffect(() => {
    onImmediateChangeRef.current = onImmediateChange;
  }, [onImmediateChange]);

  useEffect(() => {
    onPersistChangeRef.current = onPersistChange ?? onChange;
  }, [onPersistChange, onChange]);

  useEffect(() => {
    saveModeRef.current = saveMode;
  }, [saveMode]);

  useEffect(() => {
    saveDebounceMsRef.current = saveDebounceMs;
  }, [saveDebounceMs]);

  const runPersist = useCallback((nextValue: string) => {
    const persistFn = onPersistChangeRef.current;
    if (!persistFn) return;
    void Promise.resolve(persistFn(nextValue));
  }, []);

  const flushPendingPersist = useCallback(() => {
    if (persistTimeoutRef.current !== null) {
      window.clearTimeout(persistTimeoutRef.current);
      persistTimeoutRef.current = null;
    }

    const pendingValue = pendingPersistValueRef.current;
    if (pendingValue === null) return;

    pendingPersistValueRef.current = null;
    runPersist(pendingValue);
  }, [runPersist]);

  /**
   * After an AI session ends, persist the current document once so mid-session
   * typing (held while the session was open) is not lost.
   */
  const flushPersistAfterAiSession = useCallback(() => {
    const view = viewRef.current;
    if (view) {
      pendingPersistValueRef.current = view.state.doc.toString();
    }
    flushPendingPersist();
  }, [flushPendingPersist]);

  const schedulePersist = useCallback((nextValue: string) => {
    if (!onPersistChangeRef.current) return;

    // Hold IndexedDB writes for the whole AI decision session
    if (
      selectionLockRef.current !== null ||
      isProcessingRef.current ||
      !!aiResultRef.current ||
      !!errorRef.current
    ) {
      pendingPersistValueRef.current = nextValue;
      if (persistTimeoutRef.current !== null) {
        window.clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
      return;
    }

    if (saveModeRef.current === 'immediate') {
      pendingPersistValueRef.current = null;
      if (persistTimeoutRef.current !== null) {
        window.clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
      runPersist(nextValue);
      return;
    }

    pendingPersistValueRef.current = nextValue;
    if (persistTimeoutRef.current !== null) {
      window.clearTimeout(persistTimeoutRef.current);
    }
    persistTimeoutRef.current = window.setTimeout(() => {
      persistTimeoutRef.current = null;
      // Re-check session in case AI started during debounce
      if (
        selectionLockRef.current !== null ||
        isProcessingRef.current ||
        !!aiResultRef.current ||
        !!errorRef.current
      ) {
        return;
      }
      const latestValue = pendingPersistValueRef.current;
      if (latestValue === null) return;
      pendingPersistValueRef.current = null;
      runPersist(latestValue);
    }, saveDebounceMsRef.current);
  }, [runPersist]);

  // Handle AI operation from toolbar panel
  const handleAIOperation = useCallback(async (
    operation: AIOperation,
    text: string,
    sel: { from: number; to: number },
    customPrompt?: string
  ) => {
    // Read latest values from refs to avoid stale closures
    // (the CodeMirror toolbar panel captures this callback during init
    // and doesn't re-capture when settings change)
    const currentConfig = aiConfigRef.current;
    const currentSampler = samplerSettingsRef.current;
    const currentPrompts = promptSettingsRef.current;

    // Cancel any previous in-flight request for this editor instance
    if (aiServiceRef.current) {
      abortInFlightRequest('superseded');
    }

    // Own this request until unmount / teardown / a newer op bumps the generation
    const requestId = ++requestGenerationRef.current;

    const isCurrentRequest = () =>
      isMountedRef.current && requestId === requestGenerationRef.current;

    // Reset streaming refs (not state, to avoid re-render thrashing)
    streamingContentRef.current = '';
    streamingReasoningRef.current = '';
    aiReasoningRef.current = '';
    errorRef.current = null;
    // Store the custom prompt for error recovery on instruct operations
    if (operation === 'instruct' && customPrompt) {
      lastInstructPromptRef.current = customPrompt;
    } else {
      lastInstructPromptRef.current = null;
    }
    setAiResult(null);
    aiResultRef.current = null;
    errorRef.current = null;
    setCurrentOperation(operation);
    currentOperationRef.current = operation;
    setIsProcessing(true);
    isProcessingRef.current = true;
    setIsStreaming(currentConfig.enableStreaming);

    // Hold storage writes for the whole AI session (including pending debounce)
    holdPersistForAiSession();
    // Block user typing so Accept is a single clean undo step (caret/scroll still work)
    setEditorReadOnlyForAi(true);

    // Lock selection for Accept — freezes the op's target range for the whole session
    const selectionInfo: SelectionLock = { from: sel.from, to: sel.to, text };
    selectionLockRef.current = selectionInfo;
    selectionRef.current = selectionInfo;
    setSelection(selectionInfo);
    setSelectedText(text);

    // Hide locked span immediately; stream fills the ghost in place
    dispatchGhostPreview(
      selectionInfo.from,
      selectionInfo.to,
      '',
      currentConfig.enableStreaming,
    );

    // Update panel immediately
    panelUpdateRef.current?.({
      isProcessing: true,
      isStreaming: currentConfig.enableStreaming,
      streamingContent: '',
      streamingReasoning: '',
      aiResult: null,
      aiReasoning: '',
      currentOperation: operation,
      error: null,
    });

    const requestStartTime = Date.now();
    let firstTokenTime: number | null = null;

    try {
      // Debug: Log the model being used
      console.log('[useAIEditor] Using model:', currentConfig.modelId, 'Base URL:', currentConfig.baseUrl);
      const aiService = new AIService(currentConfig, currentSampler, currentPrompts);
      // Only attach if we are still the active generation (rapid double-click / unmount)
      if (!isCurrentRequest()) {
        aiService.abort();
        return;
      }
      aiServiceRef.current = aiService;
      const context = getContextContent(contextSectionIdsRef.current);

      const onChunk = currentConfig.enableStreaming ? (chunk: { content?: string; reasoning?: string }) => {
        if (!isCurrentRequest()) return;
        if (firstTokenTime === null) {
          firstTokenTime = Date.now();
        }
        if (chunk.reasoning) {
          streamingReasoningRef.current += chunk.reasoning;
          panelUpdateRef.current?.({ streamingReasoning: streamingReasoningRef.current });
        }
        if (chunk.content) {
          streamingContentRef.current += chunk.content;
          panelUpdateRef.current?.({ streamingContent: streamingContentRef.current });
          dispatchGhostContent(streamingContentRef.current, true);
        }
      } : undefined;

      let response;
      switch (operation) {
        case 'expand':
          response = await aiService.expandText(text, context, undefined, onChunk);
          break;
        case 'rewrite':
          response = await aiService.rewriteText(text, context, undefined, onChunk);
          break;
        case 'instruct':
          if (!customPrompt) throw new Error('No custom prompt provided');
          response = await aiService.instructText(text, customPrompt, context, undefined, onChunk);
          break;
        case 'shorten':
          response = await aiService.shortenText(text, context, undefined, onChunk);
          break;
        case 'lengthen':
          response = await aiService.lengthenText(text, context, undefined, onChunk);
          break;
        case 'vivid':
          response = await aiService.makeVivid(text, context, undefined, onChunk);
          break;
        case 'emotion':
          response = await aiService.addEmotion(text, context, undefined, onChunk);
          break;
        case 'grammar':
          response = await aiService.fixGrammar(text, context, undefined, onChunk);
          break;
        default:
          throw new Error('Unknown operation');
      }

      // Drop late completions after unmount, section switch, or a newer request
      if (!isCurrentRequest()) return;

      // Compute stats
      const contentTokens = estimateTokens(response.content);
      const reasoningTokens = estimateTokens(response.reasoning ?? '');
      const totalTokens = contentTokens + reasoningTokens;
      const completionTime = firstTokenTime !== null
        ? Date.now() - firstTokenTime
        : Date.now() - requestStartTime;
      const ttft = firstTokenTime !== null
        ? firstTokenTime - requestStartTime
        : completionTime;
      const tokensPerSecond = completionTime > 0
        ? totalTokens / (completionTime / 1000)
        : undefined;

      // Align newline boundaries with the locked selection so Accept is a true 1:1
      const originalText = selectionLockRef.current?.text ?? text;
      const normalizedContent = normalizeAiEditText(originalText, response.content);

      // Update result (keep selection lock until Accept/Reject)
      aiResultRef.current = normalizedContent;
      aiReasoningRef.current = response.reasoning || '';
      lastInstructPromptRef.current = null; // Clear stored prompt on success
      setAiResult(normalizedContent);
      setIsProcessing(false);
      isProcessingRef.current = false;
      setIsStreaming(false);

      // Final ghost (non-streaming) over the mapped lock
      const view = viewRef.current;
      const locked = selectionLockRef.current && view
        ? clampSelectionLock(selectionLockRef.current, view.state.doc.length)
        : selectionLockRef.current;
      if (locked) {
        dispatchGhostPreview(locked.from, locked.to, normalizedContent, false);
        if (view) {
          const scrollCenter = locked.from + Math.floor((locked.to - locked.from) / 2);
          view.dispatch({
            effects: EditorView.scrollIntoView(scrollCenter, { y: 'center' }),
          });
        }
      } else {
        dispatchGhostContent(normalizedContent, false);
      }

      // Update panel with final result
      panelUpdateRef.current?.({
        isProcessing: false,
        isStreaming: false,
        aiResult: normalizedContent,
        aiReasoning: response.reasoning || '',
        stats: {
          ttft,
          tokensPerSecond,
          modelId: currentConfig.modelId,
          providerId: getProviderSelectionId(currentConfig),
        },
      });
    } catch (err) {
      // Always clear the service slot for this attempt
      // (finally also nulls when this generation still owns aiServiceRef)
      const wasCancelled =
        err instanceof AIError && err.message === 'Request was cancelled';

      // Stale / unmounted: never touch React state or a destroyed panel
      if (!isCurrentRequest()) {
        if (wasCancelled) {
          console.log('[useAIEditor] AI request cancelled (stale or unmounted)');
        }
        return;
      }

      if (wasCancelled) {
        console.log('[useAIEditor] AI request cancelled by user');
        streamingContentRef.current = '';
        streamingReasoningRef.current = '';
        lastInstructPromptRef.current = null;
        clearSelectionLock();
        setIsProcessing(false);
        isProcessingRef.current = false;
        setIsStreaming(false);
        setCurrentOperation(null);
        currentOperationRef.current = null;
        aiResultRef.current = null;
        errorRef.current = null;
        dispatchClearGhost();
        setEditorReadOnlyForAi(false);
        panelUpdateRef.current?.({
          isProcessing: false,
          isStreaming: false,
          streamingContent: '',
          streamingReasoning: '',
          aiResult: null,
          aiReasoning: '',
          currentOperation: null,
          error: null,
        });
        flushPersistAfterAiSession();
      } else {
        console.error('AI operation failed:', err);
        const errorMsg = err instanceof AIError ? err.message : 'AI operation failed. Please try again.';
        errorRef.current = errorMsg;
        setIsProcessing(false);
        isProcessingRef.current = false;
        setIsStreaming(false);
        // Drop partial ghost; user still needs to dismiss the error strip
        // Keep readOnly until they dismiss the error (Reject/Escape)
        dispatchClearGhost();

        // Update panel with error, and pass back the instruct prompt for recovery
        // Use local 'operation' param instead of 'currentOperation' state to avoid closure staleness
        panelUpdateRef.current?.({
          isProcessing: false,
          isStreaming: false,
          error: errorMsg,
          currentOperation: operation,
          instructPrompt: operation === 'instruct' ? lastInstructPromptRef.current : null,
        });
      }
    } finally {
      // Drop our service slot only if we are still the active generation.
      // A newer op / teardown may already own aiServiceRef.
      if (requestId === requestGenerationRef.current) {
        aiServiceRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    aiConfig,
    samplerSettings,
    promptSettings,
    getContextContent,
    setSelectedText,
    clearSelectionLock,
    abortInFlightRequest,
    holdPersistForAiSession,
    setEditorReadOnlyForAi,
    dispatchGhostPreview,
    dispatchGhostContent,
    dispatchClearGhost,
    flushPersistAfterAiSession,
  ]);

  // Handle accept - replace locked selection (or insert at locked cursor if empty range)
  const accept = useCallback(() => {
    const rawAiResult = aiResultRef.current;
    const view = viewRef.current;

    if (!view || !rawAiResult) return;

    // Prefer the selection lock from op start (mapped through any edits while waiting)
    const docLength = view.state.doc.length;
    const locked = selectionLockRef.current
      ? clampSelectionLock(selectionLockRef.current, docLength)
      : null;
    // Fallback only if lock is missing (should not happen for toolbar ops)
    const insertFrom = locked?.from ?? view.state.selection.main.from;
    const insertTo = locked?.to ?? insertFrom;
    const currentAiResult = normalizeAiEditText(locked?.text ?? '', rawAiResult);
    const acceptedFrom = insertFrom;
    const acceptedTo = acceptedFrom + currentAiResult.length;

    // Replace the locked range; clear ghost + re-enable editing in the same transaction
    // so Accept is one normal history step (Ctrl+Z restores the pre-AI span).
    const scrollCenter = acceptedFrom + Math.floor((acceptedTo - acceptedFrom) / 2);
    view.dispatch({
      changes: {
        from: insertFrom,
        to: insertTo,
        insert: currentAiResult,
      },
      selection: { anchor: acceptedFrom, head: acceptedTo },
      effects: [
        clearAIGhostPreview.of(null),
        readOnlyCompartmentRef.current.reconfigure(EditorState.readOnly.of(false)),
        EditorView.scrollIntoView(scrollCenter, { y: 'center' }),
      ],
    });

    showEphemeralToast({
      type: 'success',
      title: 'AI edit applied',
      message: 'The suggestion was inserted into the editor.',
    });

    // Clear AI state + release selection lock (ends session for persist gate)
    streamingContentRef.current = '';
    streamingReasoningRef.current = '';
    aiReasoningRef.current = '';
    errorRef.current = null;
    lastInstructPromptRef.current = null;
    clearSelectionLock();
    setAiResult(null);
    aiResultRef.current = null;
    setCurrentOperation(null);
    currentOperationRef.current = null;
    setIsProcessing(false);
    isProcessingRef.current = false;
    setIsStreaming(false);
    setSelection(null);
    selectionRef.current = null;
    setSelectedText('');

    // Clear panel state
    panelUpdateRef.current?.({
      isProcessing: false,
      isStreaming: false,
      streamingContent: '',
      streamingReasoning: '',
      aiResult: null,
      aiReasoning: '',
      currentOperation: null,
      error: null,
    });

    // Session over — commit final document
    flushPersistAfterAiSession();
  }, [setSelectedText, clearSelectionLock, flushPersistAfterAiSession]);

  // Handle reject - clear AI state
  const reject = useCallback(() => {
    // Use ref so instruct recovery works even if reject was captured at editor init
    const isInstruct = currentOperationRef.current === 'instruct';
    const savedPrompt = isInstruct ? lastInstructPromptRef.current : null;

    // Clear streaming refs
    streamingContentRef.current = '';
    streamingReasoningRef.current = '';
    aiReasoningRef.current = '';
    errorRef.current = null;
    lastInstructPromptRef.current = null;
    clearSelectionLock();
    // Clear state
    setAiResult(null);
    aiResultRef.current = null;
    setCurrentOperation(null);
    currentOperationRef.current = null;
    setIsProcessing(false);
    isProcessingRef.current = false;
    setIsStreaming(false);
    setSelection(null);
    selectionRef.current = null;
    setSelectedText('');

    dispatchClearGhost();
    setEditorReadOnlyForAi(false);

    // Clear panel state (but pass back the instruct prompt for recovery)
    panelUpdateRef.current?.({
      isProcessing: false,
      isStreaming: false,
      streamingContent: '',
      streamingReasoning: '',
      aiResult: null,
      aiReasoning: '',
      currentOperation: null,
      error: null,
      instructPrompt: savedPrompt,
    });

    // Session over — flush any pre-session pending persist
    flushPersistAfterAiSession();
  }, [setSelectedText, clearSelectionLock, dispatchClearGhost, setEditorReadOnlyForAi, flushPersistAfterAiSession]);

  // Handle abort - cancel the current AI request
  const abort = useCallback(() => {
    if (aiServiceRef.current) {
      aiServiceRef.current.abort();
    }
  }, []);

  // Keep action refs current for keymaps / panel callbacks captured at editor init
  acceptRef.current = accept;
  rejectRef.current = reject;
  abortRef.current = abort;

  // Manually set editor content
  const setContent = useCallback((content: string) => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (content !== currentValue) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: content,
        },
      });
    }
  }, []);

  // Initialize CodeMirror editor
  useEffect(() => {
    if (!editorRef.current || !isActive) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        keymap.of([
          { key: 'Tab', run: insertTab },
          { key: 'Shift-Tab', run: indentLess },
        ]),
        EditorState.tabSize.of(4),
        indentUnit.of('    '),
        keymap.of(defaultKeymap),
        keymap.of(historyKeymap),
        history(),
        themeSync(),
        drawSelection(),
        EditorView.lineWrapping,
        // Custom in-editor spellcheck (see src/editor/spellcheck)
        spellcheckExtension({ settings: spellcheck, mode: spellcheckMode }),
        EditorView.theme({
          '&': {
            fontSize: 'var(--editor-font-size, 16px)',
            height: '100%',
            overflow: 'hidden',
            ...editorStyles,
          },
          '.cm-panels': {
            flexShrink: '0',
          },
          '.cm-scroller': {
            height: maxHeight && maxHeight !== 'none' ? 'auto' : '100%',
            maxHeight: maxHeight && maxHeight !== 'none' ? maxHeight : '100%',
            minHeight: '0',
            overflowY: 'auto',
            overflowX: 'hidden',
            overscrollBehaviorY: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          },
          '.cm-content': {
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            padding: 'clamp(8px, 2vw, 12px)',
            minHeight,
          },
          '.cm-gutters': {
            backgroundColor: 'transparent',
            border: 'none',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'transparent',
          },
          '.cm-line': {
            padding: '0 clamp(2px, 0.8vw, 4px)',
          },
        }),
        // In-editor AI ghost preview (decoration-only until Accept)
        ...aiGhostPreview(),
        // User typing blocked while AI session is open (reconfigured at runtime)
        readOnlyCompartmentRef.current.of(EditorState.readOnly.of(false)),
        // AI result shortcuts — high precedence so they win when a result is pending
        Prec.high(keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              if (!aiResultRef.current) return false;
              acceptRef.current();
              return true;
            },
          },
          {
            key: 'Escape',
            run: (view) => {
              // Let search panel close first
              if (view.state.field(searchPanelOpen, false)) return false;
              // Dismiss result / error
              if (aiResultRef.current || errorRef.current) {
                rejectRef.current();
                return true;
              }
              // Stop in-flight request
              if (isProcessingRef.current) {
                abortRef.current();
                return true;
              }
              return false;
            },
          },
        ])),
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged) {
            // Keep Accept target aligned if the doc changes while AI is running
            if (selectionLockRef.current) {
              const mapped = mapSelectionLock(selectionLockRef.current, update.changes);
              selectionLockRef.current = mapped;
              selectionRef.current = mapped;
            }

            const nextValue = update.state.doc.toString();
            if (!isApplyingExternalSyncRef.current) {
              isLocallyDirtyRef.current = true;
            }
            onImmediateChangeRef.current?.(nextValue);
            if (!isApplyingExternalSyncRef.current) {
              schedulePersist(nextValue);
            }
          }

          if (update.focusChanged) {
            isFocusedRef.current = update.view.hasFocus;
            // Don't flush storage while an AI Accept/Reject decision is open
            if (
              !isFocusedRef.current &&
              selectionLockRef.current === null &&
              !isProcessingRef.current &&
              !aiResultRef.current &&
              !errorRef.current
            ) {
              flushPendingPersist();
            }
          }

          // Track live selection for toolbar — freeze while an AI selection lock is held
          if (!selectionLockRef.current) {
            const sel = update.state.selection.main;
            if (sel.from !== sel.to) {
              const text = update.state.doc.sliceString(sel.from, sel.to);
              setSelection({ from: sel.from, to: sel.to, text });
              setSelectedText(text);
            } else {
              setSelection(null);
              setSelectedText('');
            }
          }
        }),
        // AI Toolbar Panel
        aiToolbarPanel(
          samplerSettings,
          (operation, selectedText, selection, customPrompt) => {
            void handleAIOperation(operation, selectedText, selection, customPrompt);
          },
          () => acceptRef.current(),
          () => rejectRef.current(),
          () => abortRef.current(),
          onFontSizeChange,
          toolbarActions,
        ),
        // Search & Replace functionality
        toolbarSearch(),
        toolbarSearchTheme(),
        // Font size extension
        fontSizeExtension(fontSize),
        // Character card macro typing helper
        characterMacroHelper(),
        ...(additionalExtensions ?? []),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    // Auto-focus the editor
    const focusTimer = window.setTimeout(() => {
      view.focus();
    }, 50);

    // Get reference to the panel's updateAIState function
    const panelHookTimer = window.setTimeout(() => {
      const updateFunc = getPanelUpdateFunction(view);
      if (updateFunc) {
        panelUpdateRef.current = updateFunc;
      }
    }, 100);

    return () => {
      window.clearTimeout(focusTimer);
      window.clearTimeout(panelHookTimer);
      flushPendingPersist();
      if (persistTimeoutRef.current !== null) {
        window.clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }

      // Stop network work for this editor instance (section switch / remount).
      // Generation bump makes any late chunk/result a no-op for the old panel.
      abortInFlightRequest('editor-teardown');
      streamingContentRef.current = '';
      streamingReasoningRef.current = '';
      aiReasoningRef.current = '';
      errorRef.current = null;
      lastInstructPromptRef.current = null;
      selectionLockRef.current = null;
      selectionRef.current = null;
      aiResultRef.current = null;
      isProcessingRef.current = false;
      currentOperationRef.current = null;
      errorRef.current = null;

      // Clear React AI UI state while the hook is still mounted (e.g. section key change).
      // Unmount sets isMountedRef false first via its own effect — skip setState then.
      if (isMountedRef.current) {
        setIsProcessing(false);
        setIsStreaming(false);
        setAiResult(null);
        setCurrentOperation(null);
        setSelection(null);
        setSelectedText('');
      }

      // Clears document keydown listeners (panel destroy), etc.
      // readOnly compartment dies with the view — no need to reconfigure first
      view.destroy();
      viewRef.current = null;
      panelUpdateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isActive, minHeight, maxHeight, JSON.stringify(editorStyles), flushPendingPersist, schedulePersist, toolbarActions, abortInFlightRequest, setSelectedText]);

  // Update editor content when value changes externally
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const editorValue = view.state.doc.toString();
    if (value === editorValue) {
      isLocallyDirtyRef.current = false;
      return;
    }

    // Don't stomp in-progress local edits while editor is focused.
    if (isFocusedRef.current && isLocallyDirtyRef.current) {
      return;
    }

    const currentSelection = view.state.selection.main;
    const clampedAnchor = Math.min(currentSelection.anchor, value.length);
    const clampedHead = Math.min(currentSelection.head, value.length);

    isApplyingExternalSyncRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: editorValue.length,
        insert: value,
      },
      selection: {
        anchor: clampedAnchor,
        head: clampedHead,
      },
    });
    isApplyingExternalSyncRef.current = false;
    isLocallyDirtyRef.current = false;
  }, [value]);

  // Update panel sampler when settings change
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // We can't easily get the panel instance back from CodeMirror
    // but we can find it in the DOM or use the same hack we use for updateAIState
    const panel = view.dom.querySelector('.ai-toolbar-panel') as unknown as { __panel?: { updateSampler?: (s: SamplerSettings) => void } } | null;
    if (panel?.__panel?.updateSampler) {
       panel.__panel.updateSampler(samplerSettings);
    } else {
      // Alternative: Use the registry if we store the whole panel there
      // Let's modify aiToolbarPanel.ts to store the whole panel there
    }
  }, [samplerSettings]);

  // Sync external font size changes to the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view || fontSize === undefined) return;

    const currentSize = view.state.field(editorFontSizeField, false) ?? DEFAULT_FONT_SIZE;
    if (fontSize !== currentSize) {
      setFontSize(view, fontSize);
    }
  }, [fontSize]);

  // Sync external spellcheck settings changes to the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    setSpellcheckSettings(view, spellcheck, spellcheckMode);
  }, [spellcheck, spellcheckMode]);

  // Declared last so its cleanup runs first on unmount: flip isMountedRef before
  // the editor effect cleanup (which may call setState only while still mounted).
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortInFlightRequest('unmount');
    };
  }, [abortInFlightRequest]);

  return {
    editorRef,
    view: viewRef.current,
    selection,
    isProcessing,
    isStreaming,
    currentOperation,
    aiResult,
    accept,
    reject,
    setContent,
  };
}
