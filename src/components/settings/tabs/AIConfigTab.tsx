/**
 * @fileoverview AI configuration tab (endpoint, key, model, NanoGPT options).
 * @module components/settings/tabs/AIConfigTab
 */

import React, { useId } from 'react';
import {
  AlertCircle,
  Brain,
  CreditCard,
  Key,
  Loader2,
  LogIn,
  Server,
  Shield,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  AI_BASE_URL_PRESETS,
  getStoredApiKey,
  getStoredModelId,
} from '../config/aiBaseUrlPresets';
import { ModelSelect } from '../components/ModelSelect';
import { ProviderSelect } from '../components/ProviderSelect';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsToggle } from '../components/SettingsToggle';
import type { SettingsTabProps } from '../types';

export const AIConfigTab: React.FC<SettingsTabProps> = ({ draft, setDraft, helpers }) => {
  // Stable unique name — avoids password-manager heuristics without Math.random in render
  const apiKeyFieldName = useId();

  if (!helpers) return null;

  const {
    selectedBaseUrlPreset,
    isFetchingModels,
    isFetchingModelsForCurrentUrl,
    modelProviders,
    isFetchingProviders,
    supportsProviderSelection,
    isSigningIn,
    showClearConfirm,
    setShowClearConfirm,
    isClearing,
    fetchModels,
    handleBaseUrlChange,
    handleCustomUrlChange,
    handleApiKeyChange,
    handleModelChange,
    handleProviderChange,
    handleClearAISettings,
    startSignIn,
  } = helpers;

  const localAIConfig = draft.ai;

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-800/50 text-amber-600 dark:text-amber-400 shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
              Security Notice
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Your API key is stored locally in your browser&apos;s storage. This is convenient but
              means the key could be accessed by malicious browser extensions or if someone gains
              physical access to your unlocked computer.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setShowClearConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-800/50 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear AI Settings
              </button>
              <span className="text-xs text-amber-600 dark:text-amber-500">
                (Your characters will not be affected)
              </span>
            </div>
          </div>
        </div>
      </div>

      {showClearConfirm && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-md bg-red-100 dark:bg-red-800/50 text-red-600 dark:text-red-400 shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                Clear AI Settings?
              </h4>
              <p className="text-xs text-red-700 dark:text-red-400 mb-3">
                This will remove your API key, base URL, and model selection. Your characters and
                other data will remain untouched.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleClearAISettings()}
                  disabled={isClearing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  {isClearing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  {isClearing ? 'Clearing...' : 'Yes, Clear Settings'}
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  disabled={isClearing}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800/50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SettingsCard>
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-vault-800 dark:text-vault-200 mb-2">
              <span className="p-1.5 rounded-md bg-vault-100 dark:bg-vault-800 text-vault-600 dark:text-vault-400">
                <Server className="w-4 h-4" />
              </span>
              API Base URL
            </label>
            <div className="space-y-3">
              <select
                value={selectedBaseUrlPreset}
                onChange={(e) => {
                  const selectedPreset = AI_BASE_URL_PRESETS.find(
                    (preset) => preset.id === e.target.value
                  );
                  if (selectedPreset) {
                    handleBaseUrlChange(selectedPreset.baseUrl, true);
                  } else if (e.target.value === 'custom') {
                    setDraft((prev) => {
                      const customUrl = prev.ai.lastCustomBaseUrl ?? '';
                      return {
                        ...prev,
                        ai: {
                          ...prev.ai,
                          baseUrl: customUrl,
                          modelId: customUrl
                            ? getStoredModelId(prev.ai.modelIdsByBaseUrl, customUrl)
                            : prev.ai.modelId,
                          apiKey: customUrl
                            ? getStoredApiKey(prev.ai.apiKeysByBaseUrl, customUrl)
                            : prev.ai.apiKey,
                          availableModels: [],
                        },
                      };
                    });
                  }
                }}
                className="w-full px-3 py-2.5 border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-vault-500/50 transition-all duration-200"
              >
                {AI_BASE_URL_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
                <option value="custom">Custom URL</option>
              </select>
              <input
                type="text"
                name="ai-base-url"
                value={localAIConfig.baseUrl}
                onChange={(e) => handleCustomUrlChange(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                className="w-full px-3 py-2.5 border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 text-sm focus:outline-none focus:ring-2 focus:ring-vault-500/50 transition-all duration-200"
                placeholder="https://nano-gpt.com/api/v1"
              />
              <p className="text-xs text-vault-500">
                {selectedBaseUrlPreset === 'custom'
                  ? 'Pick a preset above or enter a custom OpenAI-compatible endpoint.'
                  : AI_BASE_URL_PRESETS.find((preset) => preset.id === selectedBaseUrlPreset)
                      ?.helper}
              </p>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-vault-800 dark:text-vault-200 mb-2">
              <span className="p-1.5 rounded-md bg-vault-100 dark:bg-vault-800 text-vault-600 dark:text-vault-400">
                <Key className="w-4 h-4" />
              </span>
              API Key
              {selectedBaseUrlPreset === 'lmstudio' && (
                <span className="text-xs font-normal text-vault-500">(optional for local)</span>
              )}
              {(() => {
                const preset = AI_BASE_URL_PRESETS.find((p) => p.id === selectedBaseUrlPreset);
                return preset?.keyUrl ? (
                  <a
                    href={preset.keyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-normal text-blue-500 hover:text-blue-400 hover:underline ml-1"
                  >
                    Get your key ↗
                  </a>
                ) : null;
              })()}
            </label>
            <input
              type="password"
              name={`vault-ai-key-${apiKeyFieldName}`}
              value={localAIConfig.apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              readOnly={false}
              onFocus={(e) => e.currentTarget.removeAttribute('readonly')}
              style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
              className="w-full px-3 py-2.5 border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 text-sm focus:outline-none focus:ring-2 focus:ring-vault-500/50 transition-all duration-200"
              placeholder={
                selectedBaseUrlPreset === 'lmstudio'
                  ? 'Optional for local endpoints'
                  : 'Enter your API key'
              }
            />
            {selectedBaseUrlPreset === 'nano-gpt' && (
              <>
                <div className="flex items-center gap-3 my-1">
                  <div className="h-px flex-1 bg-vault-200 dark:bg-vault-700" />
                  <span className="text-xs text-vault-400 dark:text-vault-500">or</span>
                  <div className="h-px flex-1 bg-vault-200 dark:bg-vault-700" />
                </div>
                <button
                  type="button"
                  onClick={() => startSignIn()}
                  disabled={isSigningIn}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium
                  bg-vault-900 dark:bg-vault-100 text-white dark:text-vault-900
                  hover:opacity-90 active:scale-[0.99] transition-all duration-200
                  disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSigningIn ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  {isSigningIn ? 'Signing in…' : 'Sign in with NanoGPT'}
                </button>
                <p className="text-xs text-vault-500 dark:text-vault-400 mt-1.5">
                  Opens NanoGPT in a new window to approve access. The app can spend from your
                  NanoGPT balance until you revoke or limit the key.
                </p>
              </>
            )}
          </div>

          <ModelSelect
            models={localAIConfig.availableModels || []}
            selectedModelId={localAIConfig.modelId}
            onSelect={handleModelChange}
            onFetch={() => void fetchModels()}
            isFetching={isFetchingModels || isFetchingModelsForCurrentUrl}
            disabled={false}
          />

          {localAIConfig.modelId && supportsProviderSelection && (
            <div className="relative">
              <ProviderSelect
                providers={modelProviders}
                selectedProvider={localAIConfig.selectedProvider ?? ''}
                onSelect={handleProviderChange}
                isLoading={isFetchingProviders}
              />
            </div>
          )}
        </div>
      </SettingsCard>

      {selectedBaseUrlPreset === 'nano-gpt' && (
        <SettingsCard
          title="NanoGPT Options"
          icon={<CreditCard className="w-4 h-4 text-vault-600 dark:text-vault-400" />}
        >
          <div className="space-y-4">
            <SettingsToggle
              stacked
              checked={localAIConfig.subscriptionModelsOnly ?? false}
              onChange={(subscriptionOnly) => {
                setDraft((prev) => ({
                  ...prev,
                  ai: { ...prev.ai, subscriptionModelsOnly: subscriptionOnly },
                }));
                if (localAIConfig.baseUrl && localAIConfig.apiKey) {
                  void fetchModels();
                }
              }}
              label="Subscription models only"
              description={
                <>
                  Show only models included in your NanoGPT subscription. Ignores the &quot;Also
                  show paid models&quot; preference.
                </>
              }
            />
            <SettingsToggle
              stacked
              checked={localAIConfig.billingMode === 'paygo'}
              onChange={(checked) =>
                setDraft((prev) => ({
                  ...prev,
                  ai: {
                    ...prev.ai,
                    billingMode: checked ? 'paygo' : 'sub',
                  },
                }))
              }
              label="Pay-as-you-go billing"
              description={
                <>
                  Force pay-as-you-go pricing even with an active subscription. Required for
                  provider selection on subscription-covered models.
                </>
              }
            />
          </div>
        </SettingsCard>
      )}

      <SettingsCard
        title="Advanced Options"
        icon={<Sparkles className="w-4 h-4 text-vault-600 dark:text-vault-400" />}
      >
        <div className="flex flex-wrap items-center gap-6">
          <SettingsToggle
            checked={localAIConfig.enableStreaming}
            onChange={(checked) =>
              setDraft((prev) => ({
                ...prev,
                ai: { ...prev.ai, enableStreaming: checked },
              }))
            }
            label="Enable streaming"
          />
          <SettingsToggle
            checked={!!localAIConfig.enableReasoning}
            onChange={(checked) =>
              setDraft((prev) => ({
                ...prev,
                ai: {
                  ...prev.ai,
                  enableReasoning: checked,
                  reasoningEffort: checked
                    ? (prev.ai.reasoningEffort ?? 'medium')
                    : 'medium',
                },
              }))
            }
            label="Enable reasoning"
          />
          <SettingsToggle
            checked={localAIConfig.showReasoning !== false}
            onChange={(checked) =>
              setDraft((prev) => ({
                ...prev,
                ai: { ...prev.ai, showReasoning: checked },
              }))
            }
            label="Show reasoning"
          />
        </div>

        {localAIConfig.enableReasoning && (
          <div className="mt-4 pt-4 border-t border-vault-200 dark:border-vault-700">
            <label className="flex items-center gap-2 text-sm font-medium text-vault-700 dark:text-vault-300 mb-2">
              <span className="p-1.5 rounded-md bg-vault-100 dark:bg-vault-800 text-vault-600 dark:text-vault-400">
                <Brain className="w-4 h-4" />
              </span>
              Reasoning Effort
            </label>
            <select
              value={localAIConfig.reasoningEffort ?? 'medium'}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  ai: {
                    ...prev.ai,
                    reasoningEffort: e.target.value as 'low' | 'medium' | 'high',
                  },
                }))
              }
              className="w-full px-3 py-2.5 border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-vault-500/50 transition-all duration-200"
            >
              <option value="low">Low - Faster responses, less reasoning</option>
              <option value="medium">Medium - Balanced reasoning (default)</option>
              <option value="high">High - More thorough reasoning</option>
            </select>
            <p className="mt-2 text-xs text-vault-500">
              Controls reasoning depth for OpenAI o1/o3/o4-mini and OpenRouter models.
            </p>
          </div>
        )}
      </SettingsCard>
    </div>
  );
};
