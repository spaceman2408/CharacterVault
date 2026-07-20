/**
 * @fileoverview Shared ReactMarkdown components configuration.
 * @module components/ai/config/markdownComponents
 *
 * This configuration provides consistent styling for markdown rendering
 * across StreamingText and AIChatPanel components.
 */

import React, { type ReactNode } from 'react';
import type { Components } from 'react-markdown';
import type { PluggableList } from 'unified';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { Schema } from 'hast-util-sanitize';
import { CodeBlockCopyButton } from '../components/CodeBlockCopyButton';

/**
 * Allow a small set of safe HTML tags that models often emit inside
 * Markdown (especially multi-line table cells). Everything else is stripped.
 */
const chatSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'br'],
};

/** remark plugins shared by all chat markdown renderers (stable identity). */
export const markdownRemarkPlugins: PluggableList = [remarkGfm];

/**
 * rehype plugins for *committed* messages only.
 * Do not use while streaming — rehype-raw re-parses the full tree on every
 * chunk and is the main heap pressure source during Orion replies.
 */
export const markdownRehypePlugins: PluggableList = [
  rehypeRaw,
  [rehypeSanitize, chatSanitizeSchema],
];

/**
 * Recursively extracts text from markdown AST-rendered React nodes.
 * Used for copying only the code content from fenced code blocks.
 */
function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }
  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: ReactNode }>;
    return extractText(element.props.children ?? '');
  }
  return '';
}

/**
 * Shared markdown components for consistent styling
 * across StreamingText and AIChatPanel
 */
export const markdownComponents: Components = {
  // Style inline code only. Fenced code blocks are wrapped by `pre` below.
  code({ className, children, ...props }) {
    const textContent = extractText(children);
    const isInline = !className?.includes('language-') && !textContent.includes('\n');
    return (
      <code
        className={`${className || ''} ${isInline
          ? 'bg-hover px-1.5 py-0.5 rounded-md text-fg'
          : ''} font-mono text-sm`}
        {...props}
      >
        {children}
      </code>
    );
  },

  // Style fenced code blocks with a copy button for code-only content
  pre({ children }) {
    const codeContent = extractText(children).replace(/\n$/, '');

    return (
      <div className="my-3 overflow-hidden rounded-xl border border-border bg-bg shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-2">
          <span className="font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Code
          </span>
          <CodeBlockCopyButton
            content={codeContent}
            className="shrink-0"
          />
        </div>
        <pre className="overflow-x-auto bg-bg px-4 py-3 leading-6 text-fg">
          {children}
        </pre>
      </div>
    );
  },

  // Style links
  a({ href, children, ...props }) {
    return (
      <a
        href={href}
        className="text-fg-muted hover:underline"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    );
  },

  // Style lists
  ul({ children }) {
    return <ul className="list-disc pl-5 my-2">{children}</ul>;
  },

  ol({ children }) {
    return <ol className="list-decimal pl-5 my-2">{children}</ol>;
  },

  // Style blockquotes
  blockquote({ children }) {
    return (
      <blockquote className="border-l-4 border-border-strong pl-4 italic my-2 text-fg-muted">
        {children}
      </blockquote>
    );
  },

  // Style horizontal rules
  hr() {
    return <hr className="border-border my-4" />;
  },

  // Style headings
  h1({ children }) {
    return <h1 className="text-lg font-bold my-3">{children}</h1>;
  },

  h2({ children }) {
    return <h2 className="text-base font-bold my-2">{children}</h2>;
  },

  h3({ children }) {
    return <h3 className="text-sm font-bold my-2">{children}</h3>;
  },

  // Style paragraphs
  p({ children }) {
    return <p className="my-1.5">{children}</p>;
  },

  // Models often use <br> inside table cells for multi-line content
  br() {
    return <br />;
  },

  // Style tables
  table({ children }) {
    return (
      <div className="overflow-x-auto my-4 rounded-lg border border-border">
        <table className="min-w-full divide-border">
          {children}
        </table>
      </div>
    );
  },

  thead({ children }) {
    return <thead className="bg-muted">{children}</thead>;
  },

  tbody({ children }) {
    return <tbody className="divide-border">{children}</tbody>;
  },

  tr({ children }) {
    return <tr>{children}</tr>;
  },

  th({ children }) {
    return (
      <th className="px-3 py-2 text-left text-xs font-medium text-fg-muted uppercase tracking-wider bg-bg/50">
        {children}
      </th>
    );
  },

  td({ children }) {
    return (
      <td className="px-3 py-2 text-sm text-fg-muted">
        {children}
      </td>
    );
  },
};
