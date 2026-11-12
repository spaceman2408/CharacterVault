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
  DEFAULT_SETTINGS,
  type CharacterVaultSettings,
} from '../../../src/db/characterTypes';
import { characterSettingsService } from '../../../src/services/CharacterSettingsService';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function setup(panel: HTMLElement | null = null) {
  const addToast = vi.fn();
  const reloadSettings = vi.fn(async () => {});
  const panelRef = { current: panel };
  const hook = renderHook(() => useSettingsDraft({ isOpen: true, reloadSettings, addToast, panelRef }));
  return { hook, addToast, reloadSettings };
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
      await hook.result.current.flush();
    });
    expect(saveAll).not.toHaveBeenCalled();

    getSettings.mockResolvedValue({ ...DEFAULT_CHARACTER_VAULT_SETTINGS, id: 'app-settings' });
    act(() => hook.result.current.retryLoad());
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(hook.result.current.loadFailed).toBe(false);
  });

  it('keeps saved presets but drops keys when AI settings are cleared', async () => {
    const MINE = 'https://my.host/v1';
    vi.spyOn(characterSettingsService, 'getSettings').mockResolvedValue({
      ...DEFAULT_CHARACTER_VAULT_SETTINGS,
      id: 'app-settings',
    });
    vi.spyOn(characterSettingsService, 'getAISettings').mockResolvedValue({
      ...DEFAULT_SETTINGS.ai,
      baseUrl: MINE,
      apiKey: 'sk-mine',
      apiKeysByBaseUrl: { [MINE]: 'sk-mine' },
      customBaseUrlPresets: [{ label: 'Mine', baseUrl: MINE }],
    });
    vi.spyOn(characterSettingsService, 'clearAISettings').mockResolvedValue();

    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    await act(async () => {
      await hook.result.current.clearAISettings();
    });

    const { ai } = hook.result.current.draft;
    expect(ai.customBaseUrlPresets).toEqual([{ label: 'Mine', baseUrl: MINE }]);
    expect(ai.apiKey).toBe('');
    expect(ai.apiKeysByBaseUrl).toEqual({});
    expect(ai.baseUrl).toBe(DEFAULT_SETTINGS.ai.baseUrl);
    expect(hook.result.current.isDirty).toBe(false);
  });

  it('keeps the URL’s own model when a saved preset’s pinned model is active', async () => {
    const OPENROUTER = 'https://openrouter.ai/api/v1';
    vi.spyOn(characterSettingsService, 'getSettings').mockResolvedValue({
      ...DEFAULT_CHARACTER_VAULT_SETTINGS,
      id: 'app-settings',
    });
    vi.spyOn(characterSettingsService, 'getAISettings').mockResolvedValue({
      ...DEFAULT_SETTINGS.ai,
      baseUrl: OPENROUTER,
      modelId: 'kimi',
      modelIdsByBaseUrl: { [OPENROUTER]: 'deepseek' },
      customBaseUrlPresets: [{ label: 'Kimi', baseUrl: OPENROUTER, modelId: 'kimi' }],
    });
    const saveAll = vi.spyOn(characterSettingsService, 'saveAllAISettings').mockResolvedValue();
    vi.spyOn(characterSettingsService, 'saveRoleplayHighlight').mockResolvedValue();
    vi.spyOn(characterSettingsService, 'saveMacroHighlight').mockResolvedValue();
    vi.spyOn(characterSettingsService, 'saveSettings').mockResolvedValue();
    vi.spyOn(characterSettingsService, 'saveSpellcheckSettings').mockResolvedValue();

    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(hook.result.current.draft.ai.modelIdsByBaseUrl).toEqual({ [OPENROUTER]: 'deepseek' });

    act(() => hook.result.current.setDraft((prev) => ({ ...prev, showLuckyVortex: !prev.showLuckyVortex })));
    await act(async () => {
      await hook.result.current.flush();
    });
    expect(saveAll.mock.calls[0]?.[0].modelIdsByBaseUrl).toEqual({ [OPENROUTER]: 'deepseek' });
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
        await hook.result.current.flush();
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
        await hook.result.current.flush();
      });
      expect(hook.result.current.isDirty).toBe(false);
    });
  });

  describe('autosave', () => {
    function mockStorage() {
      vi.spyOn(characterSettingsService, 'getSettings').mockResolvedValue({
        ...DEFAULT_CHARACTER_VAULT_SETTINGS,
        id: 'app-settings',
      });
      vi.spyOn(characterSettingsService, 'saveRoleplayHighlight').mockResolvedValue();
      vi.spyOn(characterSettingsService, 'saveMacroHighlight').mockResolvedValue();
      vi.spyOn(characterSettingsService, 'saveSettings').mockResolvedValue();
      vi.spyOn(characterSettingsService, 'saveSpellcheckSettings').mockResolvedValue();
      return vi.spyOn(characterSettingsService, 'saveAllAISettings').mockResolvedValue();
    }

    it('saves an edit on its own after a short delay', async () => {
      const saveAll = mockStorage();
      const { hook, reloadSettings } = setup();
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
      act(() => hook.result.current.setDraft((prev) => ({ ...prev, showLuckyVortex: !prev.showLuckyVortex })));
      expect(saveAll).not.toHaveBeenCalled();
      await waitFor(() => expect(hook.result.current.isDirty).toBe(false), { timeout: 2000 });
      expect(saveAll).toHaveBeenCalledTimes(1);
      expect(reloadSettings).toHaveBeenCalledTimes(1);
      expect(hook.result.current.lastSavedAt).not.toBeNull();
    });

    it('holds an invalid draft back and says why, without a toast', async () => {
      const saveAll = mockStorage();
      const { hook, addToast } = setup();
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
      act(() =>
        hook.result.current.setDraft((prev) => ({ ...prev, prompts: { ...prev.prompts, expand: 'no variable' } }))
      );
      await act(async () => {
        await hook.result.current.flush();
      });
      expect(saveAll).not.toHaveBeenCalled();
      expect(hook.result.current.saveError).toContain('Expand prompt must contain ${text}');
      expect(addToast).not.toHaveBeenCalled();

      act(() =>
        hook.result.current.setDraft((prev) => ({ ...prev, prompts: { ...prev.prompts, expand: 'still typing' } }))
      );
      expect(hook.result.current.saveError).toBeNull();

      act(() =>
        hook.result.current.setDraft((prev) => ({ ...prev, prompts: { ...prev.prompts, expand: 'fixed ${text}' } }))
      );
      await act(async () => {
        await hook.result.current.flush();
      });
      expect(saveAll).toHaveBeenCalledTimes(1);
      expect(hook.result.current.saveError).toBeNull();
    });

    it('never overlaps saves and skips ones that have nothing new', async () => {
      const saveAll = mockStorage();
      const { hook } = setup();
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
      act(() => hook.result.current.setDraft((prev) => ({ ...prev, showLuckyVortex: !prev.showLuckyVortex })));
      await act(async () => {
        await Promise.all([hook.result.current.flush(), hook.result.current.flush()]);
      });
      expect(saveAll).toHaveBeenCalledTimes(1);
    });

    it('waits for a focused prompt to lose focus', async () => {
      const saveAll = mockStorage();
      const panel = document.createElement('div');
      const textarea = document.createElement('textarea');
      panel.appendChild(textarea);
      document.body.appendChild(panel);
      const { hook } = setup(panel);
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

      act(() => textarea.focus());
      expect(hook.result.current.isEditingText).toBe(true);
      vi.useFakeTimers();
      act(() =>
        hook.result.current.setDraft((prev) => ({ ...prev, prompts: { ...prev.prompts, expand: 'half typed' } }))
      );
      act(() => vi.advanceTimersByTime(2000));
      vi.useRealTimers();
      expect(saveAll).not.toHaveBeenCalled();
      expect(hook.result.current.saveError).toBeNull();

      act(() =>
        hook.result.current.setDraft((prev) => ({ ...prev, prompts: { ...prev.prompts, expand: 'done ${text}' } }))
      );
      act(() => textarea.blur());
      expect(hook.result.current.isEditingText).toBe(false);
      await waitFor(() => expect(saveAll).toHaveBeenCalledTimes(1));
      expect(saveAll.mock.calls[0][2].expand).toBe('done ${text}');
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
    act(() => hook.result.current.setDraft((prev) => ({ ...prev, showLuckyVortex: !prev.showLuckyVortex })));
    await act(async () => {
      await hook.result.current.flush();
    });
    expect(saveSettings.mock.calls[0][0].ui.editorFontSize).toBe(18);
  });

  it('writes a size changed in the draft, such as from a backup', async () => {
    const { hook, saveSettings, changeStored } = await loadedAt(16);
    changeStored(18);
    act(() => hook.result.current.setDraft((prev) => ({ ...prev, editorFontSize: 20 })));
    await act(async () => {
      await hook.result.current.flush();
    });
    expect(saveSettings.mock.calls[0][0].ui.editorFontSize).toBe(20);
  });
});
