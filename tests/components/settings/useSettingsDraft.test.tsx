// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSettingsDraft } from '../../../src/components/settings/hooks/useSettingsDraft';
import { DEFAULT_CHARACTER_VAULT_SETTINGS } from '../../../src/db/characterTypes';
import { characterSettingsService } from '../../../src/services/CharacterSettingsService';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup() {
  const addToast = vi.fn();
  const reloadSettings = vi.fn(async () => {});
  const hook = renderHook(() => useSettingsDraft({ isOpen: true, reloadSettings, addToast }));
  return { hook, addToast };
}

describe('useSettingsDraft', () => {
  it('refuses to save after a failed load, then recovers on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const getSettings = vi
      .spyOn(characterSettingsService, 'getSettings')
      .mockRejectedValue(new Error('db unavailable'));
    const saveAll = vi
      .spyOn(characterSettingsService, 'saveAllAISettings')
      .mockResolvedValue();

    const { hook, addToast } = setup();
    await waitFor(() => expect(hook.result.current.loadFailed).toBe(true));
    expect(addToast).toHaveBeenCalledWith('error', 'Failed to load settings');

    await act(async () => {
      await hook.result.current.save();
    });
    expect(saveAll).not.toHaveBeenCalled();

    getSettings.mockResolvedValue({ ...DEFAULT_CHARACTER_VAULT_SETTINGS, id: 'app-settings' });
    act(() => hook.result.current.retryLoad());
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(hook.result.current.loadFailed).toBe(false);
  });
});
