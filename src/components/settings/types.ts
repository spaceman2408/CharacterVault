/**
 * @fileoverview Shared types for the modular settings panel.
 * @module components/settings/types
 */

import type { LucideIcon } from 'lucide-react';
import type {
  AIConfig,
  AIModelInfo,
  SamplerSettings,
  PromptSettings,
  PromptModelBinding,
  PromptModelMap,
  CharacterSection,
} from '../../db/characterTypes';
import type { ModelProvider } from '../../services/providers';

export type SettingsTabId = 'ai' | 'sampler' | 'prompts' | 'studio' | 'sections';

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning';
  message: string;
}

/** Draft state edited in the panel; persisted on Save. */
export interface SettingsDraft {
  ai: AIConfig;
  sampler: SamplerSettings;
  prompts: PromptSettings;
  promptModels: PromptModelMap;
  agentModel: PromptModelBinding | undefined;
  showLuckyVortex: boolean;
  markdownImageOpenLinks: boolean;
  spellcheckEnabled: boolean;
  spellcheckLanguage: string;
  sectionOrder: CharacterSection[];
  hiddenSections: CharacterSection[];
}

export interface CharacterSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  reloadSettings?: () => Promise<void>;
}

/** Shared helpers (model fetch, OAuth, clear). AI tab uses most; Prompts uses catalog. */
export interface SettingsPanelHelpers {
  selectedBaseUrlPreset: string;
  isFetchingModels: boolean;
  isFetchingModelsForCurrentUrl: boolean;
  modelProviders: ModelProvider[];
  isFetchingProviders: boolean;
  supportsProviderSelection: boolean;
  isSigningIn: boolean;
  showClearConfirm: boolean;
  setShowClearConfirm: (show: boolean) => void;
  isClearing: boolean;
  fetchModels: (options?: { subscriptionOnly?: boolean }) => Promise<void>;
  /** Cached model lists keyed by normalized base URL (Prompts tab routing). */
  modelsByBaseUrl: Record<string, AIModelInfo[]>;
  isFetchingModelsForUrl: (baseUrl: string) => boolean;
  fetchModelsForUrl: (baseUrl: string) => Promise<void>;
  handleBaseUrlChange: (baseUrl: string, loadStoredProfile: boolean) => void;
  handleCustomUrlChange: (baseUrl: string) => void;
  handleApiKeyChange: (apiKey: string) => void;
  handleModelChange: (modelId: string) => void;
  handleProviderChange: (providerId: string) => void;
  handleClearAISettings: () => Promise<void>;
  startSignIn: () => void;
}

export interface SettingsTabProps {
  draft: SettingsDraft;
  setDraft: React.Dispatch<React.SetStateAction<SettingsDraft>>;
  helpers?: SettingsPanelHelpers;
}

export interface SettingsTabModule {
  id: SettingsTabId;
  label: string;
  icon: LucideIcon;
  /** Optional visibility gate (default: always visible). */
  isVisible?: (ctx: { source?: 'workspace' | 'studio' }) => boolean;
  Component: React.ComponentType<SettingsTabProps>;
}

export type AddToast = (type: ToastNotification['type'], message: string) => void;
