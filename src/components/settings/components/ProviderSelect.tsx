/**
 * @fileoverview Provider selector for models that support provider selection (NanoGPT).
 * Uses a bottom sheet / modal so the list is usable on mobile.
 * @module components/settings/components/ProviderSelect
 */

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2, X, Zap } from 'lucide-react';
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
  'w-full min-h-11 px-3 py-2.5 border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-vault-500/50';

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

  const picker =
    sheetOpen &&
    typeof document !== 'undefined' &&
    createPortal(
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
        <button
          type="button"
          aria-label="Close provider picker"
          className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
          onClick={closePicker}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative z-[201] w-full sm:max-w-md sm:mx-4 max-h-[min(85dvh,36rem)] flex flex-col bg-white dark:bg-vault-900 rounded-t-2xl sm:rounded-2xl shadow-2xl ring-1 ring-vault-200 dark:ring-vault-700 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 sm:px-5 sm:pt-4 border-b border-vault-200 dark:border-vault-700 shrink-0">
            <div className="min-w-0">
              <div className="mx-auto sm:hidden w-10 h-1 rounded-full bg-vault-300 dark:bg-vault-600 mb-3" />
              <h3
                id={titleId}
                className="text-base font-semibold text-vault-900 dark:text-vault-100"
              >
                Choose provider
              </h3>
              <p className="text-xs text-vault-500 dark:text-vault-400 mt-0.5">
                NanoGPT inference host for this model
              </p>
            </div>
            <button
              type="button"
              onClick={closePicker}
              className="shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-vault-500 hover:text-vault-800 dark:hover:text-vault-200 hover:bg-vault-100 dark:hover:bg-vault-800 focus:outline-none focus:ring-2 focus:ring-vault-500/50"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-1">
            <button
              type="button"
              onClick={() => {
                onSelect('');
                closePicker();
              }}
              className={`w-full min-h-12 px-4 sm:px-5 py-3 text-left transition-colors active:bg-vault-100 dark:active:bg-vault-800 ${
                !selectedProvider
                  ? 'bg-vault-100 dark:bg-vault-800 text-vault-900 dark:text-vault-100'
                  : 'text-vault-700 dark:text-vault-300'
              }`}
            >
              <div className="font-medium text-base sm:text-sm">Platform default</div>
              <div className="text-xs text-vault-500 mt-0.5">
                Let NanoGPT select the best provider
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
                    onSelect(provider.provider);
                    closePicker();
                  }}
                  disabled={isUnavailable}
                  title={isUnavailable ? 'This provider is currently unavailable' : undefined}
                  className={`w-full min-h-12 px-4 sm:px-5 py-3 text-left transition-colors ${
                    isUnavailable
                      ? 'text-vault-400 dark:text-vault-500 cursor-not-allowed opacity-70'
                      : selected
                        ? 'bg-vault-100 dark:bg-vault-800 text-vault-900 dark:text-vault-100'
                        : 'text-vault-700 dark:text-vault-300 active:bg-vault-100 dark:active:bg-vault-800'
                  }`}
                >
                  <div className="font-medium text-base sm:text-sm break-words">
                    {provider.provider}
                    {isUnavailable && (
                      <span className="text-amber-500 ml-2 text-xs font-normal">
                        (unavailable)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-vault-500 mt-0.5">
                    In: {formatPrice(provider.pricing.inputPer1kTokens)}/1k · Out:{' '}
                    {formatPrice(provider.pricing.outputPer1kTokens)}/1k
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
      <label className="flex items-center gap-2 text-sm font-semibold text-vault-800 dark:text-vault-200">
        <span className="p-1.5 rounded-md bg-vault-100 dark:bg-vault-800 text-vault-600 dark:text-vault-400">
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
            ? 'bg-vault-100 dark:bg-vault-800 text-vault-400 cursor-not-allowed border-vault-200 dark:border-vault-700'
            : 'hover:border-vault-400 dark:hover:border-vault-500'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0 flex-wrap">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span className="text-vault-400">Loading providers…</span>
            </>
          ) : selectedProvider ? (
            <>
              <span className="font-medium truncate">{selectedProvider}</span>
              <span className="text-vault-500 text-xs">
                (In: {formatPrice(selectedProviderInfo?.pricing.inputPer1kTokens ?? 0)}/1k, Out:{' '}
                {formatPrice(selectedProviderInfo?.pricing.outputPer1kTokens ?? 0)}/1k)
              </span>
            </>
          ) : (
            <span className="text-vault-400">Platform default (auto-selected)</span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-vault-400 shrink-0" />
      </button>
      {picker}
    </div>
  );
};
