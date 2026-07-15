/**
 * @fileoverview Searchable AI model selector for settings.
 * @module components/settings/components/ModelSelect
 */

import React, { useEffect, useRef, useState } from 'react';
import { Brain, ChevronDown, Loader2, RefreshCw, Search } from 'lucide-react';
import type { AIModelInfo } from '../../../db/characterTypes';

interface ModelSelectProps {
  models: AIModelInfo[];
  selectedModelId: string;
  onSelect: (modelId: string) => void;
  onFetch: () => void;
  isFetching: boolean;
  disabled?: boolean;
}

export const ModelSelect: React.FC<ModelSelectProps> = ({
  models,
  selectedModelId,
  onSelect,
  onFetch,
  isFetching,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedModel =
    models.find((m) => m.id === selectedModelId) ??
    (selectedModelId ? { id: selectedModelId, name: selectedModelId } : undefined);

  const filteredModels = models.filter(
    (model) =>
      model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();

      const scrollableParent = containerRef.current?.closest('.overflow-y-auto');
      if (scrollableParent && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const parentRect = scrollableParent.getBoundingClientRect();
        const dropdownHeight = 256;

        const spaceBelow = parentRect.bottom - containerRect.bottom;
        if (spaceBelow < dropdownHeight) {
          const scrollNeeded = dropdownHeight - spaceBelow + 16;
          scrollableParent.scrollTo({
            top: scrollableParent.scrollTop + scrollNeeded,
            behavior: 'smooth',
          });
        }
      }
    }
  }, [isOpen]);

  const handleSelect = (modelId: string) => {
    onSelect(modelId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredModels.length > 0) {
      handleSelect(filteredModels[0].id);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="flex items-center gap-2 text-sm font-semibold text-vault-800 dark:text-vault-200">
        <span className="p-1.5 rounded-md bg-vault-100 dark:bg-vault-800 text-vault-600 dark:text-vault-400">
          <Brain className="w-4 h-4" />
        </span>
        Model
      </label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <button
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className={`w-full px-3 py-2.5 border rounded-lg text-left transition-all duration-200 flex items-center justify-between ${
              disabled
                ? 'bg-vault-100 dark:bg-vault-800 text-vault-400 cursor-not-allowed border-vault-200 dark:border-vault-700'
                : 'bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 border-vault-300 dark:border-vault-600 hover:border-vault-400 dark:hover:border-vault-500 focus:outline-none focus:ring-2 focus:ring-vault-500/50'
            }`}
          >
            <span className={selectedModelId ? 'font-medium' : 'text-vault-400'}>
              {selectedModel?.name || 'Select or type to search models...'}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-vault-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-vault-800 border border-vault-300 dark:border-vault-600 rounded-lg shadow-xl z-50 max-h-64 overflow-hidden">
              <div className="p-2 border-b border-vault-200 dark:border-vault-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vault-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type to filter models..."
                    className="w-full pl-9 pr-3 py-2 border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 text-sm focus:outline-none focus:ring-2 focus:ring-vault-500/50"
                  />
                </div>
              </div>

              <div className="overflow-y-auto max-h-48">
                {filteredModels.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-vault-500 text-center">
                    No models found matching &quot;{searchTerm}&quot;
                  </div>
                ) : (
                  filteredModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleSelect(model.id)}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors duration-150 ${
                        model.id === selectedModelId
                          ? 'bg-vault-100 dark:bg-vault-700 text-vault-900 dark:text-vault-100 font-medium'
                          : 'text-vault-700 dark:text-vault-300 hover:bg-vault-50 dark:hover:bg-vault-700/50'
                      }`}
                    >
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs text-vault-500 truncate">{model.id}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onFetch}
          disabled={isFetching || disabled}
          className="px-4 py-2 bg-vault-100 dark:bg-vault-800 hover:bg-vault-200 dark:hover:bg-vault-700 disabled:opacity-50 disabled:cursor-not-allowed text-vault-700 dark:text-vault-300 rounded-lg transition-all duration-200 flex items-center gap-2 font-medium focus:outline-none focus:ring-2 focus:ring-vault-500/50"
        >
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Fetch
        </button>
      </div>
    </div>
  );
};
