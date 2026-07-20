/**
 * @fileoverview Committed assistant markdown (GFM + sanitized HTML).
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
  /** @deprecated No longer gates rendering; kept for call-site compatibility. */
  forceActive?: boolean;
  className?: string;
}

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
