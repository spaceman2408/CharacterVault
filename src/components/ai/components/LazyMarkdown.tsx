/**
 * @fileoverview Committed assistant markdown (GFM + sanitized HTML).
 * Always mounted while the message is in the list — viewport unmounting
 * left blank shells that never reliably remounted.
 * @module components/ai/components/LazyMarkdown
 */

import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  markdownComponents,
  markdownRemarkPlugins,
  markdownRehypePlugins,
} from '../config/markdownComponents';

export interface LazyMarkdownProps {
  content: string;
  /** Kept for call-site compatibility; no longer gates rendering. */
  forceActive?: boolean;
  className?: string;
}

/**
 * Full markdown for a committed assistant message.
 * Memory is controlled by stable ChatMessage memos + stream plain-text,
 * not by unmounting off-screen history (that hid previous replies).
 */
export const LazyMarkdown: React.FC<LazyMarkdownProps> = memo(
  ({ content, className = '' }) => {
    return (
      <div className={className}>
        <ReactMarkdown
          remarkPlugins={markdownRemarkPlugins}
          rehypePlugins={markdownRehypePlugins}
          components={markdownComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }
);

LazyMarkdown.displayName = 'LazyMarkdown';

export default LazyMarkdown;
