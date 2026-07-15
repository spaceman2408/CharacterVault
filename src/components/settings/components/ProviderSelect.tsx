/**
 * @fileoverview Provider selector for models that support provider selection (NanoGPT).
 * @module components/settings/components/ProviderSelect
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, Zap } from 'lucide-react';
import type { ModelProvider } from '../../../services/providers';

interface ProviderSelectProps {
  providers: ModelProvider[];
  selectedProvider: string;
  onSelect: (provider: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const ProviderSelect: React.FC<ProviderSelectProps> = ({
  providers,
  selectedProvider,
  onSelect,
  isLoading,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProviderInfo = providers.find((p) => p.provider === selectedProvider);
  const sortedProviders = [...providers].sort((a, b) => {
    const aAvail = a.available ? 0 : 1;
    const bAvail = b.available ? 0 : 1;
    return aAvail - bAvail;
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatPrice = (price: number): string => `$${price.toFixed(4)}`;

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="flex items-center gap-2 text-sm font-semibold text-vault-800 dark:text-vault-200">
        <span className="p-1.5 rounded-md bg-vault-100 dark:bg-vault-800 text-vault-600 dark:text-vault-400">
          <Zap className="w-4 h-4" />
        </span>
        Provider
      </label>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || isLoading}
        className={`w-full px-3 py-2.5 border rounded-lg text-left transition-all duration-200 flex items-center justify-between ${
          disabled || isLoading
            ? 'bg-vault-100 dark:bg-vault-800 text-vault-400 cursor-not-allowed border-vault-200 dark:border-vault-700'
            : 'bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 border-vault-300 dark:border-vault-600 hover:border-vault-400 dark:hover:border-vault-500 focus:outline-none focus:ring-2 focus:ring-vault-500/50'
        }`}
      >
        <span className="flex items-center gap-2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : selectedProvider ? (
            <>
              <span className="font-medium">{selectedProvider}</span>
              <span className="text-vault-500 text-xs">
                (In: {formatPrice(selectedProviderInfo?.pricing.inputPer1kTokens ?? 0)}/1k, Out:{' '}
                {formatPrice(selectedProviderInfo?.pricing.outputPer1kTokens ?? 0)}/1k)
              </span>
            </>
          ) : (
            <span className="text-vault-400">Platform default (auto-selected)</span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-vault-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && !isLoading && providers.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-vault-800 border border-vault-300 dark:border-vault-600 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
          <button
            onClick={() => {
              onSelect('');
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 text-left text-sm transition-colors duration-150 ${
              !selectedProvider
                ? 'bg-vault-100 dark:bg-vault-700 text-vault-900 dark:text-vault-100 font-medium'
                : 'text-vault-700 dark:text-vault-300 hover:bg-vault-50 dark:hover:bg-vault-700/50'
            }`}
          >
            <div className="font-medium">Platform default</div>
            <div className="text-xs text-vault-500">Let NanoGPT select the best provider</div>
          </button>
          {sortedProviders.map((provider) => {
            const isUnavailable = !provider.available;
            return (
              <button
                key={provider.provider}
                onClick={() => {
                  if (isUnavailable) return;
                  onSelect(provider.provider);
                  setIsOpen(false);
                }}
                disabled={isUnavailable}
                title={isUnavailable ? 'This provider is currently unavailable' : undefined}
                className={`w-full px-3 py-2 text-left text-sm transition-colors duration-150 ${
                  isUnavailable
                    ? 'text-vault-400 dark:text-vault-500 cursor-not-allowed'
                    : provider.provider === selectedProvider
                      ? 'bg-vault-100 dark:bg-vault-700 text-vault-900 dark:text-vault-100 font-medium'
                      : 'text-vault-700 dark:text-vault-300 hover:bg-vault-50 dark:hover:bg-vault-700/50'
                }`}
              >
                <div className="font-medium">
                  {provider.provider}
                  {isUnavailable && (
                    <span className="text-amber-500 ml-2 text-xs font-normal">(unavailable)</span>
                  )}
                </div>
                <div className="text-xs text-vault-500">
                  In: {formatPrice(provider.pricing.inputPer1kTokens)}/1k tokens, Out:{' '}
                  {formatPrice(provider.pricing.outputPer1kTokens)}/1k tokens
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
