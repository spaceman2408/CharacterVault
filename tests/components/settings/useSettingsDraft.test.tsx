// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useSettingsDraft,
  validateAgentModel,
  validatePromptModels,
} from '../../../src/components/settings/hooks/useSettingsDraft';
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

  describe('isDirty', () => {
    function mockStorage() {
      vi.spyOn(characterSettingsService, 'getSettings').mockResolvedValue({
        ...DEFAULT_CHARACTER_VAULT_SETTINGS,
        id: 'app-settings',
      });
      vi.spyOn(characterSettingsService, 'saveAllAISettings').mockResolvedValue();
      vi.spyOn(characterSettingsService, 'saveRoleplayHighlight').mockResolvedValue();
      vi.spyOn(characterSettingsService, 'saveMacroHighlight').mockResolvedValue();
      vi.spyOn(characterSettingsService, 'saveSettings').mockResolvedValue();
      vi.spyOn(characterSettingsService, 'saveSpellcheckSettings').mockResolvedValue();
    }

    async function loaded() {
      mockStorage();
      const { hook } = setup();
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
      return hook;
    }

    it('is clean after load and dirty after an edit', async () => {
      const hook = await loaded();
      expect(hook.result.current.isDirty).toBe(false);
      act(() =>
        hook.result.current.setDraft((prev) => ({ ...prev, showLuckyVortex: !prev.showLuckyVortex }))
      );
      expect(hook.result.current.isDirty).toBe(true);
    });

    it('is clean again when an edit is reverted', async () => {
      const hook = await loaded();
      act(() => hook.result.current.setDraft((prev) => ({ ...prev, macroAutoConvert: !prev.macroAutoConvert })));
      act(() => hook.result.current.setDraft((prev) => ({ ...prev, macroAutoConvert: !prev.macroAutoConvert })));
      expect(hook.result.current.isDirty).toBe(false);
    });

    it('ignores fetched model lists', async () => {
      const hook = await loaded();
      act(() =>
        hook.result.current.setDraft((prev) => ({
          ...prev,
          ai: { ...prev.ai, availableModels: [{ id: 'm', name: 'M' }] },
        }))
      );
      expect(hook.result.current.isDirty).toBe(false);
    });

    it('is clean after a successful save', async () => {
      const hook = await loaded();
      act(() =>
        hook.result.current.setDraft((prev) => ({ ...prev, requireAgentReview: !prev.requireAgentReview }))
      );
      await act(async () => {
        await hook.result.current.save();
      });
      expect(hook.result.current.isDirty).toBe(false);
    });
  });
});

describe('model routing validation', () => {
  const toolbar = {
    order: ['instruct', 'custom:pirate'],
    customOps: [{ id: 'custom:pirate', label: 'Pirate', icon: '✨', color: '#0891b2', prompt: 'Yarr ${text}' }],
  };
  const endpoint = 'https://openrouter.ai/api/v1';

  it('names built-in and custom buttons instead of their ids', () => {
    const error = validatePromptModels(
      {
        expand: { baseUrl: endpoint, modelId: '' },
        'custom:pirate': { baseUrl: endpoint, modelId: '' },
      },
      toolbar
    );
    expect(error).toBe(
      'Enhance prompt: choose a model, or set the endpoint back to Default\n' +
        'Pirate prompt: choose a model, or set the endpoint back to Default'
    );
  });

  it('ignores bindings left behind by deleted custom buttons', () => {
    expect(
      validatePromptModels({ 'custom:gone': { baseUrl: endpoint, modelId: '' } }, toolbar)
    ).toBeNull();
  });

  it('names the agent', () => {
    expect(validateAgentModel({ baseUrl: endpoint, modelId: ' ' })).toBe(
      'Agent: choose a model, or set the endpoint back to Default'
    );
  });
});
