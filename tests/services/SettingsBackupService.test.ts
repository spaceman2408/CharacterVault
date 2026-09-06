import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  DEFAULT_STUDIO_SETTINGS,
  type CharacterVaultSettings,
} from '../../src/db/characterTypes';
import {
  applyBackupToDraft,
  buildBackupFilename,
  buildSettingsBackup,
  parseSettingsBackup,
  type BackupDraftTarget,
} from '../../src/services/SettingsBackupService';

function makeSaved(): CharacterVaultSettings {
  return {
    id: 'app-settings',
    ui: {
      theme: 'dark',
      editorFontSize: 16,
      sidebarWidth: 280,
      showLuckyVortex: true,
      spellcheck: { enabled: true, language: 'en', ignoredWords: ['foo'], customWords: [] },
    },
    ai: {
      ...DEFAULT_SETTINGS.ai,
      baseUrl: 'https://example.com/v1',
      apiKey: 'sk-live',
      apiKeysByBaseUrl: { 'https://example.com/v1': 'sk-live' },
      modelId: 'model-a',
      availableModels: [{ id: 'model-a', name: 'A' }],
    },
    sampler: { ...DEFAULT_SETTINGS.sampler },
    prompts: { ...DEFAULT_SETTINGS.prompts },
    promptModels: {},
    studio: { ...DEFAULT_STUDIO_SETTINGS },
    sectionOrder: ['name', 'description'],
    hiddenSections: ['tags'],
    contextSectionIds: ['description'],
    version: 1,
  };
}

function makeDraft(): BackupDraftTarget {
  return {
    ai: { ...DEFAULT_SETTINGS.ai, apiKey: 'sk-draft', apiKeysByBaseUrl: { 'https://x/v1': 'sk-draft' } },
    sampler: { ...DEFAULT_SETTINGS.sampler },
    prompts: { ...DEFAULT_SETTINGS.prompts },
    promptModels: {},
    agentModel: undefined,
    showLuckyVortex: true,
    markdownImageOpenLinks: true,
    defaultChatPanel: 'orion',
    requireAgentReview: false,
    spellcheckEnabled: true,
    spellcheckLanguage: 'en',
    spellcheckIgnoredWords: [],
    spellcheckCustomWords: [],
    sectionOrder: [],
    hiddenSections: [],
    contextSectionIds: [],
    studio: { ...DEFAULT_STUDIO_SETTINGS },
  };
}

describe('buildSettingsBackup', () => {
  it('strips API keys by default', () => {
    const file = buildSettingsBackup(makeSaved(), false);
    expect(file.includeKeys).toBe(false);
    expect(file.settings.ai.apiKey).toBe('');
    expect(file.settings.ai.apiKeysByBaseUrl).toEqual({});
    expect(file.settings.ai.baseUrl).toBe('https://example.com/v1');
    expect(file.settings.ai.modelId).toBe('model-a');
  });

  it('keeps API keys when requested', () => {
    const file = buildSettingsBackup(makeSaved(), true);
    expect(file.includeKeys).toBe(true);
    expect(file.settings.ai.apiKey).toBe('sk-live');
    expect(file.settings.ai.apiKeysByBaseUrl).toEqual({ 'https://example.com/v1': 'sk-live' });
  });

  it('never carries the ephemeral model catalog', () => {
    const file = buildSettingsBackup(makeSaved(), true);
    expect(file.settings.ai.availableModels).toEqual([]);
  });
});

describe('parseSettingsBackup', () => {
  it('rejects files that are not settings backups', () => {
    expect(() => parseSettingsBackup(null)).toThrow();
    expect(() => parseSettingsBackup({ kind: 'other', version: 1, settings: {} })).toThrow();
    expect(() => parseSettingsBackup({ kind: 'charactervault-settings', version: 1 })).toThrow();
  });

  it('rejects unsupported versions', () => {
    expect(() =>
      parseSettingsBackup({ kind: 'charactervault-settings', version: 99, settings: {} })
    ).toThrow(/version/i);
  });

  it('fills defaults for partial payloads', () => {
    const file = parseSettingsBackup({
      kind: 'charactervault-settings',
      version: 1,
      settings: { sampler: { temperature: 'hot' } },
    });
    expect(file.settings.sampler.temperature).toBe(DEFAULT_SETTINGS.sampler.temperature);
    expect(file.settings.prompts.expand).toBe(DEFAULT_SETTINGS.prompts.expand);
    expect(file.settings.agentModel).toBeNull();
  });

  it('clamps sampler bounds and drops unknown sections', () => {
    const file = parseSettingsBackup({
      kind: 'charactervault-settings',
      version: 1,
      settings: {
        sampler: { contextLength: 999_999_999, maxTokens: 99999 },
        sectionOrder: ['name', 'nope'],
        hiddenSections: ['tags', 'nope'],
      },
    });
    expect(file.settings.sampler.contextLength).toBeLessThanOrEqual(1_000_000);
    expect(file.settings.sampler.maxTokens).toBeLessThanOrEqual(8192);
    expect(file.settings.sectionOrder).toContain('name');
    expect(file.settings.sectionOrder).not.toContain('nope');
    expect(file.settings.hiddenSections).toEqual(['tags']);
  });

  it('round-trips through JSON', () => {
    const built = buildSettingsBackup(makeSaved(), true);
    const parsed = parseSettingsBackup(JSON.parse(JSON.stringify(built)));
    expect(parsed.settings.ai.apiKey).toBe('sk-live');
    expect(parsed.settings.ui.theme).toBe('dark');
  });
});

describe('applyBackupToDraft', () => {
  it('preserves existing keys when the backup has none', () => {
    const backup = buildSettingsBackup(makeSaved(), false);
    const next = applyBackupToDraft(makeDraft(), backup);
    expect(next.ai.apiKey).toBe('sk-draft');
    expect(next.ai.apiKeysByBaseUrl).toEqual({ 'https://x/v1': 'sk-draft' });
    expect(next.ai.modelId).toBe('model-a');
  });

  it('overwrites keys when the backup includes them', () => {
    const backup = buildSettingsBackup(makeSaved(), true);
    const next = applyBackupToDraft(makeDraft(), backup);
    expect(next.ai.apiKey).toBe('sk-live');
  });

  it('maps backup sections onto the draft', () => {
    const backup = buildSettingsBackup(makeSaved(), false);
    const next = applyBackupToDraft(makeDraft(), backup);
    expect(next.hiddenSections).toEqual(['tags']);
    expect(next.contextSectionIds).toEqual(['description']);
    expect(next.spellcheckIgnoredWords).toEqual(['foo']);
    expect(next.agentModel).toBeUndefined();
  });
});

describe('buildBackupFilename', () => {
  it('embeds the date', () => {
    expect(buildBackupFilename(new Date('2026-09-05T12:00:00Z'))).toBe(
      'charactervault-settings-2026-09-05.json'
    );
  });
});
