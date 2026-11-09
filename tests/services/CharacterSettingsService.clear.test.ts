import { afterEach, describe, expect, it, vi } from 'vitest';
import { characterDb } from '../../src/db/CharacterDatabase';
import {
  DEFAULT_CHARACTER_VAULT_SETTINGS,
  DEFAULT_SETTINGS,
  type CharacterVaultSettings,
} from '../../src/db/characterTypes';
import { characterSettingsService } from '../../src/services/CharacterSettingsService';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CharacterSettingsService.clearAISettings', () => {
  it('keeps saved base URL presets and clears keys', async () => {
    const MINE = 'https://my.host/v1';
    vi.spyOn(characterSettingsService, 'getSettings').mockResolvedValue({
      ...DEFAULT_CHARACTER_VAULT_SETTINGS,
      id: 'app-settings',
      ai: {
        ...DEFAULT_SETTINGS.ai,
        baseUrl: MINE,
        apiKey: 'sk-mine',
        apiKeysByBaseUrl: { [MINE]: 'sk-mine' },
        customBaseUrlPresets: [{ label: 'Mine', baseUrl: MINE }],
      },
    } as CharacterVaultSettings);
    const put = vi.spyOn(characterDb.settings, 'put').mockResolvedValue('app-settings');

    await characterSettingsService.clearAISettings();

    const { ai } = put.mock.calls[0][0] as CharacterVaultSettings;
    expect(ai?.customBaseUrlPresets).toEqual([{ label: 'Mine', baseUrl: MINE }]);
    expect(ai?.apiKey).toBe('');
    expect(ai?.apiKeysByBaseUrl).toEqual({});
    expect(ai?.baseUrl).toBe(DEFAULT_SETTINGS.ai.baseUrl);
  });
});
