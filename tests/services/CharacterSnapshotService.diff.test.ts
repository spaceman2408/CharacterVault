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
