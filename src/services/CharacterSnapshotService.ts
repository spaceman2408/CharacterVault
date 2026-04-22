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

function hashString(value: string): string {
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b1;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    hashA ^= code;
    hashA = Math.imul(hashA, 0x01000193);
    hashB ^= code;
    hashB = Math.imul(hashB, 0x85ebca6b);
  }

  return `${(hashA >>> 0).toString(16).padStart(8, '0')}${(hashB >>> 0).toString(16).padStart(8, '0')}`;
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

function getCharacterSectionValue(character: Character, section: SnapshotDiffEntry['section']): unknown {
  switch (section) {
    case 'image':
      return character.imageData;
    case 'lorebook':
      return character.data.characterBook ?? null;
    case 'extensions':
      return character.data.extensions ?? {};
    default:
      return character.data.spec[section];
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

  async buildPayloadHash(payload: CharacterSnapshotPayload): Promise<string> {
    const serializedPayload = stableSerialize(payload);

    if (globalThis.crypto?.subtle) {
      const payloadBytes = new TextEncoder().encode(serializedPayload);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', payloadBytes);
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    }

    return hashString(serializedPayload);
  }

  async createSnapshot(character: Character, source: SnapshotSource): Promise<CharacterSnapshot | null> {
    const payload = this.buildPayload(character);
    const payloadHash = await this.buildPayloadHash(payload);
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

  async deleteSnapshot(snapshot: CharacterSnapshot): Promise<void> {
    if (this.isBaselineSnapshot(snapshot)) {
      throw new Error('Baseline snapshots cannot be deleted.');
    }

    await characterDb.deleteSnapshot(snapshot.id);
  }

  diffSnapshotAgainstCharacter(snapshot: CharacterSnapshot, character: Character): SnapshotDiffEntry[] {
    return DIFFABLE_SECTIONS.map(section => {
      const snapshotValue = getSectionValue(snapshot.payload, section);
      const currentValue = getCharacterSectionValue(character, section);
      return {
        section,
        label: getSectionLabel(section),
        changed: stableSerialize(snapshotValue) !== stableSerialize(currentValue),
        snapshotValue,
        currentValue,
      };
    });
  }

  countChangedSections(snapshot: CharacterSnapshot, character: Character): number {
    return DIFFABLE_SECTIONS.reduce((count, section) => {
      const snapshotValue = getSectionValue(snapshot.payload, section);
      const currentValue = getCharacterSectionValue(character, section);
      return count + (stableSerialize(snapshotValue) !== stableSerialize(currentValue) ? 1 : 0);
    }, 0);
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

  isBaselineSnapshot(snapshot: CharacterSnapshot): boolean {
    return snapshot.source === 'open';
  }
}

export const characterSnapshotService = new CharacterSnapshotService();
export { CharacterSnapshotService };
