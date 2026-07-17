/**
 * @fileoverview Copy button for markdown code blocks.
 * @module components/ai/components/CodeBlockCopyButton
 */

import React, { useState } from 'react';
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (err) {
      console.error('Failed to copy code block:', err);
    }
  };

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
