import React, { memo, useCallback } from 'react';
import { CopyButton } from '../../components/ai/components/CopyButton';
import { DeleteMessageButton } from '../../components/ai/components/DeleteMessageButton';
import { LazyMarkdown } from '../../components/ai/components/LazyMarkdown';
import { RegenerateButton } from '../../components/ai/components/RegenerateButton';
import type { ChatMessage } from '../../components/ai/types';
import { formatTime } from '../../components/ai/utils';
import { FoldedText } from '../../components/ai/components/FoldedText';
import { StatsInfoButton } from '../../components/ai/components/StatsInfoButton';
import { HoverInfoTip } from './HoverInfoTip';
import { ToolEventList } from './ToolEventList';
import type { AgentToolEvent } from './types';

export const AgentChatMessage = memo(function AgentChatMessage({
  message,
  messageIndex,
  chatHistoryLength,
  isProcessing,
  showReasoning,
  showRegenerate,
  notices,
  toolEvents,
  recapLine,
  onRegenerate,
  onDelete,
}: {
  message: ChatMessage;
  messageIndex: number;
  chatHistoryLength: number;
  isProcessing: boolean;
  showReasoning: boolean;
  showRegenerate: boolean;
  notices: string[];
  toolEvents: AgentToolEvent[];
  recapLine?: string | null;
  onRegenerate: () => void;
  onDelete: (messageId: string) => void;
}): React.ReactElement {
  const handleDelete = useCallback(() => {
    onDelete(message.id);
  }, [onDelete, message.id]);

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className={`group relative max-w-[90%] rounded-xl rounded-br-md bg-accent px-3 py-2 text-accent-fg shadow-sm ${
            message.suppressInitialAnimation ? '' : 'message-animate'
          }`}
        >
          <p className="pr-8 text-sm whitespace-pre-wrap">{message.content}</p>
          <div className="absolute top-1.5 right-1.5 flex gap-0.5">
            <DeleteMessageButton onDelete={handleDelete} disabled={isProcessing} variant="onAccent" />
          </div>
          <span className="mt-1.5 flex items-center text-[11px] text-accent-fg/70">
            {formatTime(message.timestamp)}
            {notices.length > 0 ? (
              <HoverInfoTip label="Message notes">
                {notices.map((notice, noticeIndex) => (
                  <div key={`${noticeIndex}-${notice}`}>{notice}</div>
                ))}
              </HoverInfoTip>
            ) : null}
          </span>
        </div>
      </div>
    );
  }

  const reasoning = showReasoning ? message.reasoning?.trim() : '';
  const speech = message.content.trim();

  return (
    <div className={`group space-y-1.5 ${message.suppressInitialAnimation ? '' : 'message-animate'}`}>
      {reasoning ? (
        <FoldedText label="Thinking">
          {reasoning}
        </FoldedText>
      ) : null}

      {speech ? (
        <div className="prose prose-sm dark:prose-invert min-w-0 max-w-none text-sm text-fg">
          <LazyMarkdown content={message.content} />
        </div>
      ) : recapLine ? (
        <p className="text-xs text-fg-muted">{recapLine}</p>
      ) : null}

      <ToolEventList events={toolEvents} />

      {notices.length > 0 ? (
        <ul className="space-y-1">
          {notices.map((notice, noticeIndex) => (
            <li
              key={`${noticeIndex}-${notice}`}
              className="rounded-md bg-danger-soft px-2 py-1 text-xs leading-5 text-danger-soft-fg"
            >
              {notice}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center gap-1 text-[11px] text-fg-muted">
        <span>{formatTime(message.timestamp)}</span>
        {message.stats ? <StatsInfoButton stats={message.stats} /> : null}
        <span className="ml-auto flex gap-0.5">
          {speech ? <CopyButton content={message.content} /> : null}
          {showRegenerate ? (
            <RegenerateButton
              messageIndex={messageIndex}
              chatHistoryLength={chatHistoryLength}
              onRegenerate={onRegenerate}
              isProcessing={isProcessing}
            />
          ) : null}
          <DeleteMessageButton onDelete={handleDelete} disabled={isProcessing} />
        </span>
      </div>
    </div>
  );
});
