/**
 * @fileoverview Live assistant output while a reply is in flight (plain text).
 * @module components/ai/StreamingText
 */

import React from 'react';

export interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
  showCursor?: boolean;
  className?: string;
}

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

/** Alias for call sites; still plain text while live. */
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
