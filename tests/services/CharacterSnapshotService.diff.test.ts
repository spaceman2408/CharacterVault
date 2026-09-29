import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character, CharacterSnapshot } from '../../src/db/characterTypes';

const { resolveSnapshotImage } = vi.hoisted(() => ({
  resolveSnapshotImage: vi.fn(),
}));

vi.mock('../../src/db', () => ({
  CHARACTER_SECTIONS: [
    { id: 'name', label: 'Name' },
    { id: 'description', label: 'Description' },
  ],
  characterDb: {
    resolveSnapshotImage,
    getSnapshotById: vi.fn(),
    deleteSnapshotById: vi.fn(),
    deleteSnapshot: vi.fn(),
    cleanOrphanedImages: vi.fn(),
    getSnapshotMetadataForCharacter: vi.fn(),
    createSnapshot: vi.fn(),
    getSnapshotsForCharacter: vi.fn(),
    repairSnapshotImage: vi.fn(),
    overwriteSnapshotPayload: vi.fn(),
  },
}));

import { CharacterSnapshotService } from '../../src/services/CharacterSnapshotService';

function makeSpec(overrides: Partial<Character['data']['spec']> = {}): Character['data']['spec'] {
  return {
    name: 'Test',
    description: 'desc',
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
    ...overrides,
  };
}

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: 'Test',
    imageData: 'data:image/png;base64,CURRENT',
    thumbnailData: 'data:image/png;base64,THUMB',
    version: 1,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    data: {
      spec: makeSpec(),
      extensions: {},
    },
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<CharacterSnapshot> = {}): CharacterSnapshot {
  const character = makeCharacter();
  return {
    id: 'snap-1',
    characterId: character.id,
    source: 'manual',
    createdAt: '2020-01-02T00:00:00.000Z',
    payload: {
      name: character.name,
      imageData: character.imageData,
      thumbnailData: character.thumbnailData,
      data: character.data,
    },
    payloadHash: 'payload-hash',
    imageHash: 'same-image-hash',
    ...overrides,
  };
}

describe('CharacterSnapshotService.diffSnapshotAgainstCharacter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not re-resolve image when payload already has imageData', async () => {
    const service = new CharacterSnapshotService();
    const character = makeCharacter();
    const imageHash = await service.computeImageHash(character.imageData, character.thumbnailData);
    const snapshot = makeSnapshot({
      payload: {
        name: 'Test',
        imageData: character.imageData,
        thumbnailData: character.thumbnailData,
        data: character.data,
      },
      imageHash,
    });

    const entries = await service.diffSnapshotAgainstCharacter(snapshot, character);
    const imageEntry = entries.find(entry => entry.section === 'image');

    expect(resolveSnapshotImage).not.toHaveBeenCalled();
    expect(imageEntry?.changed).toBe(false);
  });

  it('skips resolve when imageHash matches current image hash and payload has no image bytes', async () => {
    const service = new CharacterSnapshotService();
    const character = makeCharacter();
    const imageHash = await service.computeImageHash(character.imageData, character.thumbnailData);
    const snapshot = makeSnapshot({
      payload: {
        name: 'Test',
        imageData: '',
        thumbnailData: '',
        data: character.data,
      },
      imageHash,
    });

    const entries = await service.diffSnapshotAgainstCharacter(snapshot, character);
    const imageEntry = entries.find(entry => entry.section === 'image');

    expect(resolveSnapshotImage).not.toHaveBeenCalled();
    expect(imageEntry?.changed).toBe(false);
    // Unchanged image should not force full base64 into the entry values.
    expect(imageEntry?.snapshotValue).toBe('');
    expect(imageEntry?.currentValue).toBe(character.imageData);
  });

  it('resolves image when hashes differ and payload has no image bytes', async () => {
    const service = new CharacterSnapshotService();
    const character = makeCharacter();
    const snapshot = makeSnapshot({
      payload: {
        name: 'Test',
        imageData: '',
        thumbnailData: '',
        data: {
          ...character.data,
          spec: makeSpec({ description: 'old desc' }),
        },
      },
      imageHash: 'different-hash',
    });

    resolveSnapshotImage.mockResolvedValue({
      imageData: 'data:image/png;base64,OLD',
      thumbnailData: 'data:image/png;base64,OLDTHUMB',
    });

    const entries = await service.diffSnapshotAgainstCharacter(snapshot, character);
    const imageEntry = entries.find(entry => entry.section === 'image');

    expect(resolveSnapshotImage).toHaveBeenCalledWith('different-hash');
    expect(imageEntry?.changed).toBe(true);
    expect(imageEntry?.snapshotValue).toBe('data:image/png;base64,OLD');
  });
});

describe('CharacterSnapshotService change detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function snapshotOf(character: Character, overrides: Partial<Character['data']['spec']> = {}) {
    const service = new CharacterSnapshotService();
    const imageHash = await service.computeImageHash(character.imageData, character.thumbnailData);
    return makeSnapshot({
      payload: {
        name: character.name,
        imageData: '',
        thumbnailData: '',
        data: { ...character.data, spec: { ...character.data.spec, ...overrides } },
      },
      imageHash,
    });
  }

  it('does not flag a field that went from missing to empty', async () => {
    const service = new CharacterSnapshotService();
    const character = makeCharacter();
    const snapshot = await snapshotOf(character, { creator: undefined, tags: undefined });

    const entries = await service.diffSnapshotAgainstCharacter(snapshot, character);

    expect(entries.filter(entry => entry.changed)).toEqual([]);
  });

  it('does not flag CRLF versus LF line endings', async () => {
    const service = new CharacterSnapshotService();
    const character = makeCharacter({ data: { spec: makeSpec({ description: 'one\ntwo' }), extensions: {} } });
    const snapshot = await snapshotOf(character, { description: 'one\r\ntwo' });

    const entries = await service.diffSnapshotAgainstCharacter(snapshot, character);

    expect(entries.find(entry => entry.section === 'description')?.changed).toBe(false);
  });

  it('hasChanges agrees with the section diff', async () => {
    const service = new CharacterSnapshotService();
    const character = makeCharacter();
    const imageHash = await service.computeImageHash(character.imageData, character.thumbnailData);

    expect(service.hasChanges(await snapshotOf(character, { creator: undefined }), character, imageHash)).toBe(false);
    expect(service.hasChanges(await snapshotOf(character, { description: 'old' }), character, imageHash)).toBe(true);
    expect(service.hasChanges(await snapshotOf(character), character, 'other-image')).toBe(true);
  });

  it('does not flag the vault-only AI context pin on a lorebook entry', async () => {
    const service = new CharacterSnapshotService();
    const withBook = (context_enabled: boolean, content = 'Harbor') => makeCharacter({
      data: {
        spec: makeSpec(),
        extensions: {},
        characterBook: {
          name: 'Book',
          extensions: {},
          entries: [{ id: 1, keys: ['harbor'], content, enabled: true, extensions: { context_enabled } }],
        },
      },
    });
    const character = withBook(false);
    const imageHash = await service.computeImageHash(character.imageData, character.thumbnailData);
    const pinned = makeSnapshot({ payload: { ...service.buildPayload(withBook(true)), imageData: '', thumbnailData: '' }, imageHash });
    const edited = makeSnapshot({ payload: { ...service.buildPayload(withBook(true, 'Old')), imageData: '', thumbnailData: '' }, imageHash });

    const entries = await service.diffSnapshotAgainstCharacter(pinned, character);

    expect(entries.find(entry => entry.section === 'lorebook')?.changed).toBe(false);
    expect(service.hasChanges(pinned, character, imageHash)).toBe(false);
    expect(service.hasChanges(edited, character, imageHash)).toBe(true);
    expect(character.data.characterBook?.entries[0].extensions.context_enabled).toBe(false);
  });

  it('computeCharacterHashes matches the hash stored with a snapshot', async () => {
    const service = new CharacterSnapshotService();
    const character = makeCharacter();
    const imageHash = await service.computeImageHash(character.imageData, character.thumbnailData);
    const storedHash = await service.buildPayloadHash(service.buildPayload(character), imageHash);

    expect(await service.computeCharacterHashes(character)).toEqual({ imageHash, payloadHash: storedHash });
  });

  it('snapshotHasChanges skips the load when the payload hash matches', async () => {
    const service = new CharacterSnapshotService();
    const character = makeCharacter();
    const hashes = await service.computeCharacterHashes(character);
    const cosmetic = await snapshotOf(character, { creator: undefined });
    const edited = await snapshotOf(character, { description: 'old' });
    const { characterDb } = await import('../../src/db');
    vi.mocked(characterDb.getSnapshotById).mockImplementation(async (id: string) =>
      id === 'cosmetic' ? cosmetic : id === 'edited' ? edited : undefined,
    );
    const meta = (id: string, payloadHash: string) => ({
      id,
      characterId: character.id,
      source: 'manual' as const,
      createdAt: '2020-01-02T00:00:00.000Z',
      payloadHash,
      imageHash: null,
    });

    expect(await service.snapshotHasChanges(meta('same', hashes.payloadHash), character, hashes)).toBe(false);
    expect(await service.snapshotHasChanges(meta('cosmetic', 'stale'), character, hashes)).toBe(false);
    expect(await service.snapshotHasChanges(meta('edited', 'stale'), character, hashes)).toBe(true);
    expect(characterDb.getSnapshotById).not.toHaveBeenCalledWith('same');
  });
});
