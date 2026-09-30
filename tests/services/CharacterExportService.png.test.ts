import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../../src/db/characterTypes';
import { CharacterExportService } from '../../src/services/CharacterExportService';
import { convertImageToPng } from '../../src/utils/pngImage';

vi.mock('../../src/utils/pngImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/pngImage')>();
  return { ...actual, convertImageToPng: vi.fn() };
});

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function minimalPng(): Uint8Array {
  const ihdr = [0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0, 0, 0, 0];
  const iend = [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0];
  return new Uint8Array([...PNG_SIGNATURE, ...ihdr, ...iend]);
}

function toDataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}

function makeCharacter(imageData: string): Character {
  return {
    id: 'char-1',
    name: 'Vera',
    imageData,
    thumbnailData: '',
    version: 1,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    data: {
      spec: {
        name: 'Vera',
        description: '',
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
  };
}

describe('CharacterExportService PNG image formats', () => {
  const service = new CharacterExportService();

  beforeEach(() => {
    vi.mocked(convertImageToPng).mockReset();
  });

  it('converts a JPEG character image to PNG before embedding the card', async () => {
    vi.mocked(convertImageToPng).mockResolvedValue(minimalPng().buffer as ArrayBuffer);
    const jpeg = toDataUrl('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0]));

    const result = await service.exportAsPNG(makeCharacter(jpeg));

    expect(result.success).toBe(true);
    expect(convertImageToPng).toHaveBeenCalledWith(jpeg);
    const bytes = new Uint8Array(await result.blob!.arrayBuffer());
    expect(Array.from(bytes.slice(0, 8))).toEqual(PNG_SIGNATURE);
    expect(new TextDecoder().decode(bytes)).toContain('chara');
  });

  it('embeds into a PNG character image without converting it', async () => {
    const result = await service.exportAsPNG(makeCharacter(toDataUrl('image/png', minimalPng())));

    expect(result.success).toBe(true);
    expect(convertImageToPng).not.toHaveBeenCalled();
  });
});
