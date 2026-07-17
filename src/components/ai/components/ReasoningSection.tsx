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
    <div className="mb-2 border border-border-strong rounded-md overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-2 py-1.5 bg-hover hover:bg-hover transition-colors text-left"
      >
        <span className="text-xs font-medium text-fg-muted flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Thinking process
        </span>
        <span className="text-xs text-fg-muted">
          {isExpanded ? 'Hide' : 'Show'}
        </span>
      </button>
      {isExpanded && (
        <div ref={reasoningContentRef} className="max-h-40 overflow-y-auto px-2 py-2 bg-muted border-t border-border">
          <pre className="text-xs font-mono text-fg-muted whitespace-pre-wrap wrap-break-word leading-relaxed">
            {reasoning}
          </pre>
        </div>
      )}
    </div>
  );
});

ReasoningSection.displayName = 'ReasoningSection';

export default ReasoningSection;
