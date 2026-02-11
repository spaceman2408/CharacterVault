/**
 * @fileoverview Regenerate response button component for AI chat messages.
 * @module components/ai/components/RegenerateButton
 */

import React, { memo } from 'react';
import { RotateCcw } from 'lucide-react';

/**
 * Props for the RegenerateButton component
 */
export interface RegenerateButtonProps {
  /** Index of the message in the chat history */
  messageIndex: number;
  /** Total length of the chat history */
  chatHistoryLength: number;
  /** Callback to regenerate the response */
  onRegenerate: () => void;
  /** Whether an AI request is currently processing */
  isProcessing: boolean;
}

/**
 * Regenerate response button component.
 * Only shows on the most recent assistant message.
 */
export const RegenerateButton: React.FC<RegenerateButtonProps> = memo(({
  messageIndex,
  chatHistoryLength,
  onRegenerate,
  isProcessing
}) => {
  // Only show on the most recent assistant message when it's the last message
  const isLastMessage = messageIndex === chatHistoryLength - 1;
  if (!isLastMessage) return null;

  return (
    <button
      onClick={() => void onRegenerate()}
      disabled={isProcessing}
      className="p-1.5 rounded-md text-vault-400 hover:text-vault-600 dark:hover:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-700/50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
      title="Regenerate response"
    >
      <RotateCcw className="w-3.5 h-3.5" />
    </button>
  );
});

RegenerateButton.displayName = 'RegenerateButton';

export default RegenerateButton;
