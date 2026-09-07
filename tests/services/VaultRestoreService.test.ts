import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import type {
  Character,
  CharacterVaultSettings,
  VaultLorebook,
} from '../../src/db/characterTypes';
import {
  CharacterExportService,
  FULL_BACKUP_KIND,
} from '../../src/services/CharacterExportService';
import { buildSettingsBackup } from '../../src/services/SettingsBackupService';
import { vaultRestoreService } from '../../src/services/VaultRestoreService';

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: 'Kisuki',
    imageData: '',
    thumbnailData: '',
    version: 1,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    data: {
      spec: {
        name: 'Kisuki',
        description: 'A paralegal',
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
        system_prompt: '',
        post_history_instructions: '',
        alternate_greetings: [],
        physical_description: '',
      },
      extensions: {},
    },
    ...overrides,
  };
}

function makeLorebook(overrides: Partial<VaultLorebook> = {}): VaultLorebook {
  return {
    id: 'book-1',
    name: 'World Bible',
    description: 'Setting notes',
    tags: [],
    version: 1,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    book: {
      name: 'World Bible',
      description: 'Setting notes',
      entries: [],
      extensions: {},
    },
    ...overrides,
  };
}

function makeSavedSettings(): CharacterVaultSettings {
  return {
    id: 'app-settings',
    ui: { theme: 'dark', editorFontSize: 16, sidebarWidth: 280 },
    version: 1,
  };
}

async function zipFile(zip: JSZip, name = 'backup.zip'): Promise<File> {
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], name, { type: 'application/zip' });
}

describe('CharacterExportService.exportFullVaultAsZip', () => {
  const service = new CharacterExportService();

  it('writes folders, settings, and a manifest', async () => {
    const settings = buildSettingsBackup(makeSavedSettings(), false, [
      { category: 'mood', tag: 'brooding' },
    ]);
    const result = await service.exportFullVaultAsZip(
      [makeCharacter()],
      [makeLorebook()],
      settings,
    );
    expect(result.success).toBe(true);
    expect(result.filename).toMatch(/^charactervault-full-backup-.*\.zip$/);

    const zip = await JSZip.loadAsync(await (result.blob as Blob).arrayBuffer());
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    expect(names.some((n) => n.startsWith('characters/') && n.endsWith('.json'))).toBe(true);
    expect(names.some((n) => n.startsWith('lorebooks/') && n.endsWith('.json'))).toBe(true);
    expect(names).toContain('settings.json');
    expect(names).toContain('manifest.json');

    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.kind).toBe(FULL_BACKUP_KIND);
    expect(manifest.version).toBe(1);
    expect(manifest.includeKeys).toBe(false);
    expect(manifest.counts).toEqual({ characters: 1, lorebooks: 1 });

    const storedSettings = JSON.parse(await zip.file('settings.json')!.async('string'));
    expect(storedSettings.settings.ai.apiKey).toBe('');
    expect(storedSettings.settings.studioFavorites).toEqual([
      { category: 'mood', tag: 'brooding' },
    ]);
  });

  it('succeeds for a settings-only vault', async () => {
    const settings = buildSettingsBackup(makeSavedSettings(), false);
    const result = await service.exportFullVaultAsZip([], [], settings);
    expect(result.success).toBe(true);
    const zip = await JSZip.loadAsync(await (result.blob as Blob).arrayBuffer());
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.counts).toEqual({ characters: 0, lorebooks: 0 });
  });
});

describe('VaultRestoreService.loadPreview', () => {
  it('rejects non-ZIP files', async () => {
    const file = new File(['not a zip'], 'backup.zip', { type: 'application/zip' });
    await expect(vaultRestoreService.loadPreview(file)).rejects.toThrow(/readable ZIP/i);
  });

  it('reads a full backup produced by export', async () => {
    const service = new CharacterExportService();
    const settings = buildSettingsBackup(makeSavedSettings(), false);
    const exported = await service.exportFullVaultAsZip(
      [makeCharacter()],
      [makeLorebook()],
      settings,
    );
    const loaded = await vaultRestoreService.loadPreview(
      new File([exported.blob as Blob], 'backup.zip'),
    );
    expect(loaded.preview.mode).toBe('full');
    expect(loaded.preview.characterPaths).toHaveLength(1);
    expect(loaded.preview.lorebookPaths).toHaveLength(1);
    expect(loaded.preview.settings).not.toBeNull();
    expect(loaded.preview.includeKeys).toBe(false);
  });

  it('treats a manifest-less archive as a legacy backup', async () => {
    const zip = new JSZip();
    zip.file('Hero.json', JSON.stringify({ name: 'Hero' }));
    zip.file('lorebooks/World.json', JSON.stringify({ entries: [] }));
    const loaded = await vaultRestoreService.loadPreview(await zipFile(zip));
    expect(loaded.preview.mode).toBe('legacy');
    expect(loaded.preview.characterPaths).toEqual(['Hero.json']);
    expect(loaded.preview.lorebookPaths).toEqual(['lorebooks/World.json']);
    expect(loaded.preview.settings).toBeNull();
  });

  it('rejects a manifest with the wrong kind or version', async () => {
    const badKind = new JSZip();
    badKind.file('manifest.json', JSON.stringify({ kind: 'nope', version: 1 }));
    await expect(vaultRestoreService.loadPreview(await zipFile(badKind))).rejects.toThrow(
      /not a CharacterVault full backup/i
    );

    const badVersion = new JSZip();
    badVersion.file('manifest.json', JSON.stringify({ kind: FULL_BACKUP_KIND, version: 99 }));
    await expect(vaultRestoreService.loadPreview(await zipFile(badVersion))).rejects.toThrow(
      /version/i
    );
  });

  it('keeps restorable content when the settings entry is corrupt', async () => {
    const zip = new JSZip();
    zip.file('settings.json', '{ broken');
    zip.file('characters/Hero.json', JSON.stringify({ name: 'Hero' }));
    const loaded = await vaultRestoreService.loadPreview(await zipFile(zip));
    expect(loaded.preview.settings).toBeNull();
    expect(loaded.preview.settingsError).toBeTruthy();
    expect(loaded.preview.characterPaths).toEqual(['characters/Hero.json']);
  });

  it('skips metadata and unrelated files', async () => {
    const zip = new JSZip();
    zip.file('characters/Hero.json', JSON.stringify({ name: 'Hero' }));
    zip.file('__MACOSX/characters/._Hero.json', 'junk');
    zip.file('notes.txt', 'hello');
    const loaded = await vaultRestoreService.loadPreview(await zipFile(zip));
    expect(loaded.preview.characterPaths).toEqual(['characters/Hero.json']);
    expect(loaded.preview.skippedCount).toBe(1);
  });
});
