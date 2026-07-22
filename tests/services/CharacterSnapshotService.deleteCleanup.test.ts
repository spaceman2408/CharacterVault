import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterSnapshot } from '../../src/db/characterTypes';

const {
  getSnapshotById,
  deleteSnapshotById,
  deleteSnapshot,
  cleanOrphanedImages,
  resolveSnapshotImage,
} = vi.hoisted(() => ({
  getSnapshotById: vi.fn(),
  deleteSnapshotById: vi.fn(),
  deleteSnapshot: vi.fn(),
  cleanOrphanedImages: vi.fn(),
  resolveSnapshotImage: vi.fn(),
}));

vi.mock('../../src/db', () => ({
  CHARACTER_SECTIONS: [],
  characterDb: {
    getSnapshotById,
    deleteSnapshotById,
    deleteSnapshot,
    cleanOrphanedImages,
    resolveSnapshotImage,
    getSnapshotMetadataForCharacter: vi.fn(),
    createSnapshot: vi.fn(),
    getSnapshotsForCharacter: vi.fn(),
    repairSnapshotImage: vi.fn(),
    overwriteSnapshotPayload: vi.fn(),
  },
}));

import { CharacterSnapshotService } from '../../src/services/CharacterSnapshotService';

function makeSnapshot(overrides: Partial<CharacterSnapshot> = {}): CharacterSnapshot {
  return {
    id: 'snap-1',
    characterId: 'char-1',
    source: 'manual',
    createdAt: '2020-01-01T00:00:00.000Z',
    payload: {
      name: 'Test',
      imageData: '',
      thumbnailData: '',
      data: {
        spec: {
          name: 'Test',
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
      },
    },
    payloadHash: 'payload-hash',
    imageHash: 'image-hash-1',
    ...overrides,
  };
}

describe('CharacterSnapshotService.deleteSnapshotById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the snapshot and cleans orphaned images for that character', async () => {
    const service = new CharacterSnapshotService();
    const snapshot = makeSnapshot();
    getSnapshotById.mockResolvedValue(snapshot);
    deleteSnapshot.mockResolvedValue(undefined);
    cleanOrphanedImages.mockResolvedValue(undefined);

    await service.deleteSnapshotById('snap-1');

    // Prefer the cleanup-aware DB path (or equivalent raw delete + clean).
    const usedCleanupAwareDelete = deleteSnapshot.mock.calls.length > 0;
    const usedRawDeletePlusClean =
      deleteSnapshotById.mock.calls.length > 0 && cleanOrphanedImages.mock.calls.length > 0;

    expect(usedCleanupAwareDelete || usedRawDeletePlusClean).toBe(true);

    if (usedCleanupAwareDelete) {
      expect(deleteSnapshot).toHaveBeenCalledWith('snap-1');
    } else {
      expect(deleteSnapshotById).toHaveBeenCalledWith('snap-1');
      expect(cleanOrphanedImages).toHaveBeenCalledWith('char-1');
    }
  });

  it('no-ops cleanup when the snapshot does not exist', async () => {
    const service = new CharacterSnapshotService();
    getSnapshotById.mockResolvedValue(undefined);
    deleteSnapshot.mockResolvedValue(undefined);

    await service.deleteSnapshotById('missing');

    // Raw delete of missing id is fine; must not invent a characterId cleanup.
    if (deleteSnapshot.mock.calls.length > 0) {
      expect(deleteSnapshot).toHaveBeenCalledWith('missing');
    }
    expect(cleanOrphanedImages).not.toHaveBeenCalled();
  });
});
