import React, { memo, useCallback } from 'react';
import { Pencil, X } from 'lucide-react';
import { stripFences } from '../core/stripFences';
import { CopyButton } from '../../components/ai/components/CopyButton';
import { DeleteMessageButton } from '../../components/ai/components/DeleteMessageButton';
import { LazyMarkdown } from '../../components/ai/components/LazyMarkdown';
import { RegenerateButton } from '../../components/ai/components/RegenerateButton';
import type { ChatMessage } from '../../components/ai/types';
import { formatTime } from '../../components/ai/utils';
import { FoldedText } from '../../components/ai/components/FoldedText';
import { StatsInfoButton } from '../../components/ai/components/StatsInfoButton';
import { HoverInfoTip } from './HoverInfoTip';
import { TURN_LIMIT_NOTICE } from './notices';
import { ToolEventList } from './ToolEventList';
import type { AgentToolEvent, AgentToolTarget } from './types';

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
  onOpenTarget,
  onContinue,
  onEdit,
  onCancelEdit,
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
  onOpenTarget?: (target: AgentToolTarget) => void;
  /** Shown on the turn-limit notice; pass only for the latest message. */
  onContinue?: () => void;
  /** Pass only for the last user message. */
  onEdit?: () => void;
  /** Pass only while this message is being edited. */
  onCancelEdit?: () => void;
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
          <p className={`${onEdit || onCancelEdit ? 'pr-15' : 'pr-8'} text-sm whitespace-pre-wrap`}>{message.content}</p>
          <div className="absolute top-1.5 right-1.5 flex gap-0.5">
            {onCancelEdit ? (
              <button
                type="button"
                onClick={onCancelEdit}
                disabled={isProcessing}
                className="p-1.5 rounded-md transition-all disabled:opacity-40 disabled:pointer-events-none text-accent-fg bg-white/20 hover:bg-white/25"
                title="Cancel edit"
                aria-label="Cancel edit"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                disabled={isProcessing}
                className="p-1.5 rounded-md transition-all focus:opacity-100 disabled:opacity-40 disabled:pointer-events-none opacity-100 md:opacity-0 md:group-hover:opacity-100 text-accent-fg/70 hover:text-accent-fg hover:bg-white/15"
                title="Edit and resend"
                aria-label="Edit and resend"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            ) : null}
            <DeleteMessageButton onDelete={handleDelete} disabled={isProcessing} variant="onAccent" />
          </div>
          <span className="mt-1.5 flex items-center text-[11px] text-accent-fg/70">
            {formatTime(message.timestamp)}
            {onCancelEdit ? (
              <span className="ml-1.5" title="Send to replace this message and the replies after it">
                · Editing
              </span>
            ) : null}
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
  const speech = stripFences(message.content);

  return (
    <div className={`group space-y-1.5 ${message.suppressInitialAnimation ? '' : 'message-animate'}`}>
      {reasoning ? (
        <FoldedText label="Thinking">
          {reasoning}
        </FoldedText>
      ) : null}

      {speech ? (
        <div className="prose prose-sm dark:prose-invert min-w-0 max-w-none text-sm text-fg">
          <LazyMarkdown content={speech} />
        </div>
      ) : recapLine ? (
        <p className="text-xs text-fg-muted">{recapLine}</p>
      ) : null}

      <ToolEventList events={toolEvents} onOpenTarget={onOpenTarget} />

      {notices.length > 0 ? (
        <ul className="space-y-1">
          {notices.map((notice, noticeIndex) => {
            const turnLimit = notice === TURN_LIMIT_NOTICE;
            return (
              <li
                key={`${noticeIndex}-${notice}`}
                className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs leading-5 ${
                  turnLimit
                    ? 'bg-warning-soft text-warning-soft-fg'
                    : 'bg-danger-soft text-danger-soft-fg'
                }`}
              >
                <span className="min-w-0 flex-1">{notice}</span>
                {turnLimit && onContinue ? (
                  <button
                    type="button"
                    onClick={onContinue}
                    className="shrink-0 rounded-md border border-warning/40 px-2 font-medium hover:opacity-90"
                  >
                    Continue
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="flex items-center gap-1 text-[11px] text-fg-muted">
        <span>{formatTime(message.timestamp)}</span>
        {message.stats ? <StatsInfoButton stats={message.stats} /> : null}
        <span className="ml-auto flex gap-0.5">
          {speech ? <CopyButton content={speech} /> : null}
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
