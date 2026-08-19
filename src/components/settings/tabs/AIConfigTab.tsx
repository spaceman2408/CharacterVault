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
import { NanoGPTAccountOverview } from '../components/NanoGPTAccountOverview';
import { OpenRouterAccountOverview } from '../components/OpenRouterAccountOverview';
import { SyntheticAccountOverview } from '../components/SyntheticAccountOverview';
import { ProviderSelect } from '../components/ProviderSelect';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsToggle } from '../components/SettingsToggle';
import type { ReasoningEffort } from '../../../db/characterTypes';
import { getHiddenChainOfThoughtNote } from '../../../services/reasoning/hiddenChainOfThought';
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
  const hiddenCotNote = getHiddenChainOfThoughtNote(localAIConfig.modelId);

  return (
    <div className="space-y-5">
      <div className="bg-warning-soft rounded-xl p-4 border border-warning/30">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-md bg-warning-soft text-warning shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-warning-soft-fg mb-1">
              Security Notice
            </h4>
            <p className="text-xs text-warning-soft-fg leading-relaxed">
              Your API key is stored locally in your browser&apos;s storage. This is convenient but
              means the key could be accessed by malicious browser extensions or if someone gains
              physical access to your unlocked computer.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setShowClearConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-warning-soft-fg bg-warning-soft hover:opacity-90 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear AI Settings
              </button>
              <span className="text-xs text-warning">
                (Your characters will not be affected)
              </span>
            </div>
          </div>
        </div>
      </div>

      {showClearConfirm && (
        <div className="bg-danger-soft rounded-xl p-4 border border-danger/30">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-md bg-danger-soft text-danger shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-danger-soft-fg mb-1">
                Clear AI Settings?
              </h4>
              <p className="text-xs text-danger mb-3">
                This will remove your API key, base URL, and model selection. Your characters and
                other data will remain untouched.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleClearAISettings()}
                  disabled={isClearing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-danger hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/50"
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
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-danger-soft-fg hover:bg-danger-soft rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/50"
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
            <label className="flex items-center gap-2 text-sm font-semibold text-fg mb-2">
              <span className="p-1.5 rounded-md bg-muted text-fg-muted">
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
                className="w-full px-3 py-2.5 border border-border-strong rounded-lg bg-surface text-fg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all duration-200"
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
                className="w-full px-3 py-2.5 border border-border-strong rounded-lg bg-surface text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all duration-200"
                placeholder="https://nano-gpt.com/api/v1"
              />
              <p className="text-xs text-fg-muted">
                {selectedBaseUrlPreset === 'custom'
                  ? 'Pick a preset above or enter a custom OpenAI-compatible endpoint.'
                  : AI_BASE_URL_PRESETS.find((preset) => preset.id === selectedBaseUrlPreset)
                      ?.helper}
              </p>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-fg mb-2">
              <span className="p-1.5 rounded-md bg-muted text-fg-muted">
                <Key className="w-4 h-4" />
              </span>
              API Key
              {selectedBaseUrlPreset === 'lmstudio' && (
                <span className="text-xs font-normal text-fg-muted">(optional for local)</span>
              )}
              {(() => {
                const preset = AI_BASE_URL_PRESETS.find((p) => p.id === selectedBaseUrlPreset);
                return preset?.keyUrl ? (
                  <a
                    href={preset.keyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-normal text-info hover:text-blue-400 hover:underline ml-1"
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
              className="w-full px-3 py-2.5 border border-border-strong rounded-lg bg-surface text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all duration-200"
              placeholder={
                selectedBaseUrlPreset === 'lmstudio'
                  ? 'Optional for local endpoints'
                  : 'Enter your API key'
              }
            />
            {selectedBaseUrlPreset === 'nano-gpt' && (
              <>
                <div className="flex items-center gap-3 my-1">
                  <div className="h-px flex-1 bg-hover" />
                  <span className="text-xs text-fg-subtle">or</span>
                  <div className="h-px flex-1 bg-hover" />
                </div>
                <button
                  type="button"
                  onClick={() => startSignIn()}
                  disabled={isSigningIn}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-accent text-accent-fg hover:opacity-90 active:scale-[0.99] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSigningIn ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  {isSigningIn ? 'Signing in…' : 'Sign in with NanoGPT'}
                </button>
                <p className="text-xs text-fg-muted mt-1.5">
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

          {hiddenCotNote && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <p className="text-xs leading-relaxed text-warning-soft-fg">
                {hiddenCotNote}
              </p>
            </div>
          )}

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
        <NanoGPTAccountOverview
          baseUrl={localAIConfig.baseUrl}
          apiKey={localAIConfig.apiKey}
          enabled
        />
      )}

      {selectedBaseUrlPreset === 'synthetic' && (
        <SyntheticAccountOverview
          baseUrl={localAIConfig.baseUrl}
          apiKey={localAIConfig.apiKey}
          enabled
        />
      )}

      {selectedBaseUrlPreset === 'openrouter' && (
        <OpenRouterAccountOverview
          baseUrl={localAIConfig.baseUrl}
          apiKey={localAIConfig.apiKey}
          enabled
        />
      )}

      {selectedBaseUrlPreset === 'nano-gpt' && (
        <SettingsCard
          title="NanoGPT Options"
          icon={<CreditCard className="w-4 h-4 text-fg-muted" />}
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
                  void fetchModels({ subscriptionOnly });
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
        icon={<Sparkles className="w-4 h-4 text-fg-muted" />}
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
          <div className="mt-4 pt-4 border-t border-border">
            <label className="flex items-center gap-2 text-sm font-medium text-fg-muted mb-2">
              <span className="p-1.5 rounded-md bg-muted text-fg-muted">
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
                    reasoningEffort: e.target.value as ReasoningEffort,
                  },
                }))
              }
              className="w-full px-3 py-2.5 border border-border-strong rounded-lg bg-surface text-fg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all duration-200"
            >
              <option value="minimal">Minimal: fastest, almost no thinking</option>
              <option value="low">Low: light thinking</option>
              <option value="medium">Medium: balanced (default)</option>
              <option value="high">High: thorough thinking</option>
              <option value="xhigh">Extra high: peak on OpenAI-style models</option>
              <option value="max">Max: peak on DeepSeek, GLM, and similar</option>
            </select>
            <p className="mt-2 text-xs text-fg-muted">
              How hard the model thinks when reasoning is on.{' '}
              <a
                href={`${import.meta.env.BASE_URL}docs/configuration/reasoning-effort`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-fg-muted underline underline-offset-2 hover:text-fg"
              >
                Read the reasoning effort guide
              </a>
              .
            </p>
          </div>
        )}
      </SettingsCard>
    </div>
  );
};
