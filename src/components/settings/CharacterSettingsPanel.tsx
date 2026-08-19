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
        className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-overlay backdrop-blur-sm p-0 sm:p-4 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          ref={panelRef}
          className={`bg-bg rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl h-[min(100dvh,100%)] sm:h-[90vh] max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden ring-1 ring-border transition-transform duration-300 scale-100 pb-[env(safe-area-inset-bottom)] ${
            isVisible ? 'scale-100' : 'scale-95'
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
        >
          <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-surface shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="shrink-0 rounded-xl bg-muted p-2">
                <Settings2 className="h-5 w-5 text-fg-muted" />
              </div>
              <div className="min-w-0">
                <h2
                  id="settings-title"
                  className="truncate text-base font-bold text-fg sm:text-lg"
                >
                  AI Settings
                </h2>
                <p className="hidden text-xs text-fg-muted sm:block">
                  Configure your AI generation preferences
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-muted hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
              aria-label="Close settings panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            className="flex min-h-12 sm:min-h-14 overflow-x-auto overflow-y-hidden border-b border-border px-2 sm:px-6 pt-1 sm:pt-2 bg-bg/50 scrollbar-thin scrollbar-thumb-fg-subtle shrink-0"
            role="tablist"
          >
            {SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex min-h-12 items-center px-4 text-sm font-medium capitalize transition-all duration-200 rounded-t-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-inset whitespace-nowrap shrink-0 ${
                    activeTab === tab.id
                      ? 'text-accent'
                      : 'text-fg-muted hover:text-accent hover:bg-accent-soft'
                  }`}
                  aria-selected={activeTab === tab.id}
                  role="tab"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="w-4 h-4 shrink-0" />
                    {tab.label}
                  </span>
                  {activeTab === tab.id && (
                    <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-accent" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-bg p-4 sm:space-y-6 sm:p-6">
            {isLoading && activeTab !== 'sampler' && (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-fg-muted" />
                  <span className="text-sm text-fg-muted">Loading settings...</span>
                </div>
              </div>
            )}

            {(!isLoading || activeTab === 'sampler') && ActiveTabComponent && (
              <ActiveTabComponent draft={draft} setDraft={setDraft} helpers={helpers} />
            )}
          </div>

          <div className="flex shrink-0 items-center justify-stretch gap-2 border-t border-border bg-surface px-4 py-3 sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:bg-muted hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong sm:flex-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={isSaving}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default CharacterSettingsPanel;
