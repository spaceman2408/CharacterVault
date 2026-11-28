import { beforeEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import type { Character, CharacterVaultSettings } from '../../src/db/characterTypes';

const setFavorite = vi.fn(async () => undefined);
const importFromFile = vi.fn();

vi.mock('../../src/db/CharacterDatabase', () => ({
  characterDb: { setFavorite },
}));

vi.mock('../../src/services/CharacterImportService', () => ({
  characterImportService: { importFromFile },
}));

const { CharacterExportService } = await import('../../src/services/CharacterExportService');
const { buildSettingsBackup } = await import('../../src/services/SettingsBackupService');
const { vaultRestoreService } = await import('../../src/services/VaultRestoreService');

function makeCharacter(id: string, name: string, favorite?: boolean): Character {
  return {
    id,
    name,
    imageData: '',
    thumbnailData: '',
    version: 1,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    favorite,
    data: {
      spec: {
        name,
        description: '',
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
  };
}

const savedSettings: CharacterVaultSettings = {
  id: 'app-settings',
  ui: { theme: 'dark', editorFontSize: 16, sidebarWidth: 280 },
  version: 1,
};

async function exportVault(characters: Character[]): Promise<File> {
  const result = await new CharacterExportService().exportFullVaultAsZip(
    characters,
    [],
    buildSettingsBackup(savedSettings, false),
  );
  return new File([result.blob as Blob], 'backup.zip');
}

describe('vault backup favorites', () => {
  beforeEach(() => {
    setFavorite.mockClear();
    importFromFile.mockReset();
  });

  it('lists favorite characters in the manifest', async () => {
    const file = await exportVault([
      makeCharacter('a', 'Ada', true),
      makeCharacter('b', 'Bram'),
    ]);
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.favorites).toHaveLength(1);
    expect(manifest.favorites[0]).toMatch(/^characters\/ada.*\.json$/i);
    expect(zip.file(manifest.favorites[0])).not.toBeNull();
  });

  it('leaves favorites out when there are none', async () => {
    const file = await exportVault([makeCharacter('a', 'Ada')]);
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest).not.toHaveProperty('favorites');
  });

  it('stars restored characters that were favorites', async () => {
    const file = await exportVault([
      makeCharacter('a', 'Ada', true),
      makeCharacter('b', 'Bram'),
    ]);
    let next = 0;
    importFromFile.mockImplementation(async () => ({
      success: true,
      character: makeCharacter(`new-${++next}`, 'x'),
    }));

    const loaded = await vaultRestoreService.loadPreview(file);
    const paths = loaded.preview.characterPaths;
    const adaPath = paths.find((path) => /ada/i.test(path))!;
    const result = await vaultRestoreService.restore({
      ...loaded,
      preview: {
        ...loaded.preview,
        characterPaths: [adaPath, ...paths.filter((path) => path !== adaPath)],
        settings: null,
      },
    });

    expect(result.charactersImported).toBe(2);
    expect(setFavorite).toHaveBeenCalledTimes(1);
    expect(setFavorite).toHaveBeenCalledWith('new-1', true);
  });

  it('restores older backups without favorites', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ kind: 'charactervault-full-backup', version: 1, counts: {} }));
    zip.file('characters/Hero.json', JSON.stringify({ name: 'Hero' }));
    importFromFile.mockResolvedValue({ success: true, character: makeCharacter('h', 'Hero') });

    const loaded = await vaultRestoreService.loadPreview(
      new File([await zip.generateAsync({ type: 'blob' })], 'backup.zip'),
    );
    expect(loaded.preview.manifest?.favorites).toBeUndefined();
    await vaultRestoreService.restore(loaded);
    expect(setFavorite).not.toHaveBeenCalled();
  });
});
