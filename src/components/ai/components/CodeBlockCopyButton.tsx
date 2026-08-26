/**
 * @fileoverview Copy button for markdown code blocks.
 * @module components/ai/components/CodeBlockCopyButton
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export interface CodeBlockCopyButtonProps {
  /** The code block content to copy */
  content: string;
  /** Optional positioning/styling overrides */
  className?: string;
}

export function CodeBlockCopyButton({
  content,
  className = '',
}: CodeBlockCopyButtonProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setCopied(true);
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, 1000);
    } catch (err) {
      console.error('Failed to copy code block:', err);
    }
  }, [content]);

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={`${className} p-1.5 rounded-md transition-colors ${
        copied
          ? 'bg-green-600/90 text-white'
          : 'bg-vault-800/90 text-fg-subtle hover:text-vault-100 hover:bg-vault-700'
      }`}
      title={copied ? 'Copied!' : 'Copy code block'}
      aria-label={copied ? 'Copied code block' : 'Copy code block'}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

export default CodeBlockCopyButton;
