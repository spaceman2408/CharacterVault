/**
 * @fileoverview Settings Service for managing AI and application settings for CharacterVault.
 * @module @services/CharacterSettingsService
 */

import type { CharacterVaultSettings } from '../db/characterTypes';
import type {
  AIConfig,
  SamplerSettings,
  PromptSettings,
  PromptModelBinding,
  PromptModelMap,
  SpellcheckSettings,
} from '../db/characterTypes';
import { DEFAULT_SETTINGS } from '../db/characterTypes';
import {
  DEFAULT_CHARACTER_VAULT_SETTINGS,
  DEFAULT_MARKDOWN_IMAGE_OPEN_LINKS,
  DEFAULT_SECTION_ORDER,
  DEFAULT_SPELLCHECK_SETTINGS,
} from '../db/characterTypes';
import { characterDb } from '../db/CharacterDatabase';
import type { CharacterSection } from '../db/characterTypes';
import { normalizeModelBinding, normalizePromptModelMap } from './resolveOperationConfig';

/** Drop ephemeral UI-only fields so model catalogs never land in IndexedDB. */
export function persistableAIConfig(aiConfig: AIConfig): AIConfig {
  return {
    ...DEFAULT_SETTINGS.ai,
    ...aiConfig,
    availableModels: [],
  };
}

/**
 * Settings Service class for managing application settings in CharacterVault
 */
export class CharacterSettingsService {
  /**
   * Get all settings
   */
  async getSettings(): Promise<CharacterVaultSettings> {
    const settings = await characterDb.getSettings();

    if (!settings) {
      // Create default settings if none exist
      const defaultSettings: CharacterVaultSettings = {
        id: 'app-settings',
        ui: {
          ...DEFAULT_CHARACTER_VAULT_SETTINGS.ui,
        },
        version: 1,
      };
      await characterDb.settings.add(defaultSettings);
      return defaultSettings;
    }

    // Backfill spellcheck defaults for existing users
    if (!settings.ui?.spellcheck) {
      settings.ui.spellcheck = { ...DEFAULT_SPELLCHECK_SETTINGS };
      await characterDb.settings.put(settings);
    }

    // Backfill Markdown image open-link control default
    if (settings.ui?.markdownImageOpenLinks === undefined) {
      settings.ui.markdownImageOpenLinks = DEFAULT_MARKDOWN_IMAGE_OPEN_LINKS;
      await characterDb.settings.put(settings);
    }

    return settings;
  }

  /** Whether Markdown image links open on click in editors. */
  async getMarkdownImageOpenLinks(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.ui.markdownImageOpenLinks ?? DEFAULT_MARKDOWN_IMAGE_OPEN_LINKS;
  }

  /** Persist the Markdown image click-to-open Studio preference. */
  async saveMarkdownImageOpenLinks(enabled: boolean): Promise<void> {
    const settings = await this.getSettings();
    await characterDb.settings.put({
      ...settings,
      ui: {
        ...settings.ui,
        markdownImageOpenLinks: enabled,
      },
    });
  }

  /**
   * Get spellcheck settings, merging with defaults so all fields exist.
   */
  async getSpellcheckSettings(): Promise<SpellcheckSettings> {
    const settings = await this.getSettings();
    return {
      ...DEFAULT_SPELLCHECK_SETTINGS,
      ...(settings.ui.spellcheck ?? {}),
    };
  }

  /**
   * Persist spellcheck settings (merging with existing values).
   */
  async saveSpellcheckSettings(updates: Partial<SpellcheckSettings>): Promise<void> {
    const settings = await this.getSettings();
    const current = settings.ui.spellcheck ?? { ...DEFAULT_SPELLCHECK_SETTINGS };
    const next: SpellcheckSettings = {
      ...DEFAULT_SPELLCHECK_SETTINGS,
      ...current,
      ...updates,
      ignoredWords: updates.ignoredWords ?? current.ignoredWords ?? [],
      customWords: updates.customWords ?? current.customWords ?? [],
    };
    await characterDb.settings.put({
      ...settings,
      ui: {
        ...settings.ui,
        spellcheck: next,
      },
    });
  }

  /**
   * Add a word to the user's ignore list (lowercased, deduped).
   */
  async addIgnoredWord(word: string): Promise<void> {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) return;
    const current = await this.getSpellcheckSettings();
    if (current.ignoredWords.includes(trimmed)) return;
    await this.saveSpellcheckSettings({
      ignoredWords: [...current.ignoredWords, trimmed],
    });
  }

  /**
   * Add a word to the personal dictionary (lowercased, deduped).
   */
  async addCustomWord(word: string): Promise<void> {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) return;
    const current = await this.getSpellcheckSettings();
    if (current.customWords.includes(trimmed)) return;
    await this.saveSpellcheckSettings({
      customWords: [...current.customWords, trimmed],
    });
  }

  /**
   * Save all settings
   */
  async saveSettings(settings: CharacterVaultSettings): Promise<void> {
    await characterDb.settings.put(settings);
  }

  /**
   * Get AI configuration
   */
  async getAISettings(): Promise<AIConfig> {
    const settings = await this.getSettings();
    return persistableAIConfig(settings.ai ?? DEFAULT_SETTINGS.ai);
  }

  /**
   * Save AI configuration
   */
  async saveAISettings(aiConfig: AIConfig): Promise<void> {
    const settings = await this.getSettings();
    
    const updatedSettings: CharacterVaultSettings = {
      ...settings,
      ai: persistableAIConfig(aiConfig),
    };
    
    await characterDb.settings.put(updatedSettings);
  }

  /**
   * Get current sampler settings
   */
  async getSamplerSettings(): Promise<SamplerSettings> {
    const settings = await this.getSettings();
    // Merge with defaults to ensure all properties exist
    return {
      ...DEFAULT_SETTINGS.sampler,
      ...settings.sampler,
    };
  }

  /**
   * Save sampler settings
   */
  async saveSamplerSettings(sampler: SamplerSettings): Promise<void> {
    const settings = await this.getSettings();
    
    const updatedSettings: CharacterVaultSettings = {
      ...settings,
      sampler: {
        ...DEFAULT_SETTINGS.sampler,
        ...sampler,
      },
    };
    
    await characterDb.settings.put(updatedSettings);
  }

  /**
   * Get context panel section IDs (for AI context)
   */
  async getContextSectionIds(): Promise<CharacterSection[]> {
    const settings = await this.getSettings();
    return settings.contextSectionIds || [];
  }

  /**
   * Save context panel section IDs
   */
  async saveContextSectionIds(sectionIds: CharacterSection[]): Promise<void> {
    const settings = await this.getSettings();
    
    const updatedSettings: CharacterVaultSettings = {
      ...settings,
      contextSectionIds: sectionIds,
    };
    
    await characterDb.settings.put(updatedSettings);
  }

  /**
   * Add a section to the context panel
   */
  async addContextSection(sectionId: CharacterSection): Promise<void> {
    const settings = await this.getSettings();
    const currentIds = settings.contextSectionIds || [];
    
    if (!currentIds.includes(sectionId)) {
      const updatedSettings: CharacterVaultSettings = {
        ...settings,
        contextSectionIds: [...currentIds, sectionId],
      };
      
      await characterDb.settings.put(updatedSettings);
    }
  }

  /**
   * Remove a section from the context panel
   */
  async removeContextSection(sectionId: CharacterSection): Promise<void> {
    const settings = await this.getSettings();
    const currentIds = settings.contextSectionIds || [];
    
    const updatedSettings: CharacterVaultSettings = {
      ...settings,
      contextSectionIds: currentIds.filter(id => id !== sectionId),
    };
    
    await characterDb.settings.put(updatedSettings);
  }

  /**
   * Get AI prompt settings
   */
  async getPromptSettings(): Promise<PromptSettings> {
    const settings = await this.getSettings();
    // Merge with defaults to ensure all properties exist
    return {
      ...DEFAULT_SETTINGS.prompts,
      ...settings.prompts,
    };
  }

  /**
   * Get per-operation model routing map
   */
  async getPromptModels(): Promise<PromptModelMap> {
    const settings = await this.getSettings();
    return normalizePromptModelMap(settings.promptModels);
  }

  async getAgentModel(): Promise<PromptModelBinding | undefined> {
    const settings = await this.getSettings();
    return normalizeModelBinding(settings.agentModel);
  }

  /**
   * Save AI prompt settings
   */
  async savePromptSettings(prompts: PromptSettings): Promise<void> {
    const settings = await this.getSettings();
    
    const updatedSettings: CharacterVaultSettings = {
      ...settings,
      prompts: {
        ...DEFAULT_SETTINGS.prompts,
        ...prompts,
      },
    };
    
    await characterDb.settings.put(updatedSettings);
  }

  /**
   * Save per-operation model routing map
   */
  async savePromptModels(promptModels: PromptModelMap): Promise<void> {
    const settings = await this.getSettings();
    const updatedSettings: CharacterVaultSettings = {
      ...settings,
      promptModels: normalizePromptModelMap(promptModels),
    };
    await characterDb.settings.put(updatedSettings);
  }

  /**
   * Save all AI-related settings at once (avoids race conditions)
   */
  async saveAllAISettings(
    aiConfig: AIConfig,
    sampler: SamplerSettings,
    prompts: PromptSettings,
    promptModels?: PromptModelMap,
    agentModel?: PromptModelBinding | null,
  ): Promise<void> {
    const settings = await this.getSettings();
    
    const updatedSettings: CharacterVaultSettings = {
      ...settings,
      ai: persistableAIConfig(aiConfig),
      sampler: {
        ...DEFAULT_SETTINGS.sampler,
        ...sampler,
      },
      prompts: {
        ...DEFAULT_SETTINGS.prompts,
        ...prompts,
      },
      promptModels:
        promptModels !== undefined
          ? normalizePromptModelMap(promptModels)
          : normalizePromptModelMap(settings.promptModels),
      agentModel:
        agentModel !== undefined
          ? normalizeModelBinding(agentModel)
          : normalizeModelBinding(settings.agentModel),
    };
    
    await characterDb.settings.put(updatedSettings);
  }

  /**
   * Apply a sampler preset by ID
   */
  async applySamplerPreset(presetId: string): Promise<void> {
    const presets = DEFAULT_SETTINGS.samplerPresets;
    const preset = presets.find(p => p.id === presetId);
    
    if (!preset) {
      throw new Error(`Preset with ID "${presetId}" not found`);
    }
    
    await this.saveSamplerSettings(preset.settings);
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(): Promise<CharacterVaultSettings> {
    const defaultSettings: CharacterVaultSettings = {
      ...DEFAULT_CHARACTER_VAULT_SETTINGS,
      id: 'app-settings',
      ai: DEFAULT_SETTINGS.ai,
      sampler: DEFAULT_SETTINGS.sampler,
      prompts: DEFAULT_SETTINGS.prompts,
      promptModels: {},
      contextSectionIds: [],
    };
    
    await characterDb.settings.put(defaultSettings);
    return defaultSettings;
  }

  /**
   * Get section tab order. Falls back to DEFAULT_SECTION_ORDER if not set.
   * Any sections not in the saved list are appended at the end.
   */
  async getSectionOrder(): Promise<CharacterSection[]> {
    const settings = await this.getSettings();
    const saved = settings.sectionOrder;
    if (!saved) return [...DEFAULT_SECTION_ORDER];

    // Append any new sections not in the saved list
    const missing = DEFAULT_SECTION_ORDER.filter(id => !saved.includes(id));
    return [...saved, ...missing];
  }

  /**
   * Save custom section tab order.
   */
  async saveSectionOrder(sectionOrder: CharacterSection[]): Promise<void> {
    const settings = await this.getSettings();
    const updatedSettings: CharacterVaultSettings = {
      ...settings,
      sectionOrder,
    };
    await characterDb.settings.put(updatedSettings);
  }

  /**
   * Get hidden section IDs. Falls back to empty (all visible).
   */
  async getHiddenSections(): Promise<CharacterSection[]> {
    const settings = await this.getSettings();
    return settings.hiddenSections || [];
  }

  /**
   * Save hidden section IDs.
   */
  async saveHiddenSections(hiddenSections: CharacterSection[]): Promise<void> {
    const settings = await this.getSettings();
    const updatedSettings: CharacterVaultSettings = {
      ...settings,
      hiddenSections,
    };
    await characterDb.settings.put(updatedSettings);
  }

  /**
   * Reset section layout (order + hidden) to defaults.
   */
  async resetSectionLayout(): Promise<void> {
    const settings = await this.getSettings();
    const resetSettings: CharacterVaultSettings = { ...settings };
    delete resetSettings.sectionOrder;
    delete resetSettings.hiddenSections;
    await characterDb.settings.put(resetSettings);
  }

  /**
   * Clear only AI-related settings while preserving characters and other data.
   * This removes the API key and other sensitive AI configuration from storage.
   */
  async clearAISettings(): Promise<void> {
    const settings = await this.getSettings();
    
    const updatedSettings: CharacterVaultSettings = {
      ...settings,
      // Reset AI config to defaults (clears apiKey, baseUrl, modelId)
      ai: DEFAULT_SETTINGS.ai,
      // Keep sampler settings as they're not sensitive
      sampler: settings.sampler ?? DEFAULT_SETTINGS.sampler,
      // Keep prompts as they're not sensitive
      prompts: settings.prompts ?? DEFAULT_SETTINGS.prompts,
      // Keep prompt→model routing (not sensitive; keys live under ai)
      promptModels: normalizePromptModelMap(settings.promptModels),
      agentModel: normalizeModelBinding(settings.agentModel),
    };
    
    await characterDb.settings.put(updatedSettings);
  }
}

/**
 * Singleton instance of the character settings service
 */
export const characterSettingsService = new CharacterSettingsService();
