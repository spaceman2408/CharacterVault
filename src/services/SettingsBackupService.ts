import type {
  AIConfig,
  CharacterSection,
  CharacterVaultSettings,
  DefaultChatPanel,
  PromptModelBinding,
  PromptModelMap,
  PromptSettings,
  SamplerSettings,
  StudioSettings,
} from '../db/characterTypes';
import {
  CHARACTER_SECTIONS,
  DEFAULT_CHARACTER_VAULT_SETTINGS,
  DEFAULT_SECTION_ORDER,
  DEFAULT_SETTINGS,
  DEFAULT_SPELLCHECK_SETTINGS,
  clampContextLength,
  normalizeDefaultChatPanel,
  normalizeStudioSettings,
} from '../db/characterTypes';
import { persistableAIConfig } from './CharacterSettingsService';
import { normalizeModelBinding, normalizePromptModelMap } from './resolveOperationConfig';

export const SETTINGS_BACKUP_KIND = 'charactervault-settings';
export const SETTINGS_BACKUP_VERSION = 1;

export interface SettingsBackupData {
  ai: AIConfig;
  sampler: SamplerSettings;
  prompts: PromptSettings;
  promptModels: PromptModelMap;
  agentModel: PromptModelBinding | null;
  studio: StudioSettings;
  ui: CharacterVaultSettings['ui'];
  sectionOrder: CharacterSection[];
  hiddenSections: CharacterSection[];
  contextSectionIds: CharacterSection[];
}

export interface SettingsBackupFile {
  kind: typeof SETTINGS_BACKUP_KIND;
  version: typeof SETTINGS_BACKUP_VERSION;
  exportedAt: string;
  includeKeys: boolean;
  settings: SettingsBackupData;
}

const VALID_SECTIONS = new Set<string>(CHARACTER_SECTIONS.map((s) => s.id));
const VALID_REASONING_EFFORTS = new Set(['minimal', 'low', 'medium', 'high', 'xhigh', 'max']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function asWordList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const word = entry.trim().toLowerCase();
    if (word) seen.add(word);
  }
  return [...seen];
}

function normalizeSectionList(value: unknown): CharacterSection[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: CharacterSection[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !VALID_SECTIONS.has(entry) || seen.has(entry)) continue;
    seen.add(entry);
    out.push(entry as CharacterSection);
  }
  return out;
}

function normalizeSectionOrder(value: unknown): CharacterSection[] {
  const kept = normalizeSectionList(value);
  const missing = DEFAULT_SECTION_ORDER.filter((id) => !kept.includes(id));
  return [...kept, ...missing];
}

function normalizeBackupAI(value: unknown): AIConfig {
  const raw = isRecord(value) ? value : {};
  const base: AIConfig = {
    ...DEFAULT_SETTINGS.ai,
    baseUrl: asString(raw.baseUrl, DEFAULT_SETTINGS.ai.baseUrl),
    apiKey: asString(raw.apiKey, ''),
    apiKeysByBaseUrl: asStringMap(raw.apiKeysByBaseUrl),
    modelId: asString(raw.modelId, ''),
    modelIdsByBaseUrl: asStringMap(raw.modelIdsByBaseUrl),
    availableModels: [],
    enableStreaming: asBoolean(raw.enableStreaming, DEFAULT_SETTINGS.ai.enableStreaming),
    enableReasoning: asBoolean(raw.enableReasoning, DEFAULT_SETTINGS.ai.enableReasoning),
    showReasoning: asBoolean(raw.showReasoning, DEFAULT_SETTINGS.ai.showReasoning),
    reasoningEffort:
      typeof raw.reasoningEffort === 'string' && VALID_REASONING_EFFORTS.has(raw.reasoningEffort)
        ? (raw.reasoningEffort as AIConfig['reasoningEffort'])
        : DEFAULT_SETTINGS.ai.reasoningEffort,
    lastCustomBaseUrl: asString(raw.lastCustomBaseUrl, ''),
    selectedProvider: typeof raw.selectedProvider === 'string' ? raw.selectedProvider : undefined,
    providerByModelId: asStringMap(raw.providerByModelId),
    subscriptionModelsOnly: asBoolean(
      raw.subscriptionModelsOnly,
      DEFAULT_SETTINGS.ai.subscriptionModelsOnly ?? false
    ),
    billingMode: raw.billingMode === 'paygo' ? 'paygo' : 'sub',
    enableCacheProviderRouting: asBoolean(
      raw.enableCacheProviderRouting,
      DEFAULT_SETTINGS.ai.enableCacheProviderRouting ?? false
    ),
  };
  return persistableAIConfig(base);
}

function normalizeBackupSampler(value: unknown): SamplerSettings {
  const raw = isRecord(value) ? value : {};
  const d = DEFAULT_SETTINGS.sampler;
  return {
    temperature: asNumber(raw.temperature, d.temperature),
    minP: asNumber(raw.minP, d.minP),
    topK: asNumber(raw.topK, d.topK),
    repetitionPenalty: asNumber(raw.repetitionPenalty, d.repetitionPenalty),
    topP: asNumber(raw.topP, d.topP),
    contextLength: clampContextLength(asNumber(raw.contextLength, d.contextLength)),
    maxTokens: Math.min(asNumber(raw.maxTokens, d.maxTokens), 8192),
  };
}

function normalizeBackupPrompts(value: unknown): PromptSettings {
  const raw = isRecord(value) ? value : {};
  const d = DEFAULT_SETTINGS.prompts;
  return {
    expand: asString(raw.expand, d.expand),
    rewrite: asString(raw.rewrite, d.rewrite),
    instruct: asString(raw.instruct, d.instruct),
    shorten: asString(raw.shorten, d.shorten),
    lengthen: asString(raw.lengthen, d.lengthen),
    vivid: asString(raw.vivid, d.vivid),
    emotion: asString(raw.emotion, d.emotion),
    grammar: asString(raw.grammar, d.grammar),
  };
}

function normalizeBackupUi(value: unknown): CharacterVaultSettings['ui'] {
  const raw = isRecord(value) ? value : {};
  const defaults = DEFAULT_CHARACTER_VAULT_SETTINGS.ui;
  const spellRaw = isRecord(raw.spellcheck) ? raw.spellcheck : {};
  const theme = raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system' ? raw.theme : defaults.theme;
  return {
    theme,
    editorFontSize: asNumber(raw.editorFontSize, defaults.editorFontSize),
    sidebarWidth: asNumber(raw.sidebarWidth, defaults.sidebarWidth),
    showLuckyVortex: asBoolean(raw.showLuckyVortex, true),
    markdownImageOpenLinks: asBoolean(raw.markdownImageOpenLinks, true),
    defaultChatPanel: normalizeDefaultChatPanel(raw.defaultChatPanel),
    requireAgentReview: asBoolean(raw.requireAgentReview, false),
    spellcheck: {
      enabled: asBoolean(spellRaw.enabled, DEFAULT_SPELLCHECK_SETTINGS.enabled),
      language: asString(spellRaw.language, DEFAULT_SPELLCHECK_SETTINGS.language) || 'en',
      ignoredWords: asWordList(spellRaw.ignoredWords),
      customWords: asWordList(spellRaw.customWords),
    },
  };
}

export function normalizeBackupData(value: unknown): SettingsBackupData {
  const raw = isRecord(value) ? value : {};
  return {
    ai: normalizeBackupAI(raw.ai),
    sampler: normalizeBackupSampler(raw.sampler),
    prompts: normalizeBackupPrompts(raw.prompts),
    promptModels: normalizePromptModelMap(
      isRecord(raw.promptModels) ? (raw.promptModels as PromptModelMap) : undefined
    ),
    agentModel: normalizeModelBinding(
      isRecord(raw.agentModel) ? (raw.agentModel as unknown as PromptModelBinding) : undefined
    ) ?? null,
    studio: normalizeStudioSettings(isRecord(raw.studio) ? raw.studio : undefined),
    ui: normalizeBackupUi(raw.ui),
    sectionOrder: normalizeSectionOrder(raw.sectionOrder),
    hiddenSections: normalizeSectionList(raw.hiddenSections),
    contextSectionIds: normalizeSectionList(raw.contextSectionIds),
  };
}

export function buildSettingsBackup(
  saved: CharacterVaultSettings,
  includeKeys: boolean
): SettingsBackupFile {
  const ai = persistableAIConfig(saved.ai ?? DEFAULT_SETTINGS.ai);
  const data = normalizeBackupData({
    ai: includeKeys
      ? ai
      : { ...ai, apiKey: '', apiKeysByBaseUrl: {} },
    sampler: saved.sampler,
    prompts: saved.prompts,
    promptModels: saved.promptModels,
    agentModel: saved.agentModel,
    studio: saved.studio,
    ui: saved.ui,
    sectionOrder: saved.sectionOrder,
    hiddenSections: saved.hiddenSections,
    contextSectionIds: saved.contextSectionIds,
  });
  data.ai.availableModels = [];
  return {
    kind: SETTINGS_BACKUP_KIND,
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    includeKeys,
    settings: data,
  };
}

export function parseSettingsBackup(input: unknown): SettingsBackupFile {
  if (!isRecord(input)) throw new Error('That file is not a CharacterVault settings backup.');
  if (input.kind !== SETTINGS_BACKUP_KIND) {
    throw new Error('That file is not a CharacterVault settings backup.');
  }
  if (input.version !== SETTINGS_BACKUP_VERSION) {
    throw new Error(`Unsupported backup version (${String(input.version)}). Expected version 1.`);
  }
  if (!isRecord(input.settings)) throw new Error('Backup is missing its settings payload.');
  return {
    kind: SETTINGS_BACKUP_KIND,
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: asString(input.exportedAt, new Date().toISOString()),
    includeKeys: asBoolean(input.includeKeys, false),
    settings: normalizeBackupData(input.settings),
  };
}

export function buildBackupFilename(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  return `charactervault-settings-${stamp}.json`;
}

export function downloadSettingsBackup(file: SettingsBackupFile, filename: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export interface BackupDraftTarget {
  ai: AIConfig;
  sampler: SamplerSettings;
  prompts: PromptSettings;
  promptModels: PromptModelMap;
  agentModel: PromptModelBinding | undefined;
  showLuckyVortex: boolean;
  markdownImageOpenLinks: boolean;
  defaultChatPanel: DefaultChatPanel;
  requireAgentReview: boolean;
  spellcheckEnabled: boolean;
  spellcheckLanguage: string;
  spellcheckIgnoredWords: string[];
  spellcheckCustomWords: string[];
  sectionOrder: CharacterSection[];
  hiddenSections: CharacterSection[];
  contextSectionIds: CharacterSection[];
  studio: StudioSettings;
}

export function applyBackupToDraft<T extends BackupDraftTarget>(
  prev: T,
  backup: SettingsBackupFile
): T {
  const { settings, includeKeys } = backup;
  const spellcheck = settings.ui.spellcheck ?? { ...DEFAULT_SPELLCHECK_SETTINGS };
  return {
    ...prev,
    ai: {
      ...settings.ai,
      availableModels: prev.ai.availableModels,
      ...(!includeKeys
        ? { apiKey: prev.ai.apiKey, apiKeysByBaseUrl: prev.ai.apiKeysByBaseUrl }
        : {}),
    },
    sampler: { ...settings.sampler },
    prompts: { ...settings.prompts },
    promptModels: { ...settings.promptModels },
    agentModel: settings.agentModel ?? undefined,
    showLuckyVortex: settings.ui.showLuckyVortex ?? true,
    markdownImageOpenLinks: settings.ui.markdownImageOpenLinks ?? true,
    defaultChatPanel: normalizeDefaultChatPanel(settings.ui.defaultChatPanel),
    requireAgentReview: settings.ui.requireAgentReview ?? false,
    spellcheckEnabled: spellcheck.enabled,
    spellcheckLanguage: spellcheck.language,
    spellcheckIgnoredWords: [...spellcheck.ignoredWords],
    spellcheckCustomWords: [...spellcheck.customWords],
    sectionOrder: [...settings.sectionOrder],
    hiddenSections: [...settings.hiddenSections],
    contextSectionIds: [...settings.contextSectionIds],
    studio: {
      enabledFields: { ...settings.studio.enabledFields },
      prompts: { ...settings.studio.prompts },
      tags: {
        hideNsfw: settings.studio.tags.hideNsfw,
        hiddenCategories: [...settings.studio.tags.hiddenCategories],
        customTags: { ...settings.studio.tags.customTags },
      },
    },
  };
}
