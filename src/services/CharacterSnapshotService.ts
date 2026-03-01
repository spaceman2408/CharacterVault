/**
 * @fileoverview Snapshot service for character rollback history.
 * @module services/CharacterSnapshotService
 */

import type {
  Character,
  CharacterSection,
  CharacterSnapshot,
  CharacterSnapshotPayload,
  SnapshotDiffEntry,
  SnapshotSource,
  UpdateCharacterInput,
} from '../db/characterTypes';
import { CHARACTER_SECTIONS, characterDb } from '../db';

export type SnapshotRestoreAction =
  | { kind: 'image'; value: string }
  | { kind: 'spec'; field: keyof Character['data']['spec']; value: string | string[] }
  | { kind: 'character'; input: UpdateCharacterInput };

const SNAPSHOT_SOURCE_LABELS: Record<SnapshotSource, string> = {
  open: 'Open',
  auto: 'Auto',
  manual: 'Manual',
  rollback: 'Rollback',
};

const SNAPSHOT_SOURCE_DESCRIPTIONS: Record<SnapshotSource, string> = {
  open: 'Baseline',
  auto: 'Idle snapshot',
  manual: 'Manual snapshot',
  rollback: 'After restore',
};

const DIFFABLE_SECTIONS: Array<SnapshotDiffEntry['section']> = [
  'image',
  'name',
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
  'system_prompt',
  'post_history_instructions',
  'alternate_greetings',
  'physical_description',
  'lorebook',
  'creator',
  'creator_notes',
  'tags',
  'character_version',
  'extensions',
  'avatar',
];

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableSerialize(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function clonePayloadData<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function getSectionLabel(section: SnapshotDiffEntry['section']): string {
  if (section === 'image') return 'Image';
  if (section === 'lorebook') return 'Lorebook';
  if (section === 'extensions') return 'Extensions';
  return CHARACTER_SECTIONS.find(entry => entry.id === section)?.label ?? section;
}

function getSectionValue(payload: CharacterSnapshotPayload, section: SnapshotDiffEntry['section']): unknown {
  switch (section) {
    case 'image':
      return payload.imageData;
    case 'lorebook':
      return payload.data.characterBook ?? null;
    case 'extensions':
      return payload.data.extensions ?? {};
    default:
      return payload.data.spec[section];
  }
}

class CharacterSnapshotService {
  buildPayload(character: Character): CharacterSnapshotPayload {
    return {
      name: character.name,
      imageData: character.imageData,
      data: clonePayloadData(character.data),
    };
  }

  buildPayloadHash(payload: CharacterSnapshotPayload): string {
    return stableSerialize(payload);
  }

  async createSnapshot(character: Character, source: SnapshotSource): Promise<CharacterSnapshot | null> {
    const payload = this.buildPayload(character);
    const payloadHash = this.buildPayloadHash(payload);
    return characterDb.createSnapshot({
      characterId: character.id,
      source,
      payload,
      payloadHash,
    });
  }

  async listSnapshots(characterId: string): Promise<CharacterSnapshot[]> {
    const snapshots = await characterDb.getSnapshotsForCharacter(characterId);
    return [...snapshots].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  diffSnapshotAgainstCharacter(snapshot: CharacterSnapshot, character: Character): SnapshotDiffEntry[] {
    const currentPayload = this.buildPayload(character);

    return DIFFABLE_SECTIONS.map(section => {
      const snapshotValue = getSectionValue(snapshot.payload, section);
      const currentValue = getSectionValue(currentPayload, section);
      return {
        section,
        label: getSectionLabel(section),
        changed: stableSerialize(snapshotValue) !== stableSerialize(currentValue),
        snapshotValue,
        currentValue,
      };
    });
  }

  restoreWholeCharacter(_currentCharacter: Character, snapshot: CharacterSnapshot): UpdateCharacterInput {
    return {
      name: snapshot.payload.name,
      imageData: snapshot.payload.imageData,
      data: clonePayloadData(snapshot.payload.data),
    };
  }

  restoreSection(currentCharacter: Character, snapshot: CharacterSnapshot, section: CharacterSection): SnapshotRestoreAction | null {
    switch (section) {
      case 'image':
        return { kind: 'image', value: snapshot.payload.imageData };
      case 'lorebook':
        return {
          kind: 'character',
          input: {
            data: {
              ...currentCharacter.data,
              characterBook: clonePayloadData(snapshot.payload.data.characterBook),
            },
          },
        };
      case 'extensions':
        return {
          kind: 'character',
          input: {
            data: {
              ...currentCharacter.data,
              extensions: clonePayloadData(snapshot.payload.data.extensions ?? {}),
            },
          },
        };
      default:
        {
          const sectionValue = snapshot.payload.data.spec[section];
        return {
          kind: 'spec',
          field: section,
          value: Array.isArray(sectionValue)
            ? clonePayloadData(sectionValue)
            : String(sectionValue ?? ''),
        };
        }
    }
  }

  formatSnapshotSource(source: SnapshotSource): string {
    return SNAPSHOT_SOURCE_LABELS[source];
  }

  describeSnapshotSource(source: SnapshotSource): string {
    return SNAPSHOT_SOURCE_DESCRIPTIONS[source];
  }
}

export const characterSnapshotService = new CharacterSnapshotService();
export { CharacterSnapshotService };
