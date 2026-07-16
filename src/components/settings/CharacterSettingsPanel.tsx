/**
 * @fileoverview Settings panel shell — tab registry, draft lifecycle, modal chrome.
 * @module components/settings/CharacterSettingsPanel
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Save, Settings2, X } from 'lucide-react';
import { CharacterEditorContext } from '../../context';
import { ToastContainer } from './components/ToastContainer';
import { useModelCatalog } from './hooks/useModelCatalog';
import { useNanoGPTSignIn } from './hooks/useNanoGPTSignIn';
import { useSettingsDraft } from './hooks/useSettingsDraft';
import { SETTINGS_TABS } from './registry';
import type {
  CharacterSettingsPanelProps,
  SettingsPanelHelpers,
  SettingsTabId,
  ToastNotification,
} from './types';

export function CharacterSettingsPanel({
  isOpen,
  onClose,
  reloadSettings: propReloadSettings,
}: CharacterSettingsPanelProps): React.ReactElement | null {
  const editorContext = React.useContext(CharacterEditorContext);
  const reloadSettings =
    propReloadSettings ?? editorContext?.reloadSettings ?? (async () => {});

  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [activeTab, setActiveTab] = useState<SettingsTabId>('ai');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toastTimeoutsRef = useRef<number[]>([]);

  const addToast = useCallback((type: ToastNotification['type'], message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, type, message }]);
    const timeoutId = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
    toastTimeoutsRef.current.push(timeoutId);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const { draft, setDraft, isLoading, isSaving, save, clearAISettings } = useSettingsDraft({
    isOpen,
    reloadSettings,
    addToast,
  });

  const modelCatalog = useModelCatalog({
    isOpen,
    isLoading,
    draft,
    setDraft,
    addToast,
  });

  const nanoGPT = useNanoGPTSignIn({
    baseUrl: draft.ai.baseUrl,
    setDraft,
    handleApiKeyChange: modelCatalog.handleApiKeyChange,
    fetchModelsForUrl: modelCatalog.fetchModelsForUrlRef,
    addToast,
  });

  // Reset toasts when panel closes
  useEffect(() => {
    if (isOpen) return;
    setToasts([]);
    toastTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    toastTimeoutsRef.current = [];
  }, [isOpen]);

  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      toastTimeoutsRef.current = [];
    };
  }, []);

  // Keyboard: Escape + arrow tab navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const tabs = SETTINGS_TABS.map((t) => t.id);
        const currentIndex = tabs.indexOf(activeTab);
        let newIndex: number;

        if (e.key === 'ArrowLeft') {
          newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        } else {
          newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        }

        setActiveTab(tabs[newIndex]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;

    const panel = panelRef.current;
    const focusableElements = panel.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen, activeTab]);

  // Open/close fade animation (timers/rAF always cleaned up on re-run/unmount)
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    }

    setIsVisible(false);
    const timeoutId = window.setTimeout(() => setIsRendered(false), 300);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  const handleClearAISettings = async () => {
    setIsClearing(true);
    try {
      await clearAISettings();
      modelCatalog.resetProviderState();
      await reloadSettings();
      addToast('success', 'AI settings cleared. Your characters are safe.');
      setShowClearConfirm(false);
    } catch {
      addToast('error', 'Failed to clear AI settings');
    } finally {
      setIsClearing(false);
    }
  };

  if (!isRendered) return null;

  const helpers: SettingsPanelHelpers = {
    selectedBaseUrlPreset: modelCatalog.selectedBaseUrlPreset,
    isFetchingModels: modelCatalog.isFetchingModels,
    isFetchingModelsForCurrentUrl: modelCatalog.isFetchingModelsForCurrentUrl,
    modelProviders: modelCatalog.modelProviders,
    isFetchingProviders: modelCatalog.isFetchingProviders,
    supportsProviderSelection: modelCatalog.supportsProviderSelection,
    isSigningIn: nanoGPT.isSigningIn,
    showClearConfirm,
    setShowClearConfirm,
    isClearing,
    fetchModels: modelCatalog.fetchModels,
    modelsByBaseUrl: modelCatalog.modelsByBaseUrl,
    isFetchingModelsForUrl: modelCatalog.isFetchingModelsForUrl,
    fetchModelsForUrl: modelCatalog.fetchModelsForUrl,
    handleBaseUrlChange: modelCatalog.handleBaseUrlChange,
    handleCustomUrlChange: modelCatalog.handleCustomUrlChange,
    handleApiKeyChange: modelCatalog.handleApiKeyChange,
    handleModelChange: modelCatalog.handleModelChange,
    handleProviderChange: modelCatalog.handleProviderChange,
    handleClearAISettings,
    startSignIn: nanoGPT.startSignIn,
  };

  const activeModule = SETTINGS_TABS.find((t) => t.id === activeTab);
  const ActiveTabComponent = activeModule?.Component;

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div
        className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          ref={panelRef}
          className={`bg-vault-50 dark:bg-vault-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl h-[min(100dvh,100%)] sm:h-[90vh] max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden ring-1 ring-vault-200 dark:ring-vault-800 transition-transform duration-300 scale-100 pb-[env(safe-area-inset-bottom)] ${
            isVisible ? 'scale-100' : 'scale-95'
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-vault-200 dark:border-vault-800 bg-white dark:bg-vault-900 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-linear-to-br from-vault-500 to-vault-600 shrink-0">
                <Settings2 className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2
                  id="settings-title"
                  className="text-base sm:text-lg font-bold text-vault-900 dark:text-vault-100 truncate"
                >
                  AI Settings
                </h2>
                <p className="text-xs text-vault-500 hidden sm:block">
                  Configure your AI generation preferences
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="min-h-11 min-w-11 inline-flex items-center justify-center text-vault-500 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-200 hover:bg-vault-100 dark:hover:bg-vault-800 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-vault-500/50 shrink-0"
              aria-label="Close settings panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            className="flex min-h-12 sm:min-h-14 overflow-x-auto overflow-y-hidden border-b border-vault-200 dark:border-vault-800 px-2 sm:px-6 pt-1 sm:pt-2 bg-vault-50 dark:bg-vault-900/50 scrollbar-thin scrollbar-thumb-vault-300 dark:scrollbar-thumb-vault-700 shrink-0"
            role="tablist"
          >
            {SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex min-h-12 items-center px-4 text-sm font-medium capitalize transition-all duration-200 rounded-t-lg focus:outline-none focus:ring-2 focus:ring-vault-500/50 focus:ring-inset whitespace-nowrap shrink-0 ${
                    activeTab === tab.id
                      ? 'text-vault-700 dark:text-vault-200'
                      : 'text-vault-500 dark:text-vault-400 hover:text-vault-700 dark:hover:text-vault-300 hover:bg-vault-100/50 dark:hover:bg-vault-800/50'
                  }`}
                  aria-selected={activeTab === tab.id}
                  role="tab"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="w-4 h-4 shrink-0" />
                    {tab.label}
                  </span>
                  {activeTab === tab.id && (
                    <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-vault-600 dark:bg-vault-400" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 sm:space-y-6 bg-vault-50/50 dark:bg-vault-900/50">
            {isLoading && activeTab !== 'sampler' && (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-vault-600" />
                  <span className="text-sm text-vault-500">Loading settings...</span>
                </div>
              </div>
            )}

            {(!isLoading || activeTab === 'sampler') && ActiveTabComponent && (
              <ActiveTabComponent draft={draft} setDraft={setDraft} helpers={helpers} />
            )}
          </div>

          <div className="flex items-center justify-stretch sm:justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-vault-200 dark:border-vault-800 bg-white dark:bg-vault-900 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none min-h-11 px-4 py-2.5 text-sm font-medium text-vault-700 dark:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-800 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-vault-500/50"
            >
              Cancel
            </button>
            <button
              onClick={() => void save()}
              disabled={isSaving}
              className="flex-1 sm:flex-none min-h-11 flex items-center justify-center gap-2 px-4 py-2.5 bg-linear-to-r from-vault-600 to-vault-700 hover:from-vault-700 hover:to-vault-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-vault-500/50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default CharacterSettingsPanel;
