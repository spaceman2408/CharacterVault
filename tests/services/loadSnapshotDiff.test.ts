import { describe, expect, it, vi } from 'vitest';
import type { Character, CharacterSnapshot, SnapshotDiffEntry } from '../../src/db/characterTypes';
import { loadSnapshotDiff } from '../../src/services/historyLifecycle';

function makeCharacter(): Character {
  return {
    id: 'char-1',
    name: 'Test',
    imageData: 'data:image/png;base64,AAA',
    thumbnailData: 'data:image/png;base64,BBB',
    version: 1,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    data: {
      spec: {
        name: 'Test',
        description: 'desc',
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
        creator_notes: '',
        system_prompt: '',
        post_history_instructions: '',
        alternate_greetings: [],
        physical_description: '',
        tags: [],
        creator: '',
        character_version: '',
      },
      extensions: {},
    },
  };
}

function makeSnapshot(id: string): CharacterSnapshot {
  const character = makeCharacter();
  return {
    id,
    characterId: character.id,
    source: 'manual',
    createdAt: '2020-01-02T00:00:00.000Z',
    payload: {
      name: character.name,
      imageData: character.imageData,
      thumbnailData: character.thumbnailData,
      data: character.data,
    },
    payloadHash: 'hash-1',
    imageHash: 'img-hash-1',
  };
}

describe('loadSnapshotDiff', () => {
  it('loads the payload once then diffs that snapshot', async () => {
    const snapshot = makeSnapshot('snap-1');
    const character = makeCharacter();
    const entries: SnapshotDiffEntry[] = [
      {
        section: 'description',
        label: 'Description',
        changed: true,
        snapshotValue: 'old',
        currentValue: 'desc',
      },
    ];

    const loadSnapshotForDiff = vi.fn(async () => snapshot);
    const diffSnapshotAgainstCharacter = vi.fn(async () => entries);

    const result = await loadSnapshotDiff('snap-1', character, {
      loadSnapshotForDiff,
      diffSnapshotAgainstCharacter,
    });

    expect(loadSnapshotForDiff).toHaveBeenCalledOnce();
    expect(loadSnapshotForDiff).toHaveBeenCalledWith('snap-1');
    expect(diffSnapshotAgainstCharacter).toHaveBeenCalledOnce();
    expect(diffSnapshotAgainstCharacter).toHaveBeenCalledWith(snapshot, character);
    expect(result).toEqual({ snapshot, entries });
  });

  it('returns empty entries when the snapshot is missing', async () => {
    const character = makeCharacter();
    const loadSnapshotForDiff = vi.fn(async () => undefined);
    const diffSnapshotAgainstCharacter = vi.fn();

    const result = await loadSnapshotDiff('missing', character, {
      loadSnapshotForDiff,
      diffSnapshotAgainstCharacter,
    });

    expect(result).toEqual({ snapshot: null, entries: [] });
    expect(diffSnapshotAgainstCharacter).not.toHaveBeenCalled();
  });
});
