import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  Hash,
  ImageOff,
  Pencil,
  User,
  X,
} from 'lucide-react';
import { formatTokenEstimate } from '../../services/AIService';
import type { CharacterListItem } from '../../db';
import { formatRelativeTime } from './utils';

function formatAbsoluteTime(timestamp?: string): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export interface CharacterCardDetailsSheetProps {
  character: CharacterListItem;
  onClose: () => void;
  onOpen: (id: string) => void;
}

export function CharacterCardDetailsSheet({
  character,
  onClose,
  onOpen,
}: CharacterCardDetailsSheetProps): React.ReactElement {
  const tags = character.tags ?? [];
  const hasImage = Boolean(character.thumbnailData);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`card-details-title-${character.id}`}
      // Portal still bubbles through React to CharacterCard — block open-on-click
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="absolute inset-0 bg-overlay backdrop-blur-sm animate-in fade-in"
        aria-label="Close details"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      />

      <div
        className="relative w-full sm:max-w-md max-h-[85dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-surface shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 sm:fade-in"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 pt-3 pb-2 bg-surface/95 backdrop-blur-sm border-b border-border">
          <div className="mx-auto sm:mx-0 w-10 h-1 rounded-full bg-border sm:hidden absolute left-1/2 -translate-x-1/2 top-2" />
          <h2
            id={`card-details-title-${character.id}`}
            className="text-sm font-semibold text-fg pt-2 sm:pt-0 truncate pr-2"
          >
            Card details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-fg-muted hover:bg-accent-soft hover:text-accent transition-colors touch-manipulation"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-16 h-20 rounded-xl overflow-hidden bg-muted border border-border shrink-0">
              {hasImage ? (
                <img
                  src={character.thumbnailData}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-fg-subtle">
                  <User className="w-7 h-7" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-semibold text-fg text-base leading-snug wrap-break-word">
                {character.name}
              </p>
              <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-fg-muted">
                {hasImage ? (
                  <>Has thumbnail</>
                ) : (
                  <>
                    <ImageOff className="w-3.5 h-3.5" />
                    No image
                  </>
                )}
              </p>
            </div>
          </div>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              Tokens
            </h3>
            <div className="rounded-xl border border-border bg-muted/50 divide-y divide-border">
              <div className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">Active</p>
                  <p className="text-xs text-fg-muted mt-0.5">
                    Always-on RP fields (name, description, personality, scenario, system, etc.)
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-accent">
                    {formatTokenEstimate(character.activeTokens)}
                  </p>
                  <p className="text-[11px] tabular-nums text-fg-subtle">
                    {character.activeTokens.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">Total</p>
                  <p className="text-xs text-fg-muted mt-0.5">
                    Active plus greetings, lorebook, and other metadata
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-fg">
                    {formatTokenEstimate(character.totalTokens)}
                  </p>
                  <p className="text-[11px] tabular-nums text-fg-subtle">
                    {character.totalTokens.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" />
              Tags {tags.length > 0 ? `(${tags.length})` : ''}
            </h3>
            {tags.length === 0 ? (
              <p className="text-sm text-fg-muted italic">No tags on this card.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-accent-soft text-accent border border-accent/25 break-all"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              Activity
            </h3>
            <div className="rounded-xl border border-border bg-muted/50 space-y-0 divide-y divide-border">
              <div className="flex items-start gap-2.5 p-3">
                <Clock className="w-4 h-4 text-fg-subtle shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">Last opened</p>
                  <p className="text-xs text-fg-muted mt-0.5">
                    {formatRelativeTime(character.lastOpenedAt)}
                    <span className="text-fg-subtle"> · </span>
                    {formatAbsoluteTime(character.lastOpenedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3">
                <Pencil className="w-4 h-4 text-fg-subtle shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">Last edited</p>
                  <p className="text-xs text-fg-muted mt-0.5">
                    {formatRelativeTime(character.updatedAt)}
                    <span className="text-fg-subtle"> · </span>
                    {formatAbsoluteTime(character.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-fg-muted border border-border rounded-xl hover:bg-hover transition-colors touch-manipulation"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpen(character.id);
              }}
              className="flex-1 px-4 py-2.5 text-sm font-medium bg-accent text-accent-fg rounded-xl hover:opacity-90 transition-opacity touch-manipulation"
            >
              Open character
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
