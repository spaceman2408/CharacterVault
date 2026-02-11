/**
 * @fileoverview Single chat message component for AI chat.
 * @module components/ai/components/ChatMessage
 */

import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage as ChatMessageType } from '../types';
import { formatTime } from '../utils';
import { markdownComponents } from '../config/markdownComponents';
import { ReasoningSection } from './ReasoningSection';
import { CopyButton } from './CopyButton';
import { RegenerateButton } from './RegenerateButton';

/**
 * Props for the ChatMessage component
 */
export interface ChatMessageProps {
  /** The chat message to render */
  message: ChatMessageType;
  /** Index of the message in the chat history */
  messageIndex: number;
  /** Total length of the chat history */
  chatHistoryLength: number;
  /** Whether to show reasoning sections */
  showReasoning?: boolean;
  /** Whether an AI request is currently processing */
  isProcessing: boolean;
  /** Callback to regenerate the response */
  onRegenerate: () => void;
}

/**
 * Single chat message component.
 * Renders user messages as simple text with timestamp.
 * Renders assistant messages with markdown, reasoning, copy button, and regenerate button.
 */
export const ChatMessage: React.FC<ChatMessageProps> = memo(({
  message,
  messageIndex,
  chatHistoryLength,
  showReasoning = true,
  isProcessing,
  onRegenerate
}) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[90%] rounded-lg px-3 py-2 group message-animate ${
          isUser
            ? 'bg-vault-600 text-white rounded-br-none'
            : 'bg-white dark:bg-vault-800 border border-vault-200 dark:border-vault-700 text-vault-900 dark:text-vault-100 rounded-bl-none'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none pb-6">
            {/* Display reasoning if available and showReasoning is not false */}
            {message.reasoning && showReasoning !== false && (
              <ReasoningSection reasoning={message.reasoning} />
            )}
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
            <div className="absolute bottom-2 right-2 flex gap-1">
              <CopyButton content={message.content} />
              <RegenerateButton
                messageIndex={messageIndex}
                chatHistoryLength={chatHistoryLength}
                onRegenerate={onRegenerate}
                isProcessing={isProcessing}
              />
            </div>
          </div>
        )}
        <span
          className={`text-xs mt-1 block ${
            isUser
              ? 'text-vault-200'
              : 'text-vault-500 dark:text-vault-400'
          }`}
        >
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
