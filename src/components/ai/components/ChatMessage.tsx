/**
 * @fileoverview Single chat message component for AI chat.
 * @module components/ai/components/ChatMessage
 */

import React, { memo, useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Info } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../types';
import { formatTime } from '../utils';
import { markdownComponents, markdownRehypePlugins } from '../config/markdownComponents';
import { ReasoningSection } from './ReasoningSection';
import { CopyButton } from './CopyButton';
import { RegenerateButton } from './RegenerateButton';
import { DeleteMessageButton } from './DeleteMessageButton';

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
  /** Delete this message and everything after it */
  onDelete: (messageId: string) => void;
}

const STATS_TOOLTIP_MAX_WIDTH = 280;
const STATS_TOOLTIP_GAP = 8;
const STATS_TOOLTIP_VIEWPORT_PAD = 8;

/**
 * Stats info control — hover (desktop) or tap (mobile).
 * Portaled + fixed so long model names are not clipped by the chat scroller / editor.
 */
const StatsInfoButton: React.FC<{ message: ChatMessageType }> = ({ message }) => {
  const [hovered, setHovered] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isOpen = hovered || pinnedOpen;

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;
    const tooltipWidth = Math.min(
      STATS_TOOLTIP_MAX_WIDTH,
      Math.max(tooltipEl?.offsetWidth || 0, 120)
    );
    const tooltipHeight = tooltipEl?.offsetHeight || 80;

    // Prefer above the icon; flip below if not enough room
    const placeAbove =
      rect.top >= tooltipHeight + STATS_TOOLTIP_GAP + STATS_TOOLTIP_VIEWPORT_PAD;

    let top = placeAbove
      ? rect.top - STATS_TOOLTIP_GAP - tooltipHeight
      : rect.bottom + STATS_TOOLTIP_GAP;

    // Left-align to icon, clamp so wide model IDs stay in the viewport
    let left = rect.left;
    const maxLeft = window.innerWidth - tooltipWidth - STATS_TOOLTIP_VIEWPORT_PAD;
    left = Math.max(STATS_TOOLTIP_VIEWPORT_PAD, Math.min(left, maxLeft));

    top = Math.max(
      STATS_TOOLTIP_VIEWPORT_PAD,
      Math.min(top, window.innerHeight - tooltipHeight - STATS_TOOLTIP_VIEWPORT_PAD)
    );

    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    // Second pass after content lays out (long model names change size)
    const id = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(id);
  }, [isOpen, updatePosition, message.stats]);

  useEffect(() => {
    if (!isOpen) return;
    const onReposition = () => updatePosition();
    window.addEventListener('resize', onReposition);
    // Capture phase: chat list scrolls on an inner element
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [isOpen, updatePosition]);

  // Close tap-to-pin when clicking outside (mobile)
  useEffect(() => {
    if (!pinnedOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || tooltipRef.current?.contains(target)) {
        return;
      }
      setPinnedOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [pinnedOpen]);

  const stats = message.stats;
  if (!stats) return null;

  const hasAnyStat =
    typeof stats.ttft === 'number' ||
    typeof stats.tokensPerSecond === 'number' ||
    !!stats.modelId ||
    !!stats.providerId;

  if (!hasAnyStat) return null;

  const tooltip = isOpen
    ? createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: 'fixed',
            top: coords?.top ?? -9999,
            left: coords?.left ?? -9999,
            maxWidth: STATS_TOOLTIP_MAX_WIDTH,
            zIndex: 9999,
            visibility: coords ? 'visible' : 'hidden',
          }}
          className="px-2.5 py-1.5 bg-surface text-fg rounded-lg shadow-lg border border-border text-left text-xs leading-5 pointer-events-none"
        >
          {typeof stats.ttft === 'number' && <div>TTFT: {stats.ttft}ms</div>}
          {typeof stats.tokensPerSecond === 'number' && (
            <div>Speed: {stats.tokensPerSecond.toFixed(2)} t/s</div>
          )}
          {stats.modelId && (
            <div className="break-all">
              <span className="text-fg-muted">Model: </span>
              {stats.modelId}
            </div>
          )}
          {stats.providerId && (
            <div className="break-all">
              <span className="text-fg-muted">Provider: </span>
              {stats.providerId}
            </div>
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <span className="relative inline-flex items-center ml-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={e => {
          e.stopPropagation();
          setPinnedOpen(prev => !prev);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="p-0.5 rounded-full text-fg-subtle hover:text-fg hover:bg-hover transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        aria-label="Response stats"
        aria-expanded={isOpen}
      >
        <Info className="w-3 h-3" />
      </button>
      {tooltip}
    </span>
  );
};

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
  onRegenerate,
  onDelete,
}) => {
  const isUser = message.role === 'user';
  const animationClass = message.suppressInitialAnimation ? '' : 'message-animate';

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
                onDelete={() => onDelete(message.id)}
                disabled={isProcessing}
                variant="onAccent"
              />
            </div>
          </>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none pb-6">
            {message.reasoning && showReasoning !== false && (
              <ReasoningSection reasoning={message.reasoning} />
            )}
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={markdownRehypePlugins}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
            <div className="absolute bottom-2 right-2 flex gap-0.5">
              <CopyButton content={message.content} />
              <RegenerateButton
                messageIndex={messageIndex}
                chatHistoryLength={chatHistoryLength}
                onRegenerate={onRegenerate}
                isProcessing={isProcessing}
              />
              <DeleteMessageButton
                onDelete={() => onDelete(message.id)}
                disabled={isProcessing}
              />
            </div>
          </div>
        )}
        <span
          className={`text-[11px] mt-1.5 block ${
            isUser ? 'text-accent-fg/70' : 'text-fg-muted'
          }`}
        >
          {formatTime(message.timestamp)}
          {!isUser && <StatsInfoButton message={message} />}
        </span>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
