/**
 * @fileoverview Preflight modal for inspecting the AI chat/completions payload.
 * @module components/editor/AIPayloadPreviewModal
 */

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Braces, Check, Copy, MessageSquareText, X } from 'lucide-react';
import type { AIOperation } from '../../db/characterTypes';
import type { AIRequestPreview } from '../../services/AIService';

const OPERATION_OPTIONS: { id: AIOperation; label: string }[] = [
  { id: 'expand', label: 'Enhance' },
  { id: 'rewrite', label: 'Rephrase' },
  { id: 'instruct', label: 'Custom' },
  { id: 'shorten', label: 'Shorten' },
  { id: 'lengthen', label: 'Lengthen' },
  { id: 'vivid', label: 'Vivid' },
  { id: 'emotion', label: 'Emotion' },
  { id: 'grammar', label: 'Fix' },
];

function formatTokenCount(n: number): string {
  if (n < 1000) return `~${n}`;
  if (n < 10_000) return `~${(n / 1000).toFixed(1)}k`;
  return `~${Math.round(n / 1000)}k`;
}

export interface AIPayloadPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Selected text the request will edit */
  selectedText: string;
  /** Initial operation when the modal opens (remount key resets local form) */
  initialOperation: AIOperation;
  /** Prefill for Custom instruction */
  initialInstruction?: string;
  /**
   * Build a preflight preview for the given op / instruction.
   * Return null when the request cannot be built (e.g. empty Custom instruction).
   * May be async when custom context is loaded from IndexedDB.
   */
  buildPreview: (
    operation: AIOperation,
    instruction?: string
  ) => AIRequestPreview | null | Promise<AIRequestPreview | null>;
}

/**
 * Local form state is remounted via `key` when open session changes so we avoid
 * setState-in-effect for resetting operation/instruction.
 */
function AIPayloadPreviewModalBody({
  onClose,
  selectedText,
  initialOperation,
  initialInstruction,
  buildPreview,
}: {
  onClose: () => void;
  selectedText: string;
  initialOperation: AIOperation;
  initialInstruction: string;
  buildPreview: (
    operation: AIOperation,
    instruction?: string
  ) => AIRequestPreview | null | Promise<AIRequestPreview | null>;
}): React.ReactElement {
  const [operation, setOperation] = useState<AIOperation>(initialOperation);
  const [instruction, setInstruction] = useState(initialInstruction);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<AIRequestPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const previewError =
    operation === 'instruct' && !instruction.trim()
      ? 'Enter a custom instruction to preview this request.'
      : null;

  useEffect(() => {
    let cancelled = false;

    if (previewError) {
      setPreview(null);
      setPreviewBusy(false);
      return;
    }

    setPreviewBusy(true);
    void (async () => {
      try {
        const result = await buildPreview(
          operation,
          operation === 'instruct' ? instruction.trim() : undefined
        );
        if (!cancelled) setPreview(result);
      } catch (err) {
        console.error('[AIPayloadPreviewModal] Failed to build preview:', err);
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setPreviewBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewError, buildPreview, operation, instruction]);

  const jsonText = useMemo(() => {
    if (!preview) return '';
    return JSON.stringify(preview.body, null, 2);
  }, [preview]);

  const messageCount = preview?.body.messages?.length ?? 0;
  const modelId = typeof preview?.body.model === 'string' ? preview.body.model : null;

  const handleCopy = async () => {
    if (!jsonText) return;
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy payload:', err);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-payload-preview-title"
      className="relative z-10 flex h-[min(88vh,52rem)] w-[min(56rem,94vw)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl ring-1 ring-border/40"
    >
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-muted/40 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-accent shadow-sm">
            <Braces className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 id="ai-payload-preview-title" className="text-base font-semibold tracking-tight text-fg sm:text-lg">
              AI request preview
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-fg-muted sm:text-sm">
              First attempt only. Nothing is sent. Optional params may still be dropped if the provider rejects them.
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

      {/* Controls */}
      <div className="shrink-0 space-y-3 border-b border-border px-5 py-4 sm:px-6">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            Operation
          </div>
          <div className="flex flex-wrap gap-1.5">
            {OPERATION_OPTIONS.map((op) => {
              const active = operation === op.id;
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setOperation(op.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
                    active
                      ? 'bg-accent text-accent-fg shadow-sm'
                      : 'border border-border bg-surface text-fg-muted hover:bg-hover hover:text-fg'
                  }`}
                >
                  {op.label}
                </button>
              );
            })}
          </div>
        </div>

        {operation === 'instruct' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              Instruction
            </span>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              placeholder="What should the model do with the selection?"
              className="resize-y rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-border-strong focus:ring-2 focus:ring-accent/20"
            />
          </label>
        )}

        {preview && (
          <div className="flex flex-wrap items-center gap-2">
            {modelId && (
              <span
                className="inline-flex max-w-full items-center truncate rounded-full border border-border bg-muted/60 px-2.5 py-1 font-mono text-[11px] text-fg-muted"
                title={modelId}
              >
                {modelId}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-fg-muted">
              <MessageSquareText className="h-3 w-3 shrink-0 opacity-70" />
              {messageCount} message{messageCount === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-fg-muted">
              {formatTokenCount(preview.estimatedInputTokens)} input tokens
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-fg-muted">
              {selectedText.length.toLocaleString()} chars selected
            </span>
            {preview.body.stream ? (
              <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent">
                streaming
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-fg-muted">
                non-streaming
              </span>
            )}
          </div>
        )}

        {preview && (
          <div
            className="truncate rounded-lg border border-border/80 bg-bg px-3 py-2 font-mono text-[11px] text-fg-subtle"
            title={`${preview.method} ${preview.endpoint}`}
          >
            <span className="font-semibold text-fg-muted">{preview.method}</span>{' '}
            {preview.endpoint}
          </div>
        )}
      </div>

      {/* JSON body */}
      <div className="flex min-h-0 flex-1 flex-col bg-muted/20 p-4 sm:p-5">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            Request body
          </span>
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={!jsonText}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
              copied
                ? 'border border-success/30 bg-success-soft text-success-soft-fg'
                : 'border border-border bg-surface text-fg-muted hover:bg-hover hover:text-fg'
            }`}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy JSON
              </>
            )}
          </button>
        </div>

        {previewError ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center">
            <div>
              <p className="text-sm font-medium text-fg">{previewError}</p>
              <p className="mt-1 text-xs text-fg-muted">
                Custom ops need an instruction before a request body can be built.
              </p>
            </div>
          </div>
        ) : previewBusy ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center text-sm text-fg-muted">
            Building request preview…
          </div>
        ) : preview ? (
          <pre className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-bg p-4 font-mono text-[12px] leading-relaxed text-fg shadow-inner whitespace-pre-wrap wrap-break-word sm:p-5 sm:text-[13px]">
            {jsonText}
          </pre>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center text-sm text-fg-muted">
            Could not build request preview.
          </div>
        )}
      </div>
    </div>
  );
}

export function AIPayloadPreviewModal({
  isOpen,
  onClose,
  selectedText,
  initialOperation,
  initialInstruction = '',
  buildPreview,
}: AIPayloadPreviewModalProps): React.ReactElement | null {
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

  // Remount body when open session identity changes so form state resets cleanly
  const sessionKey = `${initialOperation}::${initialInstruction}::${selectedText.length}`;

  return createPortal(
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-overlay p-3 backdrop-blur-sm sm:p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <AIPayloadPreviewModalBody
        key={sessionKey}
        onClose={onClose}
        selectedText={selectedText}
        initialOperation={initialOperation}
        initialInstruction={initialInstruction}
        buildPreview={buildPreview}
      />
    </div>,
    document.body
  );
}

export default AIPayloadPreviewModal;
