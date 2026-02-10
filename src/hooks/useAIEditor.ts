/**
 * @fileoverview Shared hook for AI-powered CodeMirror editors.
 * Encapsulates all CodeMirror setup, AI toolbar integration, and AI operation handling.
 * @module @hooks/useAIEditor
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { EditorView, keymap, ViewUpdate } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import type { AIOperation } from '../components/ai/AIToolbar';
import type { CharacterSection } from '../db/characterTypes';
import type { SamplerSettings, AIConfig, PromptSettings } from '../db/types';
import { aiToolbarPanel, getPanelUpdateFunction } from '../editor/extensions/aiToolbarPanel';
import { toolbarSearch, toolbarSearchTheme } from '../editor/extensions/toolbarSearch';
import { AIService, AIError } from '../services/AIService';

export interface UseAIEditorOptions {
  /** Key to force re-initialization when changed (e.g., section ID) */
  key?: string;
  /** Initial document content */
  value: string;
  /** Callback when document changes */
  onChange: (value: string) => void;
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
  /** Additional CSS styles for the editor */
  editorStyles?: Record<string, string>;
  /** Whether the editor is currently active/visible */
  isActive?: boolean;
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
    setSelectedText,
    aiConfig,
    samplerSettings,
    promptSettings,
    getContextContent,
    contextSectionIds,
    minHeight = '100px',
    editorStyles = {},
    isActive = true,
  } = options;

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const panelUpdateRef = useRef<((update: {
    isProcessing?: boolean;
    isStreaming?: boolean;
    streamingContent?: string;
    streamingReasoning?: string;
    aiResult?: string | null;
    aiReasoning?: string;
    currentOperation?: AIOperation | null;
    error?: string | null;
  }) => void) | null>(null);
  const aiServiceRef = useRef<AIService | null>(null);

  // AI operation state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<AIOperation | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_aiReasoning, setAiReasoning] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_streamingContent, setStreamingContent] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_streamingReasoning, setStreamingReasoning] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ from: number; to: number; text: string } | null>(null);

  // Use refs to avoid closure issues with callbacks
  const aiResultRef = useRef<string | null>(null);
  const selectionRef = useRef<{ from: number; to: number; text: string } | null>(null);
  const contextSectionIdsRef = useRef<CharacterSection[]>(contextSectionIds);

  // Keep refs in sync with state
  useEffect(() => {
    aiResultRef.current = aiResult;
  }, [aiResult]);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    contextSectionIdsRef.current = contextSectionIds;
  }, [contextSectionIds]);

  // Use a ref to always have access to the latest aiConfig
  const aiConfigRef = useRef(aiConfig);
  useEffect(() => {
    aiConfigRef.current = aiConfig;
  }, [aiConfig]);

  // Use a ref to always have access to the latest onChange callback
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Handle AI operation from toolbar panel
  const handleAIOperation = useCallback(async (
    operation: AIOperation,
    text: string,
    sel: { from: number; to: number },
    customPrompt?: string
  ) => {
    // Get the latest config from ref to avoid stale closure
    const currentConfig = aiConfigRef.current;

    // Reset state
    setError(null);
    setAiResult(null);
    setAiReasoning('');
    setStreamingContent('');
    setStreamingReasoning('');
    setCurrentOperation(operation);
    setIsProcessing(true);
    setIsStreaming(currentConfig.enableStreaming);

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

    // Store selection for later replacement
    const selectionInfo = { from: sel.from, to: sel.to, text };
    selectionRef.current = selectionInfo;
    setSelection(selectionInfo);
    setSelectedText(text);

    try {
      // Debug: Log the model being used
      console.log('[useAIEditor] Using model:', currentConfig.modelId, 'Base URL:', currentConfig.baseUrl);
      const aiService = new AIService(currentConfig, samplerSettings, promptSettings);
      aiServiceRef.current = aiService;
      const context = getContextContent(contextSectionIdsRef.current);

      const onChunk = currentConfig.enableStreaming ? (chunk: { content?: string; reasoning?: string }) => {
        if (chunk.reasoning) {
          setStreamingReasoning(prev => {
            const newVal = prev + chunk.reasoning;
            panelUpdateRef.current?.({ streamingReasoning: newVal });
            return newVal;
          });
        }
        if (chunk.content) {
          setStreamingContent(prev => {
            const newVal = prev + chunk.content;
            panelUpdateRef.current?.({ streamingContent: newVal });
            return newVal;
          });
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

      // Update result
      aiResultRef.current = response.content;
      setAiResult(response.content);
      setAiReasoning(response.reasoning || '');
      setIsProcessing(false);
      setIsStreaming(false);

      // Update panel with final result
      panelUpdateRef.current?.({
        isProcessing: false,
        isStreaming: false,
        aiResult: response.content,
        aiReasoning: response.reasoning || '',
      });
    } catch (err) {
      // Check if this was an abort/cancellation
      if (err instanceof AIError && err.message === 'Request was cancelled') {
        console.log('[useAIEditor] AI request cancelled by user');
        // Clear state without showing error
        setIsProcessing(false);
        setIsStreaming(false);
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
      } else {
        console.error('AI operation failed:', err);
        const errorMsg = err instanceof AIError ? err.message : 'AI operation failed. Please try again.';
        setError(errorMsg);
        setIsProcessing(false);
        setIsStreaming(false);

        // Update panel with error
        panelUpdateRef.current?.({
          isProcessing: false,
          isStreaming: false,
          error: errorMsg,
        });
      }
    } finally {
      aiServiceRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiConfig, samplerSettings, promptSettings, getContextContent, setSelectedText]);

  // Handle accept - replace selected text in editor
  const accept = useCallback(() => {
    const currentAiResult = aiResultRef.current;
    const currentSelection = selectionRef.current;
    const view = viewRef.current;

    if (!view || !currentAiResult || !currentSelection) return;

    // Replace the selected text using the exact CodeMirror positions
    view.dispatch({
      changes: {
        from: currentSelection.from,
        to: currentSelection.to,
        insert: currentAiResult,
      },
      selection: { anchor: currentSelection.from, head: currentSelection.from + currentAiResult.length },
    });

    // Clear AI state
    setAiResult(null);
    setAiReasoning('');
    setStreamingContent('');
    setStreamingReasoning('');
    setCurrentOperation(null);
    setError(null);
    setSelection(null);
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
  }, [setSelectedText]);

  // Handle reject - clear AI state
  const reject = useCallback(() => {
    setAiResult(null);
    setAiReasoning('');
    setStreamingContent('');
    setStreamingReasoning('');
    setCurrentOperation(null);
    setError(null);
    setIsProcessing(false);
    setIsStreaming(false);
    setSelection(null);
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
  }, [setSelectedText]);

  // Handle abort - cancel the current AI request
  const abort = useCallback(() => {
    if (aiServiceRef.current) {
      aiServiceRef.current.abort();
    }
  }, []);

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
        keymap.of(defaultKeymap),
        keymap.of(historyKeymap),
        history(),
        oneDark,
        EditorView.lineWrapping,
        // Enable native browser spellcheck
        EditorView.contentAttributes.of({ spellcheck: 'true' }),
        EditorView.theme({
          '&': {
            fontSize: '18px',
            height: '100%',
            overflow: 'hidden',
            ...editorStyles,
          },
          '.cm-scroller': {
            height: '100%',
            overflow: 'auto',
          },
          '.cm-content': {
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            padding: '12px',
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
            padding: '0 4px',
          },
        }),
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged) {
            // Use ref to get the latest onChange callback
            onChangeRef.current(update.state.doc.toString());
          }

          // Track selection changes
          const sel = update.state.selection.main;
          if (sel.from !== sel.to) {
            const text = update.state.doc.sliceString(sel.from, sel.to);
            setSelection({ from: sel.from, to: sel.to, text });
            setSelectedText(text);
          } else {
            setSelection(null);
            setSelectedText('');
          }
        }),
        // AI Toolbar Panel
        aiToolbarPanel(
          samplerSettings,
          (operation, selectedText, selection, customPrompt) => {
            void handleAIOperation(operation, selectedText, selection, customPrompt);
          },
          accept,
          reject,
          abort
        ),
        // Search & Replace functionality
        toolbarSearch(),
        toolbarSearchTheme(),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    // Auto-focus the editor
    setTimeout(() => {
      view.focus();
    }, 50);

    // Get reference to the panel's updateAIState function
    setTimeout(() => {
      const updateFunc = getPanelUpdateFunction(view);
      if (updateFunc) {
        panelUpdateRef.current = updateFunc;
      }
    }, 100);

    return () => {
      view.destroy();
      viewRef.current = null;
      panelUpdateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isActive, minHeight, JSON.stringify(editorStyles)]);

  // Update editor content when value changes externally
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const editorValue = view.state.doc.toString();
    if (value !== editorValue) {
      view.dispatch({
        changes: {
          from: 0,
          to: editorValue.length,
          insert: value,
        },
      });
    }
  }, [value]);

  // Update panel sampler when settings change
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // We can't easily get the panel instance back from CodeMirror
    // but we can find it in the DOM or use the same hack we use for updateAIState
    // Actually, I added getPanelUpdateFunction, I should add getPanelSamplerUpdate too
    const panel = view.dom.querySelector('.ai-toolbar-panel') as any;
    if (panel?.__panel?.updateSampler) {
       panel.__panel.updateSampler(samplerSettings);
    } else {
      // Alternative: Use the registry if we store the whole panel there
      // Let's modify aiToolbarPanel.ts to store the whole object in the registry
    }
  }, [samplerSettings]);

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
