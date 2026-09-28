import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../../src/db/characterTypes';
import { characterDb } from '../../src/db/CharacterDatabase';
import { CharacterImportService } from '../../src/services/CharacterImportService';

vi.mock('../../src/db/CharacterDatabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/db/CharacterDatabase')>();
  return { ...actual, characterDb: { createCharacter: vi.fn() } };
});

vi.mock('../../src/utils/thumbnail', () => ({ generateThumbnail: vi.fn(async () => '') }));

const encoder = new TextEncoder();

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  new DataView(out.buffer).setUint32(0, data.length);
  out.set(encoder.encode(type), 4);
  out.set(data, 8);
  return out;
}

function png(...chunks: Uint8Array[]): File {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const bytes = concat([signature, ...chunks, chunk('IEND', new Uint8Array())]);
  return new File([bytes], 'card.png', { type: 'image/png' });
}

function cardBase64(name: string, spec = 'chara_card_v3'): string {
  const json = JSON.stringify({ spec, spec_version: spec === 'chara_card_v3' ? '3.0' : '2.0', data: { name, description: `${name} desc` } });
  return Buffer.from(json, 'utf-8').toString('base64');
}

function tEXt(keyword: string, text: string): Uint8Array {
  return chunk('tEXt', concat([encoder.encode(keyword), new Uint8Array([0]), encoder.encode(text)]));
}

async function compressedITXt(keyword: string, text: string): Promise<Uint8Array> {
  const stream = new Blob([encoder.encode(text)]).stream().pipeThrough(new CompressionStream('deflate'));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  const header = concat([encoder.encode(keyword), new Uint8Array([0, 1, 0, 0, 0])]);
  return chunk('iTXt', concat([header, compressed]));
}

describe('CharacterImportService PNG chunks', () => {
  const service = new CharacterImportService();
  const createCharacter = vi.mocked(characterDb.createCharacter);

  beforeEach(() => {
    vi.spyOn(service as unknown as { fileToDataURL: () => Promise<string> }, 'fileToDataURL')
      .mockResolvedValue('data:image/png;base64,');
    createCharacter.mockReset();
    createCharacter.mockImplementation(async (input) => ({
      id: 'imported-1',
      name: input.name,
      imageData: '',
      thumbnailData: '',
      version: 1,
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
      data: input.data as Character['data'],
    }));
  });

  it('imports a card that only has a ccv3 chunk', async () => {
    const result = await service.importFromFile(png(tEXt('ccv3', cardBase64('Vera'))));
    expect(result.success).toBe(true);
    expect(result.character?.name).toBe('Vera');
  });

  it('prefers ccv3 over chara when both are present', async () => {
    const result = await service.importFromFile(
      png(tEXt('chara', cardBase64('Old V2', 'chara_card_v2')), tEXt('ccv3', cardBase64('New V3'))),
    );
    expect(result.character?.name).toBe('New V3');
  });

  it('still imports a chara-only card', async () => {
    const result = await service.importFromFile(png(tEXt('chara', cardBase64('Classic', 'chara_card_v2'))));
    expect(result.character?.name).toBe('Classic');
  });

  it('decompresses a compressed iTXt chara chunk', async () => {
    const result = await service.importFromFile(png(await compressedITXt('chara', cardBase64('Zipped'))));
    expect(result.success).toBe(true);
    expect(result.character?.name).toBe('Zipped');
  });

  it('refuses a compressed chunk that inflates past the size cap', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const stream = new Blob([new Uint8Array(65 * 1024 * 1024)]).stream().pipeThrough(new CompressionStream('deflate'));
    const bomb = new Uint8Array(await new Response(stream).arrayBuffer());
    const header = concat([encoder.encode('chara'), new Uint8Array([0, 1, 0, 0, 0])]);

    const result = await service.importFromFile(png(chunk('iTXt', concat([header, bomb]))));

    expect(result.success).toBe(false);
    expect(createCharacter).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('Failed to decompress iTXt chunk:', expect.any(Error));
    warn.mockRestore();
  });
});
