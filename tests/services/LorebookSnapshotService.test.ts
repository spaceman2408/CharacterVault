import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LorebookSnapshot, VaultLorebook } from '../../src/db/characterTypes';

const {
  createLorebookSnapshot,
  getLorebookSnapshotMetadata,
  getLorebookSnapshotById,
  deleteLorebookSnapshot,
  overwriteLorebookSnapshot,
} = vi.hoisted(() => ({
  createLorebookSnapshot: vi.fn(),
  getLorebookSnapshotMetadata: vi.fn(),
  getLorebookSnapshotById: vi.fn(),
  deleteLorebookSnapshot: vi.fn(),
  overwriteLorebookSnapshot: vi.fn(),
}));

vi.mock('../../src/db/CharacterDatabase', () => ({
  characterDb: {
    createLorebookSnapshot,
    getLorebookSnapshotMetadata,
    getLorebookSnapshotById,
    deleteLorebookSnapshot,
    overwriteLorebookSnapshot,
  },
}));

import {
  computeLorebookPayloadHash,
  lorebookSnapshotService,
} from '../../src/services/LorebookSnapshotService';

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

describe('LorebookSnapshotService.createFromLorebook', () => {
  beforeEach(() => {
    createLorebookSnapshot.mockReset();
    getLorebookSnapshotMetadata.mockReset();
    getLorebookSnapshotById.mockReset();
    deleteLorebookSnapshot.mockReset();
    overwriteLorebookSnapshot.mockReset();

    const stored: LorebookSnapshot[] = [];
    getLorebookSnapshotMetadata.mockImplementation(async (lorebookId: string) =>
      stored
        .filter((snapshot) => snapshot.lorebookId === lorebookId)
        .slice()
        .reverse()
        .map(({ id, lorebookId: bookId, source, createdAt, payloadHash }) => ({
          id,
          lorebookId: bookId,
          source,
          createdAt,
          payloadHash,
        })),
    );
    getLorebookSnapshotById.mockImplementation(async (id: string) =>
      stored.find((snapshot) => snapshot.id === id),
    );
    deleteLorebookSnapshot.mockImplementation(async (id: string) => {
      const index = stored.findIndex((snapshot) => snapshot.id === id);
      if (index >= 0) stored.splice(index, 1);
    });
    overwriteLorebookSnapshot.mockImplementation(async (id, payload, payloadHash) => {
      const snapshot = stored.find((entry) => entry.id === id);
      if (!snapshot) throw new Error('Snapshot not found');
      if (snapshot.source !== 'open') throw new Error('Only the opened baseline can be updated');
      snapshot.payload = payload;
      snapshot.payloadHash = payloadHash;
    });

    let latestHash: string | null = null;
    createLorebookSnapshot.mockImplementation(async (input) => {
      if (latestHash === input.payloadHash) return null;
      latestHash = input.payloadHash;
      const snapshot = {
        id: `snap-${input.payloadHash.slice(0, 8)}`,
        lorebookId: input.lorebookId,
        source: input.source,
        createdAt: '2020-01-02T00:00:00.000Z',
        payload: input.payload,
        payloadHash: input.payloadHash,
      } satisfies LorebookSnapshot;
      stored.push(snapshot);
      return snapshot;
    });
  });

  it('creates a revision when the book changed', async () => {
    const first = await lorebookSnapshotService.createFromLorebook(makeLorebook(), 'open');
    expect(first).not.toBeNull();

    const changed = await lorebookSnapshotService.createFromLorebook(
      makeLorebook({
        book: {
          name: 'World Bible',
          description: 'Setting notes',
          extensions: {},
          entries: [
            {
              id: 0,
              keys: ['treasury'],
              content: 'The vault is empty.',
              extensions: {},
              enabled: true,
            },
          ],
        },
      }),
      'manual',
    );
    expect(changed).not.toBeNull();
    expect(changed?.source).toBe('manual');
    expect(createLorebookSnapshot).toHaveBeenCalledTimes(2);
  });

  it('keeps a single open baseline even if the book later changes', async () => {
    const first = await lorebookSnapshotService.createFromLorebook(makeLorebook(), 'open');
    const second = await lorebookSnapshotService.createFromLorebook(
      makeLorebook({ name: 'Edited Bible' }),
      'open',
    );

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(createLorebookSnapshot).toHaveBeenCalledTimes(1);
  });

  it('skips when the payload matches the latest revision', async () => {
    const book = makeLorebook();
    const first = await lorebookSnapshotService.createFromLorebook(book, 'open');
    const second = await lorebookSnapshotService.createFromLorebook(book, 'manual');

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(createLorebookSnapshot).toHaveBeenCalledTimes(2);
  });

  it('refuses to delete the opened baseline', async () => {
    const created = await lorebookSnapshotService.createFromLorebook(makeLorebook(), 'open');
    await expect(lorebookSnapshotService.delete(created!.id)).rejects.toThrow(
      'The opened baseline cannot be deleted',
    );
    expect(deleteLorebookSnapshot).not.toHaveBeenCalled();
  });

  it('overwrites the opened baseline when the book changed', async () => {
    const created = await lorebookSnapshotService.createFromLorebook(makeLorebook(), 'open');
    const result = await lorebookSnapshotService.overwriteBaseline(
      makeLorebook({ name: 'Edited Bible' }),
      created!.id,
    );

    expect(result).toBe('updated');
    expect(overwriteLorebookSnapshot).toHaveBeenCalledTimes(1);
    expect(created?.payload.name).toBe('Edited Bible');
  });

  it('skips overwriting the opened baseline when nothing changed', async () => {
    const created = await lorebookSnapshotService.createFromLorebook(makeLorebook(), 'open');
    const result = await lorebookSnapshotService.overwriteBaseline(makeLorebook(), created!.id);

    expect(result).toBe('skipped');
    expect(overwriteLorebookSnapshot).not.toHaveBeenCalled();
  });

  it('hashes the same payload stably', async () => {
    const payload = {
      name: 'World Bible',
      description: 'Setting notes',
      tags: [] as string[],
      book: makeLorebook().book,
    };
    const [left, right] = await Promise.all([
      computeLorebookPayloadHash(payload),
      computeLorebookPayloadHash(payload),
    ]);
    expect(left).toBe(right);
  });
});
