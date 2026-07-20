/**
 * @fileoverview StreamingText — live assistant output while a reply is in flight.
 *
 * Intentionally plain text during the stream: re-parsing markdown on every
 * chunk (or rAF tick) is a major heap source. Committed messages use full
 * markdown + rehype via LazyMarkdown / ChatMessage.
 * @module components/ai/StreamingText
 */

import React from 'react';

/**
 * Props for the StreamingText component
 */
export interface StreamingTextProps {
  /** The content to display */
  content: string;
  /** Whether content is currently streaming */
  isStreaming: boolean;
  /** Whether to show a cursor at the end */
  showCursor?: boolean;
  /** Optional CSS class for styling */
  className?: string;
}

/**
 * Live stream renderer — plain text + optional cursor. No remark/rehype.
 */
export function StreamingText({
  content,
  isStreaming,
  showCursor = false,
  className = '',
}: StreamingTextProps): React.ReactElement {
  const cursorElement = showCursor && isStreaming ? (
    <span className="inline-block w-2 h-4 ml-1 bg-fg-muted animate-pulse" />
  ) : null;

  return (
    <span className={`whitespace-pre-wrap ${className}`.trim()}>
      {content}
      {cursorElement}
    </span>
  );
}

/**
 * StreamingMarkdown — kept as an alias for call sites; still plain text while live.
 * Full markdown is applied when the turn is committed into ChatMessage.
 */
export function StreamingMarkdown({
  content,
  isStreaming,
  showCursor = false,
  className = '',
}: StreamingTextProps): React.ReactElement {
  return (
    <StreamingText
      content={content}
      isStreaming={isStreaming}
      showCursor={showCursor}
      className={className}
    />
  );
}

export default StreamingText;
