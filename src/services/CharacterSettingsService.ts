/**
 * @fileoverview Settings Service for managing AI and application settings for CharacterVault.
 * @module @services/CharacterSettingsService
 */

import type { CharacterVaultSettings } from '../db/characterTypes';
import type { AIConfig, SamplerSettings, PromptSettings } from '../db/types';
import { DEFAULT_SETTINGS } from '../db/types';
import { DEFAULT_CHARACTER_VAULT_SETTINGS } from '../db/characterTypes';
import { characterDb } from '../db/CharacterDatabase';
import type { CharacterSection } from '../db/characterTypes';

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
          theme: 'system',
          editorFontSize: 16,
          sidebarWidth: 280,
        },
        version: 1,
      };
      await characterDb.settings.add(defaultSettings);
      return defaultSettings;
    }
    
    return settings;
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
    // Merge with defaults to ensure all properties exist
    return {
      ...DEFAULT_SETTINGS.ai,
      ...settings.ai,
    };
  }

  /**
   * Save AI configuration
   */
  async saveAISettings(aiConfig: AIConfig): Promise<void> {
    const settings = await this.getSettings();
    
    const updatedSettings: CharacterVaultSettings = {
      ...settings,
      ai: {
        ...DEFAULT_SETTINGS.ai,
        ...aiConfig,
      },
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
   * Save all AI-related settings at once (avoids race conditions)
   */
  async saveAllAISettings(
    aiConfig: AIConfig,
    sampler: SamplerSettings,
    prompts: PromptSettings
  ): Promise<void> {
    const settings = await this.getSettings();
    
    const updatedSettings: CharacterVaultSettings = {
      ...settings,
      ai: {
        ...DEFAULT_SETTINGS.ai,
        ...aiConfig,
      },
      sampler: {
        ...DEFAULT_SETTINGS.sampler,
        ...sampler,
      },
      prompts: {
        ...DEFAULT_SETTINGS.prompts,
        ...prompts,
      },
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
      contextSectionIds: [],
    };
    
    await characterDb.settings.put(defaultSettings);
    return defaultSettings;
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
    };
    
    await characterDb.settings.put(updatedSettings);
  }
}

/**
 * Singleton instance of the character settings service
 */
export const characterSettingsService = new CharacterSettingsService();
