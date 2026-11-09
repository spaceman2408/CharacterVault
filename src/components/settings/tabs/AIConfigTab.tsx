/**
 * @fileoverview AI configuration tab (endpoint, key, model, NanoGPT options).
 * @module components/settings/tabs/AIConfigTab
 */

import React from 'react';
import {
  AlertCircle,
  Brain,
  CreditCard,
  Gauge,
  Bookmark,
  Key,
  Loader2,
  LogIn,
  Route,
  Server,
  Shield,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  AI_BASE_URL_PRESETS,
  SAVED_PRESET_PREFIX,
  builtinPresetForUrl,
  getStoredApiKey,
  getStoredModelId,
  isPresetUrl,
  normalizeBaseUrl,
  suggestPresetLabel,
} from '../config/aiBaseUrlPresets';
import { ModelSelect } from '../components/ModelSelect';
import { NanoGPTAccountOverview } from '../components/NanoGPTAccountOverview';
import { OpenRouterAccountOverview } from '../components/OpenRouterAccountOverview';
import { SyntheticAccountOverview } from '../components/SyntheticAccountOverview';
import { ProviderSelect } from '../components/ProviderSelect';
import { SettingsCard } from '../components/SettingsCard';
import { PASSWORD_MANAGER_IGNORE_PROPS, SecretInput } from '../components/SecretInput';
import { SettingsToggle } from '../components/SettingsToggle';
import { OPENROUTER_SORTS, type ReasoningEffort } from '../../../db/characterTypes';
import { getOpenRouterPinnedHost, isOpenRouterBaseUrl } from '../../../services/providers';
import { getHiddenChainOfThoughtNote } from '../../../services/reasoning/hiddenChainOfThought';
import type { SettingsTabProps } from '../types';

const smallButtonClass =
  'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/50';

export const AIConfigTab: React.FC<SettingsTabProps> = ({ draft, setDraft, helpers }) => {
  const [naming, setNaming] = React.useState<{ key: string; label: string } | null>(null);
  const [removingKey, setRemovingKey] = React.useState<string | null>(null);

  if (!helpers) return null;

  const {
    selectedBaseUrlPreset,
    isFetchingModels,
    isFetchingModelsForCurrentUrl,
    modelFetchErrorForCurrentUrl,
    modelProviders,
    isFetchingProviders,
    supportsProviderSelection,
    isSigningIn,
    showClearConfirm,
    setShowClearConfirm,
    isClearing,
    fetchModels,
    filterModelsForUrl,
    handleCustomUrlChange,
    handleApiKeyChange,
    handleModelChange,
    handleProviderChange,
    selectBuiltinPreset,
    selectSavedPreset,
    saveCustomPreset,
    removeCustomPreset,
    handleClearAISettings,
    startSignIn,
  } = helpers;

  const localAIConfig = draft.ai;
  const hiddenCotNote = getHiddenChainOfThoughtNote(localAIConfig.modelId);
  const isOpenRouter = isOpenRouterBaseUrl(localAIConfig.baseUrl);
  const openRouterPin = isOpenRouter ? getOpenRouterPinnedHost(localAIConfig) : undefined;
  const savedPresets = localAIConfig.customBaseUrlPresets ?? [];
  const currentUrl = normalizeBaseUrl(localAIConfig.baseUrl);
  const currentModel = localAIConfig.modelId;
  const builtinPreset = builtinPresetForUrl(currentUrl);
  const builtinId = builtinPreset?.id;
  const savedPreset = selectedBaseUrlPreset.startsWith(SAVED_PRESET_PREFIX)
    ? savedPresets[Number(selectedBaseUrlPreset.slice(SAVED_PRESET_PREFIX.length))]
    : undefined;
  const currentKey = `${currentUrl}
${currentModel}`;
  const savedPresetKey = savedPreset ? `${savedPreset.baseUrl}
${savedPreset.modelId ?? ''}` : '';
  const isAlreadySaved = savedPresets.some(
    (preset) =>
      normalizeBaseUrl(preset.baseUrl) === currentUrl && (preset.modelId ?? '') === currentModel
  );
  const canSavePreset = !!currentUrl && !isAlreadySaved && (!builtinPreset || !!currentModel);
  const isNaming = canSavePreset && naming?.key === currentKey;
  const isConfirmingRemove = !!savedPreset && removingKey === savedPresetKey;

  const commitPresetName = () => {
    if (!naming) return;
    saveCustomPreset(naming.label);
    setNaming(null);
  };

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
                This will remove your API key, base URL, and model selection. Saved presets stay,
                without their keys. Your characters and other data will remain untouched.
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
                    selectBuiltinPreset(selectedPreset.id);
                  } else if (e.target.value.startsWith(SAVED_PRESET_PREFIX)) {
                    const preset =
                      savedPresets[Number(e.target.value.slice(SAVED_PRESET_PREFIX.length))];
                    if (preset) selectSavedPreset(preset);
                  } else if (e.target.value === 'custom') {
                    setDraft((prev) => {
                      const lastCustom = prev.ai.lastCustomBaseUrl ?? '';
                      const customUrl = isPresetUrl(lastCustom, prev.ai.customBaseUrlPresets)
                        ? ''
                        : lastCustom;
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
                {savedPresets.length > 0 && (
                  <optgroup label="Saved">
                    {savedPresets.map((preset, index) => (
                      <option
                        key={`${preset.baseUrl}
${preset.modelId ?? ''}`}
                        value={`${SAVED_PRESET_PREFIX}${index}`}
                      >
                        {preset.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value="custom">Custom URL</option>
              </select>
              <input
                type="text"
                value={localAIConfig.baseUrl}
                onChange={(e) => handleCustomUrlChange(e.target.value)}
                {...PASSWORD_MANAGER_IGNORE_PROPS}
                className="w-full px-3 py-2.5 border border-border-strong rounded-lg bg-surface text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all duration-200"
                placeholder="https://nano-gpt.com/api/v1"
              />
              <p className="text-xs text-fg-muted">
                {selectedBaseUrlPreset === 'custom'
                  ? 'Pick a preset above or enter a custom OpenAI-compatible endpoint.'
                  : savedPreset
                    ? savedPreset.modelId
                      ? `Saved preset: ${savedPreset.modelId} on ${builtinPreset?.label ?? currentUrl}.`
                      : 'Saved endpoint.'
                    : builtinPreset?.helper}
              </p>
              {isNaming && naming ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={naming.label}
                    onChange={(e) => setNaming({ key: currentKey, label: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitPresetName();
                      } else if (e.key === 'Escape') {
                        e.stopPropagation();
                        setNaming(null);
                      }
                    }}
                    {...PASSWORD_MANAGER_IGNORE_PROPS}
                    aria-label="Preset name"
                    placeholder="Preset name"
                    className="flex-1 min-w-40 px-3 py-1.5 border border-border-strong rounded-lg bg-surface text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                  <button
                    type="button"
                    onClick={commitPresetName}
                    className={`${smallButtonClass} bg-accent text-accent-fg hover:opacity-90`}
                  >
                    Save preset
                  </button>
                  <button
                    type="button"
                    onClick={() => setNaming(null)}
                    className={`${smallButtonClass} text-fg-muted hover:text-fg hover:bg-muted`}
                  >
                    Cancel
                  </button>
                </div>
              ) : canSavePreset ? (
                <button
                  type="button"
                  onClick={() =>
                    setNaming({
                      key: currentKey,
                      label: suggestPresetLabel(currentUrl, currentModel),
                    })
                  }
                  className={`${smallButtonClass} text-accent hover:bg-accent-soft`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  Save as preset
                </button>
              ) : null}
              {savedPreset &&
                (isConfirmingRemove ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                    <span className="basis-full">
                      Remove “{savedPreset.label}” from saved presets? Your URL, key and model
                      stay as they are.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        removeCustomPreset(savedPreset);
                        setRemovingKey(null);
                      }}
                      className={`${smallButtonClass} text-white bg-danger hover:opacity-90`}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemovingKey(null)}
                      className={`${smallButtonClass} text-fg-muted hover:text-fg hover:bg-muted`}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRemovingKey(savedPresetKey)}
                    className={`${smallButtonClass} text-fg-muted hover:text-danger hover:bg-danger-soft`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove preset
                  </button>
                ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-fg mb-2">
              <span className="p-1.5 rounded-md bg-muted text-fg-muted">
                <Key className="w-4 h-4" />
              </span>
              API Key
              {builtinId === 'lmstudio' && (
                <span className="text-xs font-normal text-fg-muted">(optional for local)</span>
              )}
              {(() => {
                const preset = builtinPreset;
                return (
                  <>
                    {preset?.keyUrl && (
                      <a
                        href={preset.keyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-normal text-info hover:text-blue-400 hover:underline ml-1"
                      >
                        Get your key ↗
                      </a>
                    )}
                    {preset?.referralUrl && (
                      <a
                        href={preset.referralUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Referral link: signing up through it supports CharacterVault. ${preset.referralPerk ?? ''}`.trim()}
                        className="text-xs font-normal text-fg-muted hover:text-info hover:underline"
                      >
                        New? Sign up (referral) ↗
                      </a>
                    )}
                  </>
                );
              })()}
            </label>
            <SecretInput
              value={localAIConfig.apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              className="w-full px-3 py-2.5 border border-border-strong rounded-lg bg-surface text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all duration-200"
              placeholder={
                builtinId === 'lmstudio'
                  ? 'Optional for local endpoints'
                  : 'Enter your API key'
              }
            />
            {builtinId === 'nano-gpt' && (
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
            models={filterModelsForUrl(localAIConfig.baseUrl, localAIConfig.availableModels || [])}
            selectedModelId={localAIConfig.modelId}
            onSelect={handleModelChange}
            onFetch={() => void fetchModels()}
            isFetching={isFetchingModels || isFetchingModelsForCurrentUrl}
            disabled={false}
          />
          {modelFetchErrorForCurrentUrl && !isFetchingModels && !isFetchingModelsForCurrentUrl && (
            <p role="alert" className="text-xs text-danger">
              Couldn't load models: {modelFetchErrorForCurrentUrl}
            </p>
          )}

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
                selectedProvider={
                  isOpenRouter ? (openRouterPin ?? '') : (localAIConfig.selectedProvider ?? '')
                }
                onSelect={handleProviderChange}
                isLoading={isFetchingProviders}
                platformName={isOpenRouter ? 'OpenRouter' : 'NanoGPT'}
              />
              {isOpenRouter && (
                <p className="mt-1.5 text-xs text-fg-muted">
                  Lists every host, including ones your OpenRouter account, key, or privacy options
                  block. A blocked host is skipped, and a reply&apos;s info shows which host answered.
                </p>
              )}
            </div>
          )}

          {openRouterPin && (
            <SettingsToggle
              stacked
              checked={localAIConfig.openRouter?.pinnedHostOnly ?? false}
              onChange={(checked) =>
                setDraft((prev) => ({
                  ...prev,
                  ai: {
                    ...prev.ai,
                    openRouter: { ...prev.ai.openRouter, pinnedHostOnly: checked },
                  },
                }))
              }
              label="Only use this host"
              description={
                <>
                  Fail the request instead of falling back to another host when this one is down
                  or busy.
                </>
              }
            />
          )}
        </div>
      </SettingsCard>

      {builtinId === 'nano-gpt' && (
        <NanoGPTAccountOverview
          baseUrl={localAIConfig.baseUrl}
          apiKey={localAIConfig.apiKey}
          enabled
        />
      )}

      {builtinId === 'synthetic' && (
        <SyntheticAccountOverview
          baseUrl={localAIConfig.baseUrl}
          apiKey={localAIConfig.apiKey}
          enabled
        />
      )}

      {builtinId === 'openrouter' && (
        <OpenRouterAccountOverview
          baseUrl={localAIConfig.baseUrl}
          apiKey={localAIConfig.apiKey}
          enabled
        />
      )}

      {isOpenRouter && (
        <SettingsCard
          title="OpenRouter Options"
          icon={<Route className="w-4 h-4 text-fg-muted" />}
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="openrouter-host-priority"
                className="flex items-center gap-2 text-sm font-medium text-fg-muted mb-2"
              >
                <span className="p-1.5 rounded-md bg-muted text-fg-muted">
                  <Gauge className="w-4 h-4" />
                </span>
                Host priority
              </label>
              <select
                id="openrouter-host-priority"
                value={localAIConfig.openRouter?.sort ?? ''}
                onChange={(e) => {
                  const sort = OPENROUTER_SORTS.find((value) => value === e.target.value);
                  setDraft((prev) => ({
                    ...prev,
                    ai: { ...prev.ai, openRouter: { ...prev.ai.openRouter, sort } },
                  }));
                }}
                className="w-full px-3 py-2.5 border border-border-strong rounded-lg bg-surface text-fg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all duration-200"
              >
                <option value="">Balanced: spread by price and uptime (default)</option>
                <option value="price">Cheapest: lowest price first</option>
                <option value="throughput">Fastest: most tokens per second</option>
                <option value="latency">Quickest start: lowest time to first token</option>
              </select>
              <p className="mt-2 text-xs text-fg-muted">
                Which hosts OpenRouter tries first. A model with a pinned host uses the pin instead.
                Any choice but Balanced also turns off Auto Exacto for Agent tool calls.
              </p>
            </div>
            <SettingsToggle
              stacked
              checked={localAIConfig.openRouter?.exactoForAgent ?? false}
              onChange={(checked) =>
                setDraft((prev) => ({
                  ...prev,
                  ai: {
                    ...prev.ai,
                    openRouter: { ...prev.ai.openRouter, exactoForAgent: checked },
                  },
                }))
              }
              label="Always use Exacto for the Agent"
              description={
                <>
                  OpenRouter&apos;s Auto Exacto already sends Agent tool calls to the hosts with
                  the most reliable tool calls, unless a host priority is set. Turn this on to keep
                  Exacto for the Agent anyway. A pinned host still comes first.
                  <span className="mt-1.5 block">
                    Cache trade-off: Exacto can switch hosts partway through a run, which loses
                    prompt-cache hits. If cache hits matter more, leave this off and set Host
                    priority to Cheapest, or pin a host, so the Agent stays on one host.
                  </span>
                </>
              }
            />
            <SettingsToggle
              stacked
              checked={localAIConfig.openRouter?.denyDataCollection ?? false}
              onChange={(checked) =>
                setDraft((prev) => ({
                  ...prev,
                  ai: {
                    ...prev.ai,
                    openRouter: { ...prev.ai.openRouter, denyDataCollection: checked },
                  },
                }))
              }
              label="No training on prompts"
              description={
                <>
                  Skip hosts that may store and train on your prompts. Some allowed hosts still keep
                  prompts for a short time, for example to check for abuse.
                </>
              }
            />
            <SettingsToggle
              stacked
              checked={localAIConfig.openRouter?.zdrOnly ?? false}
              onChange={(checked) =>
                setDraft((prev) => ({
                  ...prev,
                  ai: { ...prev.ai, openRouter: { ...prev.ai.openRouter, zdrOnly: checked } },
                }))
              }
              label="Zero data retention only"
              description={
                <>
                  Only use hosts that never store your prompts. Model lists hide models with no such
                  host. Your OpenRouter privacy settings still apply on top.
                </>
              }
            />
            <SettingsToggle
              stacked
              checked={localAIConfig.openRouter?.freeModelsOnly ?? false}
              onChange={(checked) =>
                setDraft((prev) => ({
                  ...prev,
                  ai: {
                    ...prev.ai,
                    openRouter: { ...prev.ai.openRouter, freeModelsOnly: checked },
                  },
                }))
              }
              label="Free models only"
              description={
                <>
                  Show only $0 models in OpenRouter model lists. Free models have a daily request
                  limit on your account.
                </>
              }
            />
          </div>
        </SettingsCard>
      )}

      {builtinId === 'nano-gpt' && (
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
            <SettingsToggle
              stacked
              checked={localAIConfig.enableCacheProviderRouting ?? false}
              onChange={(checked) =>
                setDraft((prev) => ({
                  ...prev,
                  ai: { ...prev.ai, enableCacheProviderRouting: checked },
                }))
              }
              label="Cache-capable provider routing"
              description={
                <>
                  Route requests to a provider that supports prompt caching for lower cost and
                  latency. If no cache-capable provider is available for a model, the request will
                  fail. Provider stickiness is on by default.
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
