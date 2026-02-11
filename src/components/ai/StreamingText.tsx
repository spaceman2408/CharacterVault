/**
 * @fileoverview StreamingText component - Renders text with smooth fade-in animation for new content.
 * This component eliminates the jarring chunk-by-chunk appearance of streaming text by
 * animating only the newly received content with a subtle opacity transition.
 * @module components/ai/StreamingText
 */

import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { markdownComponents } from './config/markdownComponents';

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
  /** Whether to render as markdown */
  renderMarkdown?: boolean;
  /** Custom components for markdown rendering */
  components?: Components;
}

/**
 * StreamingText component - Renders text with smooth fade-in animation for streaming content.
 * 
 * Features:
 * - Smooth fade-in animation for new content chunks (150-200ms ease-out)
 * - Only animates NEW content, not the entire text
 * - Maintains cursor animation during streaming
 * - Supports both plain text and markdown rendering
 * - Works seamlessly with reasoning content
 * 
 * @example
 * ```tsx
 * <StreamingText
 *   content={streamingContent}
 *   isStreaming={isStreaming}
 *   showCursor={true}
 *   renderMarkdown={true}
 * />
 * ```
 */
export function StreamingText({
  content,
  isStreaming,
  showCursor = false,
  className = '',
  renderMarkdown = false,
  components = {},
}: StreamingTextProps): React.ReactElement {
  const [animatedContent, setAnimatedContent] = useState<{
    previous: string;
    new: string;
    key: number;
  }>({
    previous: '',
    new: content,
    key: 0,
  });

  const previousContentRef = useRef(content);
  const animationKeyRef = useRef(0);

  // Track content changes and trigger animations for new chunks
  useEffect(() => {
    const previousContent = previousContentRef.current;
    
    if (content !== previousContent) {
      // Determine what content is new
      const isAppend = content.startsWith(previousContent);
      
      if (isStreaming && isAppend && previousContent.length > 0) {
        // Content is being appended - animate only the new part
        const newPart = content.slice(previousContent.length);
        animationKeyRef.current += 1;
        
        setAnimatedContent({
          previous: previousContent,
          new: newPart,
          key: animationKeyRef.current,
        });
      } else {
        // Full replacement or initial load - show all content
        setAnimatedContent({
          previous: '',
          new: content,
          key: animationKeyRef.current,
        });
      }
      
      previousContentRef.current = content;
    }
  }, [content, isStreaming]);

  // Reset when streaming starts
  useEffect(() => {
    if (isStreaming) {
      previousContentRef.current = '';
      setAnimatedContent({
        previous: '',
        new: content,
        key: animationKeyRef.current,
      });
    }
  }, [isStreaming, content]);

  const cursorElement = showCursor && isStreaming ? (
    <span className="inline-block w-2 h-4 ml-1 bg-vault-600 animate-pulse" />
  ) : null;

  if (renderMarkdown) {
    return (
      <div className={className}>
        {animatedContent.previous && (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {animatedContent.previous}
          </ReactMarkdown>
        )}
        {animatedContent.new && (
          <span key={animatedContent.key} className="animate-fade-in-fast">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {animatedContent.new}
            </ReactMarkdown>
          </span>
        )}
        {cursorElement}
      </div>
    );
  }

  return (
    <span className={className}>
      {animatedContent.previous}
      {animatedContent.new && (
        <span key={animatedContent.key} className="animate-fade-in-fast">
          {animatedContent.new}
        </span>
      )}
      {cursorElement}
    </span>
  );
}

/**
 * StreamingMarkdown component - A convenience wrapper for streaming markdown content.
 * Pre-configured with shared markdown components for consistent styling.
 */
export function StreamingMarkdown({
  content,
  isStreaming,
  showCursor = false,
  className = '',
}: Omit<StreamingTextProps, 'renderMarkdown' | 'components'>): React.ReactElement {
  return (
    <StreamingText
      content={content}
      isStreaming={isStreaming}
      showCursor={showCursor}
      className={className}
      renderMarkdown={true}
      components={markdownComponents}
    />
  );
}

export default StreamingText;
