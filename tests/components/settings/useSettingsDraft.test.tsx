// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useSettingsDraft,
  validateAgentModel,
  validatePromptModels,
} from '../../../src/components/settings/hooks/useSettingsDraft';
import {
  DEFAULT_CHARACTER_VAULT_SETTINGS,
  type CharacterVaultSettings,
} from '../../../src/db/characterTypes';
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

    it('loads agent edits off by default and saves the toggle', async () => {
      const hook = await loaded();
      expect(hook.result.current.draft.agentKeepEdits).toBe(false);
      act(() => hook.result.current.setDraft((prev) => ({ ...prev, agentKeepEdits: true })));
      expect(hook.result.current.isDirty).toBe(true);
      await act(async () => {
        await hook.result.current.save();
      });
      expect(characterSettingsService.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ ui: expect.objectContaining({ agentKeepEdits: true }) }),
      );
    });

    it('loads a stored agentKeepEdits=true', async () => {
      mockStorage();
      vi.mocked(characterSettingsService.getSettings).mockResolvedValue({
        ...DEFAULT_CHARACTER_VAULT_SETTINGS,
        id: 'app-settings',
        ui: { ...DEFAULT_CHARACTER_VAULT_SETTINGS.ui, agentKeepEdits: true },
      });
      const { hook } = setup();
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
      expect(hook.result.current.draft.agentKeepEdits).toBe(true);
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

describe('editor font size on save', () => {
  async function loadedAt(size: number) {
    const stored = (editorFontSize: number): CharacterVaultSettings => ({
      ...DEFAULT_CHARACTER_VAULT_SETTINGS,
      id: 'app-settings',
      ui: { ...DEFAULT_CHARACTER_VAULT_SETTINGS.ui, editorFontSize },
    });
    const getSettings = vi.spyOn(characterSettingsService, 'getSettings').mockResolvedValue(stored(size));
    vi.spyOn(characterSettingsService, 'saveAllAISettings').mockResolvedValue();
    vi.spyOn(characterSettingsService, 'saveRoleplayHighlight').mockResolvedValue();
    vi.spyOn(characterSettingsService, 'saveMacroHighlight').mockResolvedValue();
    vi.spyOn(characterSettingsService, 'saveSpellcheckSettings').mockResolvedValue();
    const saveSettings = vi.spyOn(characterSettingsService, 'saveSettings').mockResolvedValue();
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    return { hook, saveSettings, changeStored: (n: number) => getSettings.mockResolvedValue(stored(n)) };
  }

  it('keeps a size the editor changed while the panel was open', async () => {
    const { hook, saveSettings, changeStored } = await loadedAt(16);
    changeStored(18);
    await act(async () => {
      await hook.result.current.save();
    });
    expect(saveSettings.mock.calls[0][0].ui.editorFontSize).toBe(18);
  });

  it('writes a size changed in the draft, such as from a backup', async () => {
    const { hook, saveSettings, changeStored } = await loadedAt(16);
    changeStored(18);
    act(() => hook.result.current.setDraft((prev) => ({ ...prev, editorFontSize: 20 })));
    await act(async () => {
      await hook.result.current.save();
    });
    expect(saveSettings.mock.calls[0][0].ui.editorFontSize).toBe(20);
  });
});
