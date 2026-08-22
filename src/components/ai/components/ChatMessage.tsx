/**
 * @fileoverview Single chat message component for AI chat.
 * @module components/ai/components/ChatMessage
 */

import React, { memo, useCallback } from 'react';
import type { ChatMessage as ChatMessageType } from '../types';
import { formatTime } from '../utils';
import { CopyButton } from './CopyButton';
import { DeleteMessageButton } from './DeleteMessageButton';
import { FoldedText } from './FoldedText';
import { LazyMarkdown } from './LazyMarkdown';
import { RegenerateButton } from './RegenerateButton';
import { StatsInfoButton } from './StatsInfoButton';

export interface ChatMessageProps {
  message: ChatMessageType;
  messageIndex: number;
  chatHistoryLength: number;
  showReasoning?: boolean;
  showRegenerate?: boolean;
  isProcessing: boolean;
  onRegenerate: () => void;
  onDelete: (messageId: string) => void;
}

const AssistantMessageBody = memo(function AssistantMessageBody({
  content,
  reasoning,
  showReasoning,
}: {
  content: string;
  reasoning?: string;
  showReasoning: boolean;
}) {
  const trimmedReasoning = showReasoning ? reasoning?.trim() : '';

  return (
    <>
      {trimmedReasoning ? (
        <div className="mb-2">
          <FoldedText label="Thinking">{trimmedReasoning}</FoldedText>
        </div>
      ) : null}
      <LazyMarkdown content={content} />
    </>
  );
});

export const ChatMessage: React.FC<ChatMessageProps> = memo(
  ({
    message,
    messageIndex,
    chatHistoryLength,
    showReasoning = true,
    showRegenerate = true,
    isProcessing,
    onRegenerate,
    onDelete,
  }) => {
    const isUser = message.role === 'user';
    const animationClass = message.suppressInitialAnimation ? '' : 'message-animate';

    const handleDelete = useCallback(() => {
      onDelete(message.id);
    }, [onDelete, message.id]);

    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`relative max-w-[90%] rounded-xl px-3 py-2 group shadow-sm ${animationClass} ${
            isUser
              ? 'bg-accent text-accent-fg rounded-br-md'
              : 'bg-surface border border-border text-fg rounded-bl-md'
          }`}
        >
          {isUser ? (
            <>
              <p className="text-sm whitespace-pre-wrap pr-8">{message.content}</p>
              <div className="absolute top-1.5 right-1.5 flex gap-0.5">
                <DeleteMessageButton
                  onDelete={handleDelete}
                  disabled={isProcessing}
                  variant="onAccent"
                />
              </div>
            </>
          ) : (
            <div className="text-sm prose prose-sm dark:prose-invert max-w-none pb-6">
              <AssistantMessageBody
                content={message.content}
                reasoning={message.reasoning}
                showReasoning={showReasoning !== false}
              />
              <div className="absolute bottom-2 right-2 flex gap-0.5">
                <CopyButton content={message.content} />
                {showRegenerate && (
                  <RegenerateButton
                    messageIndex={messageIndex}
                    chatHistoryLength={chatHistoryLength}
                    onRegenerate={onRegenerate}
                    isProcessing={isProcessing}
                  />
                )}
                <DeleteMessageButton onDelete={handleDelete} disabled={isProcessing} />
              </div>
            </div>
          )}
          <span
            className={`text-[11px] mt-1.5 block ${
              isUser ? 'text-accent-fg/70' : 'text-fg-muted'
            }`}
          >
            {formatTime(message.timestamp)}
            {!isUser && message.stats ? <StatsInfoButton stats={message.stats} /> : null}
          </span>
        </div>
      </div>
    );
  }
);

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
