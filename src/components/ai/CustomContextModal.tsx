/**
 * @fileoverview Modal editor for vault-local custom AI context.
 * Loads body from IndexedDB on open; does not keep content after close.
 * @module components/ai/CustomContextModal
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, FileText, LoaderCircle, X } from 'lucide-react';
import {
  customContextService,
  type CustomContextOwner,
} from '../../services/CustomContextService';
import { estimateTokens, BYTES_PER_TOKEN } from '../../services/AIService';

export interface CustomContextModalProps {
  isOpen: boolean;
  ownerId: string;
  owner: CustomContextOwner;
  /** Initial enabled flag from meta (content is loaded inside) */
  initialEnabled: boolean;
  contextLength: number;
  onClose: () => void;
  /** Persist via parent so meta updates without retaining body */
  onSave: (input: { content: string; enabled: boolean }) => Promise<void>;
}

function CustomContextModalBody({
  ownerId,
  owner,
  initialEnabled,
  contextLength,
  onClose,
  onSave,
}: {
  ownerId: string;
  owner: CustomContextOwner;
  initialEnabled: boolean;
  contextLength: number;
  onClose: () => void;
  onSave: (input: { content: string; enabled: boolean }) => Promise<void>;
}): React.ReactElement {
  const [content, setContent] = useState('');
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const mountedRef = React.useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setContent('');

    void (async () => {
      try {
        const body = await customContextService.getContent(ownerId, owner);
        if (cancelled || !mountedRef.current) return;
        setContent(body ?? '');
        setEnabled(initialEnabled || (body != null && body.length > 0));
      } catch (err) {
        console.error('Failed to load custom context:', err);
        if (!cancelled && mountedRef.current) {
          setLoadError('Could not load custom context from storage.');
        }
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ownerId, owner, initialEnabled]);

  const tokenEstimate = useMemo(() => {
    if (!content.trim()) return 0;
    // Estimate content + fixed header overhead (avoid building a second full-size string)
    return estimateTokens(content) + estimateTokens('Custom Context:\n');
  }, [content]);

  const usagePct = contextLength > 0 ? Math.min(100, (tokenEstimate / contextLength) * 100) : 0;
  const softStatus: 'good' | 'warning' | 'danger' =
    usagePct > 80 ? 'danger' : usagePct > 50 ? 'warning' : usagePct > 25 ? 'warning' : 'good';

  const usageColorClass =
    softStatus === 'good'
      ? 'text-success'
      : softStatus === 'warning'
        ? 'text-warning'
        : 'text-danger';

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const trimmedEmpty = content.trim().length === 0;
      const payload = {
        content,
        enabled: trimmedEmpty ? false : enabled,
      };
      await onSave(payload);
      // Release draft before unmount so the large string is not retained until GC of the fiber
      if (mountedRef.current) {
        setContent('');
      }
      onClose();
    } catch (err) {
      console.error('Failed to save custom context:', err);
      if (mountedRef.current) {
        setSaveError('Could not save custom context. Please try again.');
        setSaving(false);
      }
    }
  }, [content, enabled, onClose, onSave]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-context-title"
      className="relative z-10 flex h-[min(88vh,40rem)] w-[min(40rem,94vw)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl ring-1 ring-border/40"
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-muted/40 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-accent shadow-sm">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 id="custom-context-title" className="text-base font-semibold tracking-tight text-fg">
              Custom context
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">
              Paste notes or reference text for Orion and the AI toolbar. Stored only in this vault,
              not exported with the card or book.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border bg-surface p-2 text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-fg-muted">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : loadError ? (
          <div className="flex flex-1 items-center justify-center text-sm text-danger">{loadError}</div>
        ) : (
          <>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or type anything you want the AI to use as reference…"
              className="min-h-0 flex-1 resize-none rounded-xl border border-border-strong bg-bg px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle outline-none focus:ring-2 focus:ring-accent/40"
              autoFocus
              spellCheck
            />

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <label className="inline-flex items-center gap-2 text-fg-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enabled && content.trim().length > 0}
                  disabled={content.trim().length === 0}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded border-border-strong text-accent focus:ring-accent/40"
                />
                Include in AI context when enabled
              </label>
              <span className={`tabular-nums font-medium ${usageColorClass}`}>
                ~{tokenEstimate.toLocaleString()} tokens
                {contextLength > 0 && (
                  <span className="text-fg-subtle font-normal">
                    {' '}
                    / {contextLength.toLocaleString()} window
                  </span>
                )}
              </span>
            </div>

            {(softStatus === 'warning' || softStatus === 'danger') && tokenEstimate > 0 && (
              <div
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                  softStatus === 'danger'
                    ? 'border-danger/30 bg-danger/10 text-danger'
                    : 'border-warning/30 bg-warning/10 text-warning'
                }`}
              >
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p>
                  {softStatus === 'danger'
                    ? 'This block alone is very large relative to your context window. The AI may drop or truncate it when space runs out.'
                    : 'Large custom context uses a sizable share of the context window. Consider trimming if requests feel constrained.'}
                </p>
              </div>
            )}

            <p className="text-[11px] text-fg-subtle">
              Token estimate uses text size in bytes ÷ {BYTES_PER_TOKEN}. Actual counts vary by model.
            </p>

            {saveError && <p className="text-xs text-danger">{saveError}</p>}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-3 py-2 text-sm font-medium text-fg-muted hover:bg-hover hover:text-fg transition-colors"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={loading || !!loadError || saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-medium text-accent-fg shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
}

/**
 * Modal for editing vault-local custom AI context for one character or lorebook.
 */
export function CustomContextModal({
  isOpen,
  ownerId,
  owner,
  initialEnabled,
  contextLength,
  onClose,
  onSave,
}: CustomContextModalProps): React.ReactElement | null {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-overlay p-3 backdrop-blur-sm sm:p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <CustomContextModalBody
        key={`${owner}:${ownerId}`}
        ownerId={ownerId}
        owner={owner}
        initialEnabled={initialEnabled}
        contextLength={contextLength}
        onClose={onClose}
        onSave={onSave}
      />
    </div>,
    document.body
  );
}

export default CustomContextModal;
