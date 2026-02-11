/**
 * @fileoverview Shared ReactMarkdown components configuration.
 * @module components/ai/config/markdownComponents
 * 
 * This configuration provides consistent styling for markdown rendering
 * across StreamingText and AIChatPanel components.
 */

import type { Components } from 'react-markdown';

/**
 * Shared markdown components for consistent styling
 * across StreamingText and AIChatPanel
 */
export const markdownComponents: Components = {
  // Style code blocks with dark background
  code({ className, children, ...props }) {
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
  pre({ children }) {
    return (
      <pre className="bg-vault-900 text-vault-100 p-3 rounded-lg overflow-x-auto my-2">
        {children}
      </pre>
    );
  },

  // Style links
  a({ href, children, ...props }) {
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
  ul({ children }) {
    return <ul className="list-disc pl-5 my-2">{children}</ul>;
  },

  ol({ children }) {
    return <ol className="list-decimal pl-5 my-2">{children}</ol>;
  },

  // Style blockquotes
  blockquote({ children }) {
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

  // Style tables
  table({ children }) {
    return (
      <div className="overflow-x-auto my-4 rounded-lg border border-vault-200 dark:border-vault-700">
        <table className="min-w-full divide-y divide-vault-200 dark:divide-vault-700">
          {children}
        </table>
      </div>
    );
  },

  thead({ children }) {
    return <thead className="bg-vault-100 dark:bg-vault-800">{children}</thead>;
  },

  tbody({ children }) {
    return <tbody className="divide-y divide-vault-200 dark:divide-vault-700">{children}</tbody>;
  },

  tr({ children }) {
    return <tr>{children}</tr>;
  },

  th({ children }) {
    return (
      <th className="px-3 py-2 text-left text-xs font-medium text-vault-500 dark:text-vault-400 uppercase tracking-wider bg-vault-50 dark:bg-vault-900/50">
        {children}
      </th>
    );
  },

  td({ children }) {
    return (
      <td className="px-3 py-2 text-sm text-vault-700 dark:text-vault-300">
        {children}
      </td>
    );
  },
};
