/**
 * @fileoverview Copy to clipboard button component for AI chat messages.
 * @module components/ai/components/CopyButton
 */

import React, { useState, useCallback, memo } from 'react';
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

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [content]);

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md text-vault-400 hover:text-vault-600 dark:hover:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-700/50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
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
