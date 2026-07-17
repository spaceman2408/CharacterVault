/**
 * @fileoverview Collapsible reasoning display component for AI chat messages.
 * @module components/ai/components/ReasoningSection
 */

import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Sparkles, ChevronDown, ChevronRight } from 'lucide-react';

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
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const reasoningContentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll reasoning to bottom when content updates (if near bottom)
  useEffect(() => {
    if (reasoningContentRef.current && reasoning) {
      const container = reasoningContentRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [reasoning]);

  const toggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  if (!reasoning || reasoning.trim().length === 0) {
    return null;
  }

  return (
    <div className="mb-2 border border-border rounded-lg overflow-hidden bg-muted/40">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 hover:bg-hover/60 transition-colors text-left"
      >
        <span className="text-xs font-medium text-fg-muted flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3 h-3 shrink-0" />
          <span className="truncate">Thinking</span>
        </span>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-fg-subtle shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-fg-subtle shrink-0" />
        )}
      </button>
      {isExpanded && (
        <div
          ref={reasoningContentRef}
          className="max-h-40 overflow-y-auto px-2.5 py-2 border-t border-border"
        >
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
