/**
 * Custom-context row + modal. Used by the character AI Context panel and the
 * standalone lorebook editor sidebar.
 */

import React, { useCallback, useState } from 'react';
import { Check, FileText, Pencil, Plus } from 'lucide-react';
import type { CustomContextMeta } from '../../db/characterTypes';
import type { CustomContextOwner } from '../../services/CustomContextService';
import { estimateCustomContextTokensFromCharLength } from '../../services/CustomContextService';
import { CustomContextModal } from './CustomContextModal';

export interface CustomContextBlockProps {
  ownerId: string;
  owner: CustomContextOwner;
  meta: CustomContextMeta;
  contextLength: number;
  onSetEnabled: (enabled: boolean) => Promise<void>;
  onSave: (input: { content: string; enabled: boolean }) => Promise<void>;
  onClear: () => Promise<void>;
  density?: 'default' | 'compact';
}

function ownerNoun(owner: CustomContextOwner): string {
  return owner === 'lorebook' ? 'lorebook' : 'character';
}

export function CustomContextBlock({
  ownerId,
  owner,
  meta,
  contextLength,
  onSetEnabled,
  onSave,
  onClear,
  density = 'default',
}: CustomContextBlockProps): React.ReactElement {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const compact = density === 'compact';
  const noun = ownerNoun(owner);

  const hasCustomContext = meta.charLength > 0;
  const customContextEnabled = meta.enabled && hasCustomContext;

  const handleToggleEnabled = useCallback(() => {
    if (!hasCustomContext) return;
    void onSetEnabled(!meta.enabled);
  }, [hasCustomContext, meta.enabled, onSetEnabled]);

  const handleClear = useCallback(() => {
    if (!hasCustomContext) return;
    if (
      !window.confirm(
        `Remove custom context for this ${noun}? This cannot be undone.`,
      )
    ) {
      return;
    }
    void onClear();
  }, [hasCustomContext, noun, onClear]);

  const padClass = compact ? 'px-2 py-1.5' : 'px-2.5 py-2';
  const titleClass = compact ? 'text-xs' : 'text-sm';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-fg-muted uppercase tracking-wide">
          Custom
        </span>
        {hasCustomContext && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-fg-subtle hover:text-danger transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {!hasCustomContext ? (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className={`w-full flex items-center gap-2 ${padClass} rounded-xl border border-dashed border-border-strong text-fg-muted hover:border-accent hover:text-accent hover:bg-accent-soft transition-colors text-left`}
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="min-w-0">
            <span className={`block font-medium ${titleClass}`}>Add custom context…</span>
            <span className="block text-xs text-fg-subtle mt-0.5">
              Paste notes or reference text for this {noun}
            </span>
          </span>
        </button>
      ) : (
        <div
          className={`flex items-start gap-2.5 ${padClass} rounded-xl border transition-colors ${
            customContextEnabled
              ? 'border-accent/40 bg-accent-soft shadow-sm'
              : 'border-border bg-surface'
          }`}
        >
          <button
            type="button"
            onClick={handleToggleEnabled}
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
              customContextEnabled
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-border-strong bg-surface'
            }`}
            title={customContextEnabled ? 'Exclude from AI context' : 'Include in AI context'}
            aria-pressed={customContextEnabled}
          >
            {customContextEnabled && <Check className="w-3 h-3" strokeWidth={3} />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-fg-muted shrink-0" />
              <span
                className={`font-medium truncate ${titleClass} ${
                  customContextEnabled ? 'text-accent' : 'text-fg'
                }`}
              >
                Custom context
              </span>
            </div>
            <p className="text-xs text-fg-muted mt-0.5">
              ~{estimateCustomContextTokensFromCharLength(meta.charLength).toLocaleString()}{' '}
              tokens
              {!meta.enabled && ' · off'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="p-1.5 rounded-lg text-fg-muted hover:text-accent hover:bg-accent-soft transition-colors shrink-0"
            title="Edit custom context"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <CustomContextModal
        isOpen={isModalOpen}
        ownerId={ownerId}
        owner={owner}
        initialEnabled={meta.enabled || !hasCustomContext}
        contextLength={contextLength}
        onClose={() => setIsModalOpen(false)}
        onSave={onSave}
      />
    </div>
  );
}

export default CustomContextBlock;
