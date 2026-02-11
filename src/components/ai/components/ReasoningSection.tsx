/**
 * @fileoverview Collapsible reasoning display component for AI chat messages.
 * @module components/ai/components/ReasoningSection
 */

import React, { useState, useEffect, useRef, memo } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Props for the ReasoningSection component
 */
export interface ReasoningSectionProps {
  /** The reasoning content to display */
  reasoning: string;
  /** Whether the section should be expanded by default */
  defaultExpanded?: boolean;
}

/**
 * Collapsible reasoning display component.
 * Shows a collapsible section with the AI's thinking process.
 * Auto-scrolls to bottom when content updates.
 */
export const ReasoningSection: React.FC<ReasoningSectionProps> = memo(({
  reasoning,
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const reasoningContentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll reasoning to bottom when content updates
  // Only scrolls if user is near the bottom (respects user scroll position)
  useEffect(() => {
    if (reasoningContentRef.current && reasoning) {
      const container = reasoningContentRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [reasoning]);
  
  if (!reasoning || reasoning.trim().length === 0) {
    return null;
  }
  
  return (
    <div className="mb-2 border border-vault-300 dark:border-vault-600 rounded-md overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-2 py-1.5 bg-vault-100 dark:bg-vault-700/50 hover:bg-vault-200 dark:hover:bg-vault-700 transition-colors text-left"
      >
        <span className="text-xs font-medium text-vault-600 dark:text-vault-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Thinking process
        </span>
        <span className="text-xs text-vault-500 dark:text-vault-500">
          {isExpanded ? 'Hide' : 'Show'}
        </span>
      </button>
      {isExpanded && (
        <div ref={reasoningContentRef} className="max-h-40 overflow-y-auto px-2 py-2 bg-vault-50 dark:bg-vault-800/50 border-t border-vault-200 dark:border-vault-700">
          <pre className="text-xs font-mono text-vault-700 dark:text-vault-300 whitespace-pre-wrap wrap-break-word leading-relaxed">
            {reasoning}
          </pre>
        </div>
      )}
    </div>
  );
});

ReasoningSection.displayName = 'ReasoningSection';

export default ReasoningSection;
