import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import type { Character, VaultLorebook } from '../../src/db/characterTypes';
import { CharacterExportService } from '../../src/services/CharacterExportService';

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
        creator_notes: '',
        creator: '',
        character_version: '',
        tags: [],
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
      entries: [
        {
          id: 0,
          keys: ['treasury'],
          content: 'The royal treasury holds enchanted gold.',
          extensions: {},
          enabled: true,
        },
      ],
      extensions: {},
    },
    ...overrides,
  };
}

describe('CharacterExportService.exportVaultAsZip', () => {
  const service = new CharacterExportService();

  it('fails when the vault is empty', async () => {
    const result = await service.exportVaultAsZip([], []);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Nothing to export.');
  });

  it('includes standalone lorebooks under lorebooks/', async () => {
    const result = await service.exportVaultAsZip(
      [makeCharacter()],
      [makeLorebook()],
    );
    expect(result.success).toBe(true);
    expect(result.blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await result.blob!.arrayBuffer());
    const names = Object.keys(zip.files);
    expect(names).toContain('kisuki.json');
    expect(names).toContain('lorebooks/World Bible.json');

    const loreText = await zip.files['lorebooks/World Bible.json'].async('string');
    const parsed = JSON.parse(loreText) as { entries: Record<string, { content: string }> };
    expect(parsed.entries['0'].content).toContain('enchanted gold');
  });

  it('backs up lorebooks when there are no characters', async () => {
    const result = await service.exportVaultAsZip([], [makeLorebook()]);
    expect(result.success).toBe(true);
    const zip = await JSZip.loadAsync(await result.blob!.arrayBuffer());
    const loreFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith('lorebooks/') && !zip.files[name].dir,
    );
    expect(loreFiles).toHaveLength(1);
  });
});
