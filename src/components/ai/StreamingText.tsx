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
 * Pre-configured with default markdown components and styling.
 */
export function StreamingMarkdown({
  content,
  isStreaming,
  showCursor = false,
  className = '',
}: Omit<StreamingTextProps, 'renderMarkdown' | 'components'>): React.ReactElement {
  const defaultComponents: Components = {
    // Style code blocks with dark background
    code({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { className?: string }) {
      const isInline = !className?.includes('language-');
      return (
        <code
          className={`${className || ''} ${isInline 
            ? 'bg-vault-100 dark:bg-vault-700 px-1 py-0.5 rounded text-vault-800 dark:text-vault-200' 
            : 'block bg-vault-900 text-vault-100 p-3 rounded-lg overflow-x-auto'} font-mono text-sm`}
          {...props}
        >
          {children}
        </code>
      );
    },
    // Style pre blocks
    pre({ children }: React.ComponentPropsWithoutRef<'pre'>) {
      return (
        <pre className="bg-vault-900 text-vault-100 p-3 rounded-lg overflow-x-auto my-2">
          {children}
        </pre>
      );
    },
    // Style links
    a({ href, children, ...props }: React.ComponentPropsWithoutRef<'a'>) {
      return (
        <a 
          href={href} 
          className="text-vault-600 dark:text-vault-400 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },
    // Style lists
    ul({ children }: React.ComponentPropsWithoutRef<'ul'>) {
      return <ul className="list-disc pl-5 my-2">{children}</ul>;
    },
    ol({ children }: React.ComponentPropsWithoutRef<'ol'>) {
      return <ol className="list-decimal pl-5 my-2">{children}</ol>;
    },
    // Style blockquotes
    blockquote({ children }: React.ComponentPropsWithoutRef<'blockquote'>) {
      return (
        <blockquote className="border-l-4 border-vault-300 dark:border-vault-600 pl-4 italic my-2 text-vault-600 dark:text-vault-400">
          {children}
        </blockquote>
      );
    },
    // Style horizontal rules
    hr() {
      return <hr className="border-vault-200 dark:border-vault-700 my-4" />;
    },
    // Style headings
    h1({ children }: React.ComponentPropsWithoutRef<'h1'>) {
      return <h1 className="text-lg font-bold my-3">{children}</h1>;
    },
    h2({ children }: React.ComponentPropsWithoutRef<'h2'>) {
      return <h2 className="text-base font-bold my-2">{children}</h2>;
    },
    h3({ children }: React.ComponentPropsWithoutRef<'h3'>) {
      return <h3 className="text-sm font-bold my-2">{children}</h3>;
    },
    // Style paragraphs
    p({ children }: React.ComponentPropsWithoutRef<'p'>) {
      return <p className="my-1.5">{children}</p>;
    },
    // Style tables
    table({ children }: React.ComponentPropsWithoutRef<'table'>) {
      return (
        <div className="overflow-x-auto my-4 rounded-lg border border-vault-200 dark:border-vault-700">
          <table className="min-w-full divide-y divide-vault-200 dark:divide-vault-700">
            {children}
          </table>
        </div>
      );
    },
    thead({ children }: React.ComponentPropsWithoutRef<'thead'>) {
      return <thead className="bg-vault-100 dark:bg-vault-800">{children}</thead>;
    },
    tbody({ children }: React.ComponentPropsWithoutRef<'tbody'>) {
      return <tbody className="divide-y divide-vault-200 dark:divide-vault-700">{children}</tbody>;
    },
    tr({ children }: React.ComponentPropsWithoutRef<'tr'>) {
      return <tr>{children}</tr>;
    },
    th({ children }: React.ComponentPropsWithoutRef<'th'>) {
      return (
        <th className="px-3 py-2 text-left text-xs font-medium text-vault-500 dark:text-vault-400 uppercase tracking-wider bg-vault-50 dark:bg-vault-900/50">
          {children}
        </th>
      );
    },
    td({ children }: React.ComponentPropsWithoutRef<'td'>) {
      return (
        <td className="px-3 py-2 text-sm text-vault-700 dark:text-vault-300">
          {children}
        </td>
      );
    },
  };

  return (
    <StreamingText
      content={content}
      isStreaming={isStreaming}
      showCursor={showCursor}
      className={className}
      renderMarkdown={true}
      components={defaultComponents}
    />
  );
}

export default StreamingText;
