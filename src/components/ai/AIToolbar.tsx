/**
 * @fileoverview AI Result Panel component - Displays AI operation results.
 * This is a simplified component that only shows results, not operation buttons.
 * Operations are handled by the fixed aiToolbarPanel in CodeMirror.
 * @module components/ai/AIToolbar
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Loader2,
  AlertCircle,
  Check,
  XCircle,
  GripVertical,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import type { SamplerSettings, AIConfig, PromptSettings } from '../../db/types';

/**
 * AI Operation types
 */
export type AIOperation =
  | 'expand'
  | 'rewrite'
  | 'instruct'
  | 'shorten'
  | 'lengthen'
  | 'vivid'
  | 'emotion'
  | 'grammar';

/**
 * Operation labels for display
 */
const OPERATION_LABELS: Record<AIOperation, string> = {
  expand: 'Enhance',
  rewrite: 'Rephrase',
  instruct: 'Custom',
  shorten: 'Shorten',
  lengthen: 'Lengthen',
  vivid: 'Vivid',
  emotion: 'Emotion',
  grammar: 'Fix',
};

/**
 * Props for the AIToolbar component
 */
interface AIToolbarProps {
  /** The selected text */
  selectedText: string;
  /** Context entry IDs (will be resolved to content) */
  contextContent: string[];
  /** AI configuration */
  aiConfig: AIConfig;
  /** Sampler settings */
  samplerSettings: SamplerSettings;
  /** Prompt settings */
  promptSettings: PromptSettings;
  /** Position of the toolbar */
  position: { x: number; y: number };
  /** Callback when an operation is completed (user accepts result) */
  onComplete: (result: string, operation: AIOperation, originalSelectedText: string) => void;
  /** Callback when the toolbar is closed */
  onClose: () => void;
  /** Function to resolve context entry IDs to content */
  getContextContent?: (entryIds: string[]) => Promise<string[]>;
  /** Function to get current selection info from editor */
  getEditorSelection?: () => { from: number; to: number; text: string } | null;
  /** Callback to replace selected text using CodeMirror API (receives text and selection range) */
  onReplaceSelectedText?: (text: string, selection: { from: number; to: number; text: string } | null) => void;
  /** Current operation being displayed */
  currentOperation?: AIOperation | null;
  /** AI result content to display */
  aiResult?: string | null;
  /** AI reasoning to display */
  aiReasoning?: string;
  /** Whether AI is processing */
  isProcessing?: boolean;
  /** Whether AI is streaming */
  isStreaming?: boolean;
  /** Streaming content */
  streamingContent?: string;
  /** Streaming reasoning */
  streamingReasoning?: string;
  /** Error message */
  error?: string | null;
  /** Callback to clear error */
  onClearError?: () => void;
  /** Callback when user accepts result */
  onAccept?: () => void;
  /** Callback when user rejects result */
  onReject?: () => void;
}

/**
 * AI Result Panel component - Displays AI operation results
 */
export function AIToolbar({
  position,
  onClose,
  currentOperation,
  aiResult,
  aiReasoning,
  isProcessing,
  isStreaming,
  streamingContent,
  streamingReasoning,
  error,
  onAccept,
  onReject,
}: AIToolbarProps): React.ReactElement {
  const [isMinimized, setIsMinimized] = useState(false);
  const [displayedContent, setDisplayedContent] = useState('');
  const [displayedReasoning, setDisplayedReasoning] = useState('');
  const [isReasoningComplete, setIsReasoningComplete] = useState(false);

  // Drag state - using ONLY refs for zero re-renders during drag
  const dragStateRef = useRef({
    isDragging: false,
    startMouseX: 0,
    startMouseY: 0,
    startPanelX: 0,
    startPanelY: 0,
  });
  const toolbarRef = useRef<HTMLDivElement>(null);

  const resultPreviewRef = useRef<HTMLDivElement>(null);
  const streamingReasoningRef = useRef<HTMLDivElement>(null);
  const aiReasoningRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  // Update displayed content when streaming
  useEffect(() => {
    if (isStreaming && streamingContent) {
      setDisplayedContent(streamingContent);
    }
  }, [isStreaming, streamingContent]);

  // Update displayed reasoning when streaming
  useEffect(() => {
    if (isStreaming && streamingReasoning) {
      setDisplayedReasoning(streamingReasoning);
      setIsReasoningComplete(false);
    } else if (!isStreaming && displayedReasoning) {
      setIsReasoningComplete(true);
    }
  }, [isStreaming, streamingReasoning, displayedReasoning]);

  // Auto-scroll effects
  useEffect(() => {
    if (resultPreviewRef.current && isStreaming) {
      resultPreviewRef.current.scrollTo({ top: resultPreviewRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [displayedContent, displayedReasoning, isStreaming]);

  useEffect(() => {
    if (contentScrollRef.current && isStreaming && isReasoningComplete) {
      contentScrollRef.current.scrollTo({ top: contentScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [displayedContent, isStreaming, isReasoningComplete]);

  useEffect(() => {
    if (isReasoningComplete) {
      resultPreviewRef.current?.scrollTo({ top: resultPreviewRef.current.scrollHeight, behavior: 'smooth' });
      contentScrollRef.current?.scrollTo({ top: contentScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [isReasoningComplete]);

  useEffect(() => {
    if (streamingReasoningRef.current && displayedReasoning) {
      streamingReasoningRef.current.scrollTo({ top: streamingReasoningRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [displayedReasoning]);

  useEffect(() => {
    if (aiReasoningRef.current && aiReasoning) {
      aiReasoningRef.current.scrollTo({ top: aiReasoningRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [aiReasoning]);

  // Close toolbar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        if (!isProcessing && !aiResult) {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, isProcessing, aiResult]);

  // Drag handling
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    const canDrag = isStreaming || isProcessing || !!aiResult;
    if (!canDrag) return;

    e.preventDefault();
    e.stopPropagation();

    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    dragStateRef.current.isDragging = true;
    dragStateRef.current.startMouseX = e.clientX;
    dragStateRef.current.startMouseY = e.clientY;
    
    const currentLeft = parseInt(toolbar.style.left || '0', 10) || position.x;
    const currentTop = parseInt(toolbar.style.top || '0', 10) || position.y;
    
    dragStateRef.current.startPanelX = currentLeft;
    dragStateRef.current.startPanelY = currentTop;
    
    toolbar.style.willChange = 'left, top';
    toolbar.style.cursor = 'grabbing';
    toolbar.classList.add('dragging');
  }, [isStreaming, isProcessing, aiResult, position]);

  // Mouse move/up handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current.isDragging || !toolbarRef.current) return;

      const deltaX = e.clientX - dragStateRef.current.startMouseX;
      const deltaY = e.clientY - dragStateRef.current.startMouseY;
      
      let newX = dragStateRef.current.startPanelX + deltaX;
      let newY = dragStateRef.current.startPanelY + deltaY;

      const padding = 10;
      const maxX = window.innerWidth - 360;
      const maxY = window.innerHeight - 100;
      
      newX = Math.max(padding, Math.min(newX, maxX));
      newY = Math.max(padding, Math.min(newY, maxY));

      toolbarRef.current.style.left = `${newX}px`;
      toolbarRef.current.style.top = `${newY}px`;
    };

    const handleMouseUp = () => {
      if (!dragStateRef.current.isDragging) return;
      
      dragStateRef.current.isDragging = false;
      
      const toolbar = toolbarRef.current;
      if (toolbar) {
        toolbar.style.willChange = 'auto';
        toolbar.style.cursor = '';
        toolbar.classList.remove('dragging');
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const getOperationLabel = (operation: AIOperation | null | undefined): string => {
    if (!operation) return 'AI Result';
    return OPERATION_LABELS[operation] || 'AI Result';
  };

  const ReasoningSection: React.FC<{ reasoning: string; defaultExpanded?: boolean; reasoningRef?: React.RefObject<HTMLDivElement | null> }> = ({
    reasoning,
    defaultExpanded = false,
    reasoningRef
  }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    if (!reasoning?.trim()) return null;

    return (
      <div className="mb-2 border border-vault-300 dark:border-vault-600 rounded-md overflow-hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-2 py-1.5 bg-vault-100 dark:bg-vault-700/50 hover:bg-vault-200 dark:hover:bg-vault-700 transition-colors text-left"
        >
          <span className="text-xs font-medium text-vault-600 dark:text-vault-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Thinking process
          </span>
          <span className="text-xs text-vault-500 dark:text-vault-500">{isExpanded ? 'Hide' : 'Show'}</span>
        </button>
        {isExpanded && (
          <div ref={reasoningRef} className="max-h-40 overflow-y-auto px-2 py-2 bg-vault-50 dark:bg-vault-800/50 border-t border-vault-200 dark:border-vault-700">
            <pre className="text-xs font-mono text-vault-700 dark:text-vault-300 whitespace-pre-wrap wrap-break-word leading-relaxed">{reasoning}</pre>
          </div>
        )}
      </div>
    );
  };

  const isHeaderDraggable = isStreaming || isProcessing || !!aiResult;
  const displayContent = isStreaming ? displayedContent : (aiResult || '');
  const displayReasoning = isStreaming ? displayedReasoning : (aiReasoning || '');

  // Don't render if nothing to show
  if (!isProcessing && !isStreaming && !aiResult && !error) {
    return <></>;
  }

  return (
    <div
      ref={toolbarRef}
      data-ai-toolbar
      className="fixed z-50 bg-white dark:bg-vault-800 rounded-lg shadow-2xl border border-vault-200 dark:border-vault-700 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        minWidth: '280px',
        maxWidth: '360px'
      }}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between p-3 border-b border-vault-200 dark:border-vault-700 shrink-0 select-none ${
          isHeaderDraggable
            ? 'cursor-grab bg-vault-50 dark:bg-vault-700/50 hover:bg-vault-100 dark:hover:bg-vault-700/70'
            : ''
        }`}
        onMouseDown={handleDragStart}
        title={isHeaderDraggable ? 'Drag to move panel' : undefined}
      >
        <div className="flex items-center gap-2">
          {isHeaderDraggable && <GripVertical className="w-4 h-4 text-vault-400" />}
          <span className="text-xs font-semibold text-vault-600 dark:text-vault-400 uppercase tracking-wide">
            {getOperationLabel(currentOperation)}{isStreaming && '...'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-vault-400 hover:text-vault-600 dark:hover:text-vault-300"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button 
            onClick={() => { onReject?.(); onClose(); }} 
            className="p-1 text-vault-400 hover:text-vault-600 dark:hover:text-vault-300" 
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="m-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded flex items-start gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && !isStreaming && !aiResult && (
        <div className="p-4 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-vault-600 dark:text-vault-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-vault-700 dark:text-vault-300">AI is working...</p>
            <p className="text-xs text-vault-500 dark:text-vault-500 mt-1">
              {currentOperation && getOperationLabel(currentOperation)}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {!isMinimized && (aiResult || isStreaming) && (
        <div className="flex-1 overflow-y-auto p-3" style={{ maxHeight: 'calc(70vh - 120px)' }}>
          {isStreaming && displayReasoning && (
            <div className="mb-3 border border-vault-300 dark:border-vault-600 rounded-md overflow-hidden">
              <div className="flex items-center justify-between px-2 py-1.5 bg-vault-100 dark:bg-vault-700/50">
                <span className="text-xs font-medium text-vault-600 dark:text-vault-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />Thinking process
                </span>
                <span className="text-xs text-vault-500 dark:text-vault-500">Streaming...</span>
              </div>
              <div ref={streamingReasoningRef} className="max-h-40 overflow-y-auto px-2 py-2 bg-vault-50 dark:bg-vault-800/50 border-t border-vault-200 dark:border-vault-700">
                <pre className="text-xs font-mono text-vault-700 dark:text-vault-300 whitespace-pre-wrap wrap-break-word leading-relaxed">{displayReasoning}</pre>
              </div>
            </div>
          )}

          {!isStreaming && aiReasoning && <ReasoningSection reasoning={aiReasoning} reasoningRef={aiReasoningRef} />}

          <div ref={contentScrollRef} className={`overflow-y-auto ${isReasoningComplete || !isStreaming ? 'max-h-40 border border-vault-200 dark:border-vault-700 rounded' : ''}`}>
            <div ref={resultPreviewRef} className="p-3 bg-vault-50 dark:bg-vault-900/50">
              <p className="text-sm text-vault-800 dark:text-vault-200 whitespace-pre-wrap">
                {displayContent}
                {isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-vault-600 animate-pulse" />}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!isStreaming && !isProcessing && aiResult && (
        <div className="flex gap-2 p-3 border-t border-vault-200 dark:border-vault-700 shrink-0 bg-white dark:bg-vault-800">
          <button 
            onClick={onAccept} 
            className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />Accept
          </button>
          <button 
            onClick={() => { onReject?.(); onClose(); }} 
            className="flex-1 px-3 py-1.5 bg-vault-100 hover:bg-vault-200 dark:bg-vault-700 dark:hover:bg-vault-600 text-vault-700 dark:text-vault-300 text-sm rounded transition-colors flex items-center justify-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />Reject
          </button>
        </div>
      )}
    </div>
  );
}

export default AIToolbar;
