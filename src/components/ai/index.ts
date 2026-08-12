/**
 * @fileoverview Barrel export for AI components.
 * @module components/ai
 */

export { ContextPanel } from './ContextPanel';
export { CustomContextBlock, type CustomContextBlockProps } from './CustomContextBlock';
export { CustomContextModal, type CustomContextModalProps } from './CustomContextModal';
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

// Re-export AIOperation from CharacterVault db types for convenience
export type { AIOperation } from '../../db/characterTypes';

// Utils
export { formatTime, generateMessageId } from './utils';

// Config
export { markdownComponents } from './config/markdownComponents';

// Hooks
export {
  useAutoScroll,
  type UseAutoScrollOptions,
  type UseAutoScrollReturn,
  useAIChat,
  type UseAIChatOptions,
  type UseAIChatReturn,
} from './hooks';
