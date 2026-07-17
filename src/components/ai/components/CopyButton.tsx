/**
 * @fileoverview Copy to clipboard button component for AI chat messages.
 * @module components/ai/components/CopyButton
 */

import React, { useState, useCallback, memo, useRef, useEffect } from 'react';
import { Check, Copy } from 'lucide-react';

/**
 * Props for the CopyButton component
 */
export interface CopyButtonProps {
  /** The content to copy to clipboard */
  content: string;
}

/**
 * Copy to clipboard button component.
 * Shows a copy icon that changes to a checkmark for 2 seconds after copying.
 */
export const CopyButton: React.FC<CopyButtonProps> = memo(({ content }) => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up pending timeout on unmount to prevent memory leaks
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
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [content]);

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md text-fg-subtle hover:text-fg hover:bg-hover/50 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
});

CopyButton.displayName = 'CopyButton';

export default CopyButton;
