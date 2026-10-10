// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CHARACTER_VAULT_SETTINGS,
  DEFAULT_SETTINGS,
  type CharacterVaultSettings,
} from '../../src/db/characterTypes';
import { characterSettingsService } from '../../src/services/CharacterSettingsService';
import { buildSettingsBackup } from '../../src/services/SettingsBackupService';
import { vaultRestoreService } from '../../src/services/VaultRestoreService';

afterEach(() => {
  vi.restoreAllMocks();
});

function savedSettings(ui: Partial<CharacterVaultSettings['ui']> = {}): CharacterVaultSettings {
  return {
    id: 'app-settings',
    ui: { theme: 'dark', editorFontSize: 16, sidebarWidth: 280, ...ui },
    version: 1,
  };
}

function mockStorage() {
  vi.spyOn(characterSettingsService, 'getAISettings').mockResolvedValue({ ...DEFAULT_SETTINGS.ai });
  vi.spyOn(characterSettingsService, 'saveAllAISettings').mockResolvedValue();
  vi.spyOn(characterSettingsService, 'getSettings').mockResolvedValue({
    ...DEFAULT_CHARACTER_VAULT_SETTINGS,
    id: 'app-settings',
  });
  vi.spyOn(characterSettingsService, 'getSpellcheckSettings').mockResolvedValue({
    enabled: true,
    language: 'en',
    ignoredWords: [],
    customWords: [],
  });
  vi.spyOn(characterSettingsService, 'saveSpellcheckSettings').mockResolvedValue();
  return vi.spyOn(characterSettingsService, 'saveSettings').mockResolvedValue();
}

describe('vaultRestoreService.applySettingsBackup', () => {
  it('restores agentKeepEdits when the backup had it on', async () => {
    const saveSettings = mockStorage();
    await vaultRestoreService.applySettingsBackup(
      buildSettingsBackup(savedSettings({ agentKeepEdits: true }), false),
    );
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ ui: expect.objectContaining({ agentKeepEdits: true }) }),
    );
  });

  it('restores agentKeepEdits off when the backup predates it', async () => {
    const saveSettings = mockStorage();
    await vaultRestoreService.applySettingsBackup(buildSettingsBackup(savedSettings(), false));
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ ui: expect.objectContaining({ agentKeepEdits: false }) }),
    );
  });
});
