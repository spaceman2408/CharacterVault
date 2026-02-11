/**
 * @fileoverview Barrel export for AI components.
 * @module components/ai
 */

export { ContextPanel } from './ContextPanel';
export { AIToolbar, type AIOperation } from './AIToolbar';
export { AIChatPanel, type AIChatPanelProps, type ChatMessage } from './AIChatPanel';
export { StreamingText, StreamingMarkdown, type StreamingTextProps } from './StreamingText';

// Types
export type {
  ChatMessage as ChatMessageType,
  AIChatPanelProps as AIChatPanelPropsType,
  SelectionInfo,
  StreamingChunk,
  ConversationMessage,
} from './types';

// Utils
export { formatTime, generateMessageId } from './utils';

// Config
export { markdownComponents } from './config/markdownComponents';

// Hooks
export {
  useTypewriter,
  type UseTypewriterReturn,
  useAutoScroll,
  type UseAutoScrollOptions,
  type UseAutoScrollReturn,
  useAIChat,
  type UseAIChatOptions,
  type UseAIChatReturn,
} from './hooks';
