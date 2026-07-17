/**
 * @fileoverview Provider selector for models that support provider selection (NanoGPT).
 * Uses a bottom sheet / modal so the list is usable on mobile.
 * @module components/settings/components/ProviderSelect
 */

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Loader2, Server, X, Zap } from 'lucide-react';
import type { ModelProvider } from '../../../services/providers';
import { useModalSheet } from '../hooks/useModalSheet';

interface ProviderSelectProps {
  providers: ModelProvider[];
  selectedProvider: string;
  onSelect: (provider: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

const fieldClass =
  'w-full min-h-11 px-3 py-2.5 border border-border-strong rounded-xl bg-surface text-fg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all';

export const ProviderSelect: React.FC<ProviderSelectProps> = ({
  providers,
  selectedProvider,
  onSelect,
  isLoading,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();

  const closePicker = useCallback(() => setIsOpen(false), []);

  const canOpen = !disabled && !isLoading && providers.length > 0;
  // Drive sheet + scroll-lock from effective visibility so a mid-open
  // providers clear never leaves body overflow locked with isOpen stuck true.
  const sheetOpen = isOpen && canOpen;

  useModalSheet(sheetOpen, closePicker);

  // Drop sticky isOpen when the sheet can no longer be shown (async, avoids render-phase setState)
  useEffect(() => {
    if (!isOpen || canOpen) return;
    const id = window.setTimeout(() => setIsOpen(false), 0);
    return () => window.clearTimeout(id);
  }, [isOpen, canOpen]);

  const selectedProviderInfo = providers.find((p) => p.provider === selectedProvider);
  const sortedProviders = useMemo(
    () =>
      [...providers].sort((a, b) => {
        const aAvail = a.available ? 0 : 1;
        const bAvail = b.available ? 0 : 1;
        return aAvail - bAvail;
      }),
    [providers]
  );

  const formatPrice = (price: number): string => `$${price.toFixed(4)}`;

  const handleSelect = (provider: string) => {
    onSelect(provider);
    closePicker();
  };

  const optionClass = (selected: boolean, unavailable: boolean) => {
    if (unavailable) {
      return 'border-border bg-muted/40 text-fg-subtle cursor-not-allowed opacity-70';
    }
    if (selected) {
      return 'border-accent/40 bg-accent-soft text-accent shadow-sm';
    }
    return 'border-border bg-surface text-fg hover:border-accent/40 hover:bg-accent-soft hover:text-accent active:scale-[0.99]';
  };

  const picker =
    sheetOpen &&
    typeof document !== 'undefined' &&
    createPortal(
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
        <button
          type="button"
          aria-label="Close provider picker"
          className="absolute inset-0 bg-overlay backdrop-blur-sm animate-in fade-in"
          onClick={closePicker}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative z-[201] w-full sm:max-w-md sm:mx-4 max-h-[min(85dvh,36rem)] flex flex-col bg-surface rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 sm:fade-in pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="relative flex items-center justify-between gap-3 px-4 pt-3 pb-2 sm:px-5 sm:pt-4 border-b border-border shrink-0 bg-surface/95 backdrop-blur-sm rounded-t-2xl sm:rounded-t-2xl">
            <div className="mx-auto sm:hidden w-10 h-1 rounded-full bg-border absolute left-1/2 -translate-x-1/2 top-2" />
            <div className="min-w-0 pt-2 sm:pt-0">
              <h3 id={titleId} className="text-base font-semibold text-fg">
                Choose provider
              </h3>
              <p className="text-xs text-fg-muted mt-0.5">
                {providers.length} NanoGPT host
                {providers.length === 1 ? '' : 's'} for this model
              </p>
            </div>
            <button
              type="button"
              onClick={closePicker}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-accent-soft hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 touch-manipulation"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full min-h-12 px-3.5 py-3 rounded-xl border text-left transition-all touch-manipulation ${optionClass(
                !selectedProvider,
                false
              )}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    !selectedProvider
                      ? 'bg-accent/15 text-accent'
                      : 'bg-muted text-fg-muted'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-base sm:text-sm">Platform default</span>
                    {!selectedProvider && (
                      <Check className="w-4 h-4 shrink-0 text-accent" aria-hidden />
                    )}
                  </div>
                  <p
                    className={`text-xs mt-0.5 ${
                      !selectedProvider ? 'text-accent/80' : 'text-fg-muted'
                    }`}
                  >
                    Let NanoGPT pick the best available host
                  </p>
                </div>
              </div>
            </button>

            {sortedProviders.map((provider) => {
              const isUnavailable = !provider.available;
              const selected = provider.provider === selectedProvider;
              return (
                <button
                  key={provider.provider}
                  type="button"
                  onClick={() => {
                    if (isUnavailable) return;
                    handleSelect(provider.provider);
                  }}
                  disabled={isUnavailable}
                  title={isUnavailable ? 'This provider is currently unavailable' : undefined}
                  className={`w-full min-h-12 px-3.5 py-3 rounded-xl border text-left transition-all touch-manipulation ${optionClass(
                    selected,
                    isUnavailable
                  )}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isUnavailable
                          ? 'bg-muted text-fg-subtle'
                          : selected
                            ? 'bg-accent/15 text-accent'
                            : 'bg-muted text-fg-muted'
                      }`}
                    >
                      <Server className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-base sm:text-sm break-words">
                          {provider.provider}
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          {isUnavailable ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-warning-soft text-warning-soft-fg border border-amber-500/20">
                              Unavailable
                            </span>
                          ) : selected ? (
                            <Check className="w-4 h-4 text-accent" aria-hidden />
                          ) : null}
                        </span>
                      </div>
                      <div
                        className={`mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs tabular-nums ${
                          selected && !isUnavailable ? 'text-accent/80' : 'text-fg-muted'
                        }`}
                      >
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/80 border border-border">
                          In {formatPrice(provider.pricing.inputPer1kTokens)}/1k
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/80 border border-border">
                          Out {formatPrice(provider.pricing.outputPer1kTokens)}/1k
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-fg">
        <span className="p-1.5 rounded-md bg-muted text-fg-muted">
          <Zap className="w-4 h-4" />
        </span>
        Provider
      </label>
      <button
        type="button"
        onClick={() => canOpen && setIsOpen(true)}
        disabled={disabled || isLoading}
        className={`${fieldClass} text-left flex items-center justify-between gap-2 ${
          disabled || isLoading
            ? 'bg-muted text-fg-subtle cursor-not-allowed border-border'
            : 'hover:border-accent/40 hover:bg-accent-soft/40'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0 flex-wrap">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-accent" />
              <span className="text-fg-subtle">Loading providers…</span>
            </>
          ) : selectedProvider ? (
            <>
              <Server className="w-4 h-4 shrink-0 text-accent" />
              <span className="font-medium truncate">{selectedProvider}</span>
              <span className="text-fg-muted text-xs">
                In {formatPrice(selectedProviderInfo?.pricing.inputPer1kTokens ?? 0)}/1k · Out{' '}
                {formatPrice(selectedProviderInfo?.pricing.outputPer1kTokens ?? 0)}/1k
              </span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 shrink-0 text-fg-subtle" />
              <span className="text-fg-subtle">Platform default (auto-selected)</span>
            </>
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-fg-subtle shrink-0" />
      </button>
      {picker}
    </div>
  );
};
