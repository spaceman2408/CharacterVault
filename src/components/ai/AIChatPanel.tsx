/**
 * @fileoverview AI Chat Panel component - Docked side panel for AI conversations.
 * @module components/ai/AIChatPanel
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  Check,
  Copy,
  Plus,
  Square,
  RotateCcw,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SamplerSettings, AIConfig, PromptSettings } from '../../db/types';
import { AIService, AIError } from '../../services/AIService';
import { StreamingMarkdown } from './StreamingText';

/**
 * Chat message in a conversation
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  timestamp: number;
}

/**
 * Props for the AIChatPanel component
 */
export interface AIChatPanelProps {
  /** The selected text (optional context) */
  selectedText: string;
  /** Context entry IDs (will be resolved to content) */
  contextEntryIds: string[];
  /** AI configuration */
  aiConfig: AIConfig;
  /** Sampler settings */
  samplerSettings: SamplerSettings;
  /** Prompt settings */
  promptSettings: PromptSettings;
  /** Callback when an operation is completed (user accepts result) */
  onComplete: (result: string, operation: 'ask', originalSelectedText: string) => void;
  /** Function to resolve context entry IDs to content */
  getContextContent?: (entryIds: string[]) => Promise<string[]>;
  /** Callback to replace selected text (does not close panel) - receives text and selection range */
  onReplaceSelectedText?: (text: string, selection: { from: number; to: number; text: string } | null) => void;
  /** Function to get current selection info from editor */
  getEditorSelection?: () => { from: number; to: number; text: string } | null;
  /** Current section ID - used for context */
  activeSection?: string | null;
  /** Callback to close panel (for mobile) */
  onClose?: () => void;
  /** Whether this is mobile view (shows close button) */
  isMobile?: boolean;
}

/**
 * AI Chat Panel component - Docked side panel for AI conversations
 * 
 * Features:
 * - Docked to the right side of the workspace
 * - Collapsible chat history section
 * - Mobile responsive with close button
 */
export function AIChatPanel({
  contextEntryIds,
  aiConfig,
  samplerSettings,
  promptSettings,
  getContextContent,
  onClose,
  isMobile = false,
}: AIChatPanelProps): React.ReactElement {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askQuestion, setAskQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [resolvedContext, setResolvedContext] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const streamingReasoningRef = useRef<HTMLDivElement>(null);

  // Chunk queue system for smooth typewriter effect
  const [contentChunkQueue, setContentChunkQueue] = useState<string[]>([]);
  const [reasoningChunkQueue, setReasoningChunkQueue] = useState<string[]>([]);
  const [displayedContent, setDisplayedContent] = useState('');
  const [displayedReasoning, setDisplayedReasoning] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isReasoningComplete, setIsReasoningComplete] = useState(false);

  // Use refs to track queues for synchronous access within interval
  const contentQueueRef = useRef<string[]>([]);
  const reasoningQueueRef = useRef<string[]>([]);
  const isReasoningCompleteRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    contentQueueRef.current = contentChunkQueue;
  }, [contentChunkQueue]);

  useEffect(() => {
    reasoningQueueRef.current = reasoningChunkQueue;
  }, [reasoningChunkQueue]);

  // Keep reasoning complete ref in sync with state
  useEffect(() => {
    isReasoningCompleteRef.current = isReasoningComplete;
  }, [isReasoningComplete]);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aiServiceRef = useRef<AIService | null>(null);

  // Resolve context content when panel opens
  useEffect(() => {
    const resolveContext = async () => {
      if (getContextContent && contextEntryIds.length > 0) {
        try {
          const content = await getContextContent(contextEntryIds);
          setResolvedContext(content);
        } catch (error) {
          console.error('Failed to resolve context:', error);
          setResolvedContext([]);
        }
      } else {
        setResolvedContext([]);
      }
    };

    void resolveContext();
  }, [contextEntryIds, getContextContent]);

  // Track if user has manually scrolled up (to prevent auto-scroll when reading history)
  const userScrolledUpRef = useRef(false);

  // Auto-scroll chat to bottom when new messages arrive or displayed content changes
  useEffect(() => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;

      // During streaming, always scroll to bottom aggressively
      // When not streaming, only scroll if user is near the bottom
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

      if (isStreaming || (!userScrolledUpRef.current && isNearBottom)) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [chatHistory, isProcessing, displayedContent, displayedReasoning, isStreaming]);

  // Additional scroll when reasoning completes and content starts
  useEffect(() => {
    if (isReasoningComplete && chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [isReasoningComplete]);

  // Detect when user scrolls up to disable auto-scroll
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      userScrolledUpRef.current = !isNearBottom;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll streaming reasoning to bottom when displayed content updates
  useEffect(() => {
    if (streamingReasoningRef.current && displayedReasoning) {
      streamingReasoningRef.current.scrollTo({
        top: streamingReasoningRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [displayedReasoning]);

  // Smooth chunk queue display loop - creates typewriter effect
  useEffect(() => {
    if (!isStreaming && contentQueueRef.current.length === 0 && reasoningQueueRef.current.length === 0) {
      setIsTyping(false);
      return;
    }

    // Start typing when there's content in the queue
    if ((contentQueueRef.current.length > 0 || reasoningQueueRef.current.length > 0) && !isTyping) {
      setIsTyping(true);
    }

    // Process chunks at a consistent rate for smooth typing effect
    const intervalId = setInterval(() => {
      // Process reasoning queue first using ref for immediate access
      if (reasoningQueueRef.current.length > 0) {
        const nextChunk = reasoningQueueRef.current[0];
        const remainingQueue = reasoningQueueRef.current.slice(1);

        // Update both ref and state atomically
        reasoningQueueRef.current = remainingQueue;
        setReasoningChunkQueue(remainingQueue);
        setDisplayedReasoning(prev => prev + nextChunk);
      }

      // Only process content queue if reasoning is complete
      if (isReasoningCompleteRef.current && contentQueueRef.current.length > 0) {
        const nextChunk = contentQueueRef.current[0];
        const remainingQueue = contentQueueRef.current.slice(1);

        // Update both ref and state atomically
        contentQueueRef.current = remainingQueue;
        setContentChunkQueue(remainingQueue);
        setDisplayedContent(prev => prev + nextChunk);
      }

      // Stop typing when queues are empty and streaming has ended
      if (!isStreaming && contentQueueRef.current.length === 0 && reasoningQueueRef.current.length === 0) {
        setIsTyping(false);
      }
    }, 30); // 30ms per chunk for smooth typing feel

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);


  // Reset displayed content when streaming starts
  useEffect(() => {
    if (isStreaming) {
      setDisplayedContent('');
      setDisplayedReasoning('');
      setContentChunkQueue([]);
      setReasoningChunkQueue([]);
      setIsReasoningComplete(false);
      // Reset refs as well
      contentQueueRef.current = [];
      reasoningQueueRef.current = [];
      isReasoningCompleteRef.current = false;
    }
  }, [isStreaming]);

  // Check if AI is properly configured
  const isAIConfigured = React.useMemo(() => {
    // Only require modelId, as we now support local hosting without API key
    return typeof aiConfig.modelId === 'string' && aiConfig.modelId.trim().length > 0;
  }, [aiConfig.modelId]);

  // Generate unique message ID
  const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Handle regenerating the last response
  const handleRegenerate = useCallback(async () => {
    if (chatHistory.length === 0) return;

    if (!isAIConfigured) {
      setError('Please configure AI settings first');
      return;
    }

    // Find the last user message and remove everything after it
    const lastUserIndex = chatHistory.map((m, i) => ({ ...m, originalIndex: i })).reverse().find(m => m.role === 'user');
    if (!lastUserIndex) return;

    const newHistory = chatHistory.slice(0, lastUserIndex.originalIndex + 1);
    const lastUserMessage = lastUserIndex.content;

    setChatHistory(newHistory);
    setIsProcessing(true);
    setError(null);
    
    // Artificial delay for consistency
    await new Promise(resolve => setTimeout(resolve, 600));

    setIsStreaming(aiConfig.enableStreaming);
    setStreamingContent('');
    setStreamingReasoning('');
    setDisplayedContent('');
    setDisplayedReasoning('');

    try {
      const aiService = new AIService(aiConfig, samplerSettings, promptSettings);
      aiServiceRef.current = aiService;

      // Build conversation context from new history
      const conversationContext = newHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Build context array
      const contextArray: string[] = [];
      if (resolvedContext.length > 0) {
        contextArray.push(...resolvedContext);
      }

      // Streaming callback
      const onChunk = aiConfig.enableStreaming ? (chunk: { content?: string; reasoning?: string }) => {
        if (chunk.reasoning) {
          const newQueue = [...reasoningQueueRef.current, chunk.reasoning];
          reasoningQueueRef.current = newQueue;
          setReasoningChunkQueue(newQueue);
          setStreamingReasoning(prev => prev + chunk.reasoning);
        }

        if (chunk.content) {
          if (!chunk.reasoning && reasoningQueueRef.current.length === 0 && !isReasoningCompleteRef.current) {
            isReasoningCompleteRef.current = true;
            setIsReasoningComplete(true);
          }

          const newQueue = [...contentQueueRef.current, chunk.content];
          contentQueueRef.current = newQueue;
          setContentChunkQueue(newQueue);
          setStreamingContent(prev => prev + chunk.content);
        }
      } : undefined;

      const result = await aiService.askAIWithConversation(
        lastUserMessage,
        contextArray,
        conversationContext,
        undefined,
        onChunk
      );

      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: result.content,
        reasoning: result.reasoning,
        timestamp: Date.now(),
      };

      setChatHistory(prev => [...prev, assistantMessage]);
    } catch (err) {
      if (err instanceof AIError && err.message === 'Request was cancelled') {
        console.log('[AIChatPanel] AI request cancelled by user');
      } else {
        console.error('AI regenerate failed:', err);
        if (err instanceof AIError) {
          setError(err.message);
        } else {
          setError('Failed to get AI response. Please try again.');
        }
      }
    } finally {
      if (displayedReasoning || reasoningQueueRef.current.length > 0) {
        isReasoningCompleteRef.current = true;
        setIsReasoningComplete(true);
      }

      if (reasoningQueueRef.current.length > 0) {
        const remainingReasoning = reasoningQueueRef.current.join('');
        setDisplayedReasoning(prev => prev + remainingReasoning);
        reasoningQueueRef.current = [];
        setReasoningChunkQueue([]);
      }

      if (contentQueueRef.current.length > 0) {
        const remainingContent = contentQueueRef.current.join('');
        setDisplayedContent(prev => prev + remainingContent);
        contentQueueRef.current = [];
        setContentChunkQueue([]);
      }

      setDisplayedContent(prev => prev.length < streamingContent.length ? streamingContent : prev);
      setDisplayedReasoning(prev => prev.length < streamingReasoning.length ? streamingReasoning : prev);

      setIsTyping(false);
      setIsProcessing(false);
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingReasoning('');
      aiServiceRef.current = null;
    }
  }, [chatHistory, resolvedContext, aiConfig, samplerSettings, promptSettings, isAIConfigured, displayedReasoning, streamingContent, streamingReasoning]);

  // Handle ask operation with conversation support
  const handleAsk = useCallback(async () => {
    // If input is empty but last message is a user message, regenerate from it
    if (!askQuestion.trim()) {
      const lastMessage = chatHistory[chatHistory.length - 1];
      if (lastMessage?.role === 'user') {
        await handleRegenerate();
        return;
      }
      return;
    }

    if (!isAIConfigured) {
      setError('Please configure AI settings first');
      return;
    }

    const question = askQuestion.trim();
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };

    // Add user message to chat
    setChatHistory(prev => [...prev, userMessage]);
    setAskQuestion('');
    setIsProcessing(true);
    setError(null);
    
    // Artificial delay to prevent jarring UI updates and ensure "Thinking..." state is visible
    await new Promise(resolve => setTimeout(resolve, 600));

    setIsStreaming(aiConfig.enableStreaming);
    setStreamingContent('');
    setStreamingReasoning('');
    setDisplayedContent('');
    setDisplayedReasoning('');

    try {
      const aiService = new AIService(aiConfig, samplerSettings, promptSettings);
      aiServiceRef.current = aiService;

      // Build conversation context from chat history
      const conversationContext = chatHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
      
      // Build context array - only include resolved context, not selectedText automatically
      const contextArray: string[] = [];
      if (resolvedContext.length > 0) {
        contextArray.push(...resolvedContext);
      }
      
      // Streaming callback for conversation - queues chunks for smooth display
      const onChunk = aiConfig.enableStreaming ? (chunk: { content?: string; reasoning?: string }) => {
        if (chunk.reasoning) {
          // Queue the reasoning chunk - update both ref and state
          const newQueue = [...reasoningQueueRef.current, chunk.reasoning];
          reasoningQueueRef.current = newQueue;
          setReasoningChunkQueue(newQueue);
          // Also update the raw streaming reasoning for final result
          setStreamingReasoning(prev => prev + chunk.reasoning);
        }

        if (chunk.content) {
          // If we receive content and there's no more reasoning coming, mark reasoning as complete
          if (!chunk.reasoning && reasoningQueueRef.current.length === 0 && !isReasoningCompleteRef.current) {
            isReasoningCompleteRef.current = true;
            setIsReasoningComplete(true);
          }

          // Queue the content chunk - update both ref and state
          const newQueue = [...contentQueueRef.current, chunk.content];
          contentQueueRef.current = newQueue;
          setContentChunkQueue(newQueue);
          // Also update the raw streaming content for final result
          setStreamingContent(prev => prev + chunk.content);
        }
      } : undefined;
      
      const result = await aiService.askAIWithConversation(
        question,
        contextArray,
        conversationContext,
        undefined,
        onChunk
      );
      
      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: result.content,
        reasoning: result.reasoning,
        timestamp: Date.now(),
      };
      
      setChatHistory(prev => [...prev, assistantMessage]);
    } catch (err) {
      if (err instanceof AIError && err.message === 'Request was cancelled') {
        console.log('[AIChatPanel] AI request cancelled by user');
      } else {
        console.error('AI ask failed:', err);
        if (err instanceof AIError) {
          setError(err.message);
        } else {
          setError('Failed to get AI response. Please try again.');
        }
      }
    } finally {
      // Mark reasoning as complete when streaming ends (if there was reasoning)
      if (displayedReasoning || reasoningQueueRef.current.length > 0) {
        isReasoningCompleteRef.current = true;
        setIsReasoningComplete(true);
      }

      // Flush any remaining queue content immediately
      if (reasoningQueueRef.current.length > 0) {
        const remainingReasoning = reasoningQueueRef.current.join('');
        setDisplayedReasoning(prev => prev + remainingReasoning);
        reasoningQueueRef.current = [];
        setReasoningChunkQueue([]);
      }

      if (contentQueueRef.current.length > 0) {
        const remainingContent = contentQueueRef.current.join('');
        setDisplayedContent(prev => prev + remainingContent);
        contentQueueRef.current = [];
        setContentChunkQueue([]);
      }

      // Ensure displayed content is at least as complete as streaming content
      setDisplayedContent(prev => prev.length < streamingContent.length ? streamingContent : prev);
      setDisplayedReasoning(prev => prev.length < streamingReasoning.length ? streamingReasoning : prev);

      // If we aborted with partial content, add it as an assistant message
      const lastMessage = chatHistory[chatHistory.length - 1];
      const wasAbortedWithPartial = isStreaming && lastMessage?.role === 'user' && (displayedContent || displayedReasoning);

      if (wasAbortedWithPartial) {
        const assistantMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: displayedContent || streamingContent,
          reasoning: displayedReasoning || streamingReasoning,
          timestamp: Date.now(),
        };
        setChatHistory(prev => [...prev, assistantMessage]);
      }

      // Reset all state
      setIsTyping(false);
      setIsProcessing(false);
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingReasoning('');
      aiServiceRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askQuestion, resolvedContext, aiConfig, samplerSettings, promptSettings, isAIConfigured, chatHistory, handleRegenerate]);

  // Handle starting a new chat (clears chat history)
  const handleNewChat = useCallback(() => {
    setChatHistory([]);
  }, []);

  // Handle aborting the current request
  const handleAbort = useCallback(() => {
    if (aiServiceRef.current) {
      aiServiceRef.current.abort();
    }
  }, []);

  // Format timestamp for display
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Reasoning display component for collapsible reasoning section
  const ReasoningSection: React.FC<{ reasoning: string; defaultExpanded?: boolean }> = ({
    reasoning,
    defaultExpanded = false
  }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const reasoningContentRef = useRef<HTMLDivElement>(null);

    // Auto-scroll reasoning to bottom when content updates
    useEffect(() => {
      if (reasoningContentRef.current && reasoning) {
        reasoningContentRef.current.scrollTop = reasoningContentRef.current.scrollHeight;
      }
    }, [reasoning]);
    
    if (!reasoning || reasoning.trim().length === 0) {
      return null;
    }
    
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
          <span className="text-xs text-vault-500 dark:text-vault-500">
            {isExpanded ? 'Hide' : 'Show'}
          </span>
        </button>
        {isExpanded && (
          <div ref={reasoningContentRef} className="max-h-40 overflow-y-auto px-2 py-2 bg-vault-50 dark:bg-vault-800/50 border-t border-vault-200 dark:border-vault-700">
            <pre className="text-xs font-mono text-vault-700 dark:text-vault-300 whitespace-pre-wrap wrap-break-word leading-relaxed">
              {reasoning}
            </pre>
          </div>
        )}
      </div>
    );
  };

  // Copy button component for assistant messages
  const CopyButton: React.FC<{ content: string }> = ({ content }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    };

    return (
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-md text-vault-400 hover:text-vault-600 dark:hover:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-700/50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
        title={copied ? 'Copied!' : 'Copy to clipboard'}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    );
  };

  // Regenerate button component for assistant messages
  const RegenerateButton: React.FC<{ messageIndex: number }> = ({ messageIndex }) => {
    // Only show on the most recent assistant message when it's the last message
    const isLastMessage = messageIndex === chatHistory.length - 1;
    if (!isLastMessage) return null;

    return (
      <button
        onClick={() => void handleRegenerate()}
        disabled={isProcessing}
        className="p-1.5 rounded-md text-vault-400 hover:text-vault-600 dark:hover:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-700/50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
        title="Regenerate response"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    );
  };

  return (
    <div className="h-full flex flex-col bg-vault-50 dark:bg-vault-900 border-l border-vault-200 dark:border-vault-800 animate-fade-in-slow">
      {/* Animation styles for smooth message appearance */}
      <style>{`
        @keyframes message-appear {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .message-animate {
          animation: message-appear 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-vault-200 dark:border-vault-800 bg-vault-100 dark:bg-vault-800/50 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-vault-600 dark:text-vault-400" />
          <h2 className="font-semibold text-vault-900 dark:text-vault-100">
            Ask Zoggy
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {chatHistory.length > 0 && (
            <button
              onClick={handleNewChat}
              className="p-1.5 text-vault-500 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-200 hover:bg-vault-200 dark:hover:bg-vault-800 rounded-lg transition-colors"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-vault-500 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-200 hover:bg-vault-200 dark:hover:bg-vault-800 rounded-lg transition-colors ml-1"
              title="Close AI Chat Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-3 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-red-600 dark:text-red-400 text-sm shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="p-0.5 text-red-400 hover:text-red-600 dark:hover:text-red-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Chat Messages - flex-1 to push input to bottom */}
      <div className="border-b border-vault-200 dark:border-vault-800 flex-1 flex flex-col min-h-0">
        <div 
          ref={chatContainerRef}
          className="px-4 pt-2 pb-4 space-y-4 overflow-y-auto flex-1 min-h-0"
        >
          {chatHistory.length === 0 && (
            <div className="text-center py-8 text-vault-400 dark:text-vault-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Hi, I'm Zoggy!</p>
              <p className="text-xs mt-1">Ask me anything about your character card, or just chat with me! Don't forget to add your context!</p>
            </div>
          )}
          
          {chatHistory.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`relative max-w-[90%] rounded-lg px-3 py-2 group message-animate ${
                  message.role === 'user'
                    ? 'bg-vault-600 text-white rounded-br-none'
                    : 'bg-white dark:bg-vault-800 border border-vault-200 dark:border-vault-700 text-vault-900 dark:text-vault-100 rounded-bl-none'
                }`}
              >
                {message.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none pb-6">
                    {/* Display reasoning if available and showReasoning is not false */}
                    {message.reasoning && aiConfig.showReasoning !== false && (
                      <ReasoningSection reasoning={message.reasoning} />
                    )}
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Style code blocks with dark background
                        code({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { className?: string }) {
                          const isInline = !className?.includes('language-');
                          return (
                            <code
                              className={`${className || ''} ${isInline 
                                ? 'bg-vault-100 dark:bg-vault-700 px-1 py-0.5 rounded text-vault-800 dark:text-vault-200' 
                                : 'block bg-vault-900 text-vault-100 p-3 rounded-lg overflow-x-auto'} font-mono text-sm`}
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                        // Style pre blocks
                        pre({ children }: React.ComponentPropsWithoutRef<'pre'>) {
                          return (
                            <pre className="bg-vault-900 text-vault-100 p-3 rounded-lg overflow-x-auto my-2">
                              {children}
                            </pre>
                          );
                        },
                        // Style links
                        a({ href, children, ...props }: React.ComponentPropsWithoutRef<'a'>) {
                          return (
                            <a 
                              href={href} 
                              className="text-vault-600 dark:text-vault-400 hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                              {...props}
                            >
                              {children}
                            </a>
                          );
                        },
                        // Style lists
                        ul({ children }: React.ComponentPropsWithoutRef<'ul'>) {
                          return <ul className="list-disc pl-5 my-2">{children}</ul>;
                        },
                        ol({ children }: React.ComponentPropsWithoutRef<'ol'>) {
                          return <ol className="list-decimal pl-5 my-2">{children}</ol>;
                        },
                        // Style blockquotes
                        blockquote({ children }: React.ComponentPropsWithoutRef<'blockquote'>) {
                          return (
                            <blockquote className="border-l-4 border-vault-300 dark:border-vault-600 pl-4 italic my-2 text-vault-600 dark:text-vault-400">
                              {children}
                            </blockquote>
                          );
                        },
                        // Style horizontal rules
                        hr() {
                          return <hr className="border-vault-200 dark:border-vault-700 my-4" />;
                        },
                        // Style headings
                        h1({ children }: React.ComponentPropsWithoutRef<'h1'>) {
                          return <h1 className="text-lg font-bold my-3">{children}</h1>;
                        },
                        h2({ children }: React.ComponentPropsWithoutRef<'h2'>) {
                          return <h2 className="text-base font-bold my-2">{children}</h2>;
                        },
                        h3({ children }: React.ComponentPropsWithoutRef<'h3'>) {
                          return <h3 className="text-sm font-bold my-2">{children}</h3>;
                        },
                        // Style paragraphs
                        p({ children }: React.ComponentPropsWithoutRef<'p'>) {
                          return <p className="my-1.5">{children}</p>;
                        },
                        // Style tables
                        table({ children }: React.ComponentPropsWithoutRef<'table'>) {
                          return (
                            <div className="overflow-x-auto my-4 rounded-lg border border-vault-200 dark:border-vault-700">
                              <table className="min-w-full divide-y divide-vault-200 dark:divide-vault-700">
                                {children}
                              </table>
                            </div>
                          );
                        },
                        thead({ children }: React.ComponentPropsWithoutRef<'thead'>) {
                          return <thead className="bg-vault-100 dark:bg-vault-800">{children}</thead>;
                        },
                        tbody({ children }: React.ComponentPropsWithoutRef<'tbody'>) {
                          return <tbody className="divide-y divide-vault-200 dark:divide-vault-700">{children}</tbody>;
                        },
                        tr({ children }: React.ComponentPropsWithoutRef<'tr'>) {
                          return <tr>{children}</tr>;
                        },
                        th({ children }: React.ComponentPropsWithoutRef<'th'>) {
                          return (
                            <th className="px-3 py-2 text-left text-xs font-medium text-vault-500 dark:text-vault-400 uppercase tracking-wider bg-vault-50 dark:bg-vault-900/50">
                              {children}
                            </th>
                          );
                        },
                        td({ children }: React.ComponentPropsWithoutRef<'td'>) {
                          return (
                            <td className="px-3 py-2 text-sm text-vault-700 dark:text-vault-300">
                              {children}
                            </td>
                          );
                        },
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                    <div className="absolute bottom-2 right-2 flex gap-1">
                      <CopyButton content={message.content} />
                      <RegenerateButton messageIndex={chatHistory.findIndex(m => m.id === message.id)} />
                    </div>
                  </div>
                )}
                <span
                  className={`text-xs mt-1 block ${
                    message.role === 'user'
                      ? 'text-vault-200'
                      : 'text-vault-500 dark:text-vault-400'
                  }`}
                >
                  {formatTime(message.timestamp)}
                </span>
              </div>
            </div>
          ))}
          
          {/* Streaming indicator in chat */}
          {isStreaming && (displayedContent || displayedReasoning) && (
            <div className="flex justify-start">
              <div className="max-w-[90%] bg-white dark:bg-vault-800 border border-vault-200 dark:border-vault-700 rounded-lg rounded-bl-none px-3 py-2 message-animate">
                {/* Display streaming reasoning if available and showReasoning is not false */}
                {displayedReasoning && aiConfig.showReasoning !== false && (
                  <div className="mb-2 border border-vault-300 dark:border-vault-600 rounded-md overflow-hidden">
                    <div className="flex items-center justify-between px-2 py-1.5 bg-vault-100 dark:bg-vault-700/50">
                      <span className="text-xs font-medium text-vault-600 dark:text-vault-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Thinking process
                      </span>
                      <span className="text-xs text-vault-500 dark:text-vault-500">Streaming...</span>
                    </div>
                    <div ref={streamingReasoningRef} className="max-h-40 overflow-y-auto px-2 py-2 bg-vault-50 dark:bg-vault-800/50 border-t border-vault-200 dark:border-vault-700">
                      <pre className="text-xs font-mono text-vault-700 dark:text-vault-300 whitespace-pre-wrap wrap-break-word leading-relaxed">
                        {displayedReasoning}
                      </pre>
                    </div>
                  </div>
                )}
                {displayedContent && (
                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none text-vault-900 dark:text-vault-100">
                    <StreamingMarkdown
                      content={displayedContent}
                      isStreaming={isTyping}
                      showCursor={true}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Loading indicator in chat */}
          {isProcessing && (!isStreaming || (!displayedContent && !displayedReasoning)) && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-vault-800 border border-vault-200 dark:border-vault-700 rounded-lg rounded-bl-none px-3 py-2 flex items-center gap-2 message-animate">
                <Loader2 className="w-4 h-4 animate-spin text-vault-600 dark:text-vault-400" />
                <span className="text-sm text-vault-600 dark:text-vault-400">AI is thinking...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-3 space-y-3 bg-vault-100 dark:bg-vault-800/50 shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={askQuestion}
            onChange={(e) => setAskQuestion(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 px-3 py-2 text-sm border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-700 text-vault-900 dark:text-vault-100 placeholder-vault-400 focus:outline-none focus:ring-2 focus:ring-vault-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isProcessing && askQuestion.trim()) {
                void handleAsk();
              }
            }}
            disabled={isProcessing}
          />
          <button
            onClick={() => void (isProcessing ? handleAbort() : handleAsk())}
            disabled={!isProcessing && !askQuestion.trim() && (!chatHistory.length || chatHistory[chatHistory.length - 1]?.role !== 'user')}
            className={`px-3 py-2 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              isProcessing
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-vault-600 hover:bg-vault-700 disabled:opacity-50'
            }`}
          >
            {isProcessing ? (
              <Square className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

export default AIChatPanel;
