/**
 * @fileoverview Snapshot service for character rollback history.
 * @module services/CharacterSnapshotService
 */

import type {
  Character,
  CharacterBook,
  CharacterSection,
  CharacterSnapshot,
  CharacterSnapshotPayload,
  SnapshotDiffEntry,
  SnapshotSource,
  UpdateCharacterInput,
  SnapshotMetadata,
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

function normalizeLorebook(book: CharacterBook | null | undefined): CharacterBook | null {
  if (!book || book.entries.length === 0) {
    return null;
  }
  return book;
}

function getSectionValue(payload: CharacterSnapshotPayload, section: SnapshotDiffEntry['section']): unknown {
  switch (section) {
    case 'image':
      return payload.imageData;
    case 'lorebook':
      return normalizeLorebook(payload.data.characterBook ?? null);
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
      return normalizeLorebook(character.data.characterBook ?? null);
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
      thumbnailData: character.thumbnailData,
      data: clonePayloadData(character.data),
    };
  }

  async buildPayloadHash(payload: CharacterSnapshotPayload): Promise<string> {
    const normalizedPayload: CharacterSnapshotPayload = {
      ...payload,
      data: {
        ...payload.data,
        characterBook: normalizeLorebook(payload.data.characterBook ?? null) ?? undefined,
      },
    };
    const serializedPayload = stableSerialize(normalizedPayload);

    if (globalThis.crypto?.subtle) {
      const payloadBytes = new TextEncoder().encode(serializedPayload);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', payloadBytes);
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    }

    return hashString(serializedPayload);
  }

  /**
   * Compute a hash of the image data for content-addressed storage
   * @param {string} imageData - Base64 image data
   * @param {string} thumbnailData - Base64 thumbnail data
   * @returns {Promise<string>} Image hash
   */
  async computeImageHash(imageData: string, thumbnailData: string): Promise<string> {
    const combined = `${imageData}:${thumbnailData}`;

    if (globalThis.crypto?.subtle) {
      const bytes = new TextEncoder().encode(combined);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    }

    return hashString(combined);
  }

  async createSnapshot(character: Character, source: SnapshotSource): Promise<CharacterSnapshot | null> {
    // 'open' snapshots are the original baseline — there should only ever be one per character.
    // If an 'open' snapshot already exists, skip creation and clean up any legacy duplicates.
    if (source === 'open') {
      const existingMetadata = await characterDb.getSnapshotMetadataForCharacter(character.id);
      const openSnapshots = existingMetadata.filter(m => m.source === 'open');

      if (openSnapshots.length > 0) {
        // Metadata is sorted newest-first; keep the oldest (last element), delete the rest.
        // Use deleteSnapshotById (no per-deletion cleanup) to avoid race conditions from
        // parallel cleanOrphanedImages calls. Cleanup runs once after all deletions.
        if (openSnapshots.length > 1) {
          const oldestId = openSnapshots[openSnapshots.length - 1].id;
          const toDelete = openSnapshots.filter(m => m.id !== oldestId);

          for (const meta of toDelete) {
            await characterDb.deleteSnapshotById(meta.id);
          }
        }

        // Repair the kept snapshot's image if it was created before content-addressed
        // storage (v4) and has a null imageHash — the image can't be resolved otherwise.
        // Note: The original image data is unrecoverable (payload stores empty string),
        // so we use the current character's image as a fallback. This may cause the diff
        // to incorrectly show "image changed" if the character's image differs from the
        // snapshot's original image.
        const kept = openSnapshots[openSnapshots.length - 1];
        if (kept.imageHash === null && character.imageData) {
          const imageHash = await this.computeImageHash(character.imageData, character.thumbnailData);
          await characterDb.repairSnapshotImage(kept.id, imageHash, character.imageData, character.thumbnailData);
        }

        // Clean up orphaned images after deletions and repair for memory efficiency.
        if (openSnapshots.length > 1) {
          await characterDb.cleanOrphanedImages(character.id);
        }

        return null;
      }
    }

    // Build the full payload (with image) for hashing
    const fullPayload: CharacterSnapshotPayload = {
      name: character.name,
      imageData: character.imageData,
      thumbnailData: character.thumbnailData,
      data: clonePayloadData(character.data),
    };
    const payloadHash = await this.buildPayloadHash(fullPayload);

    // Compute image hash for content-addressed storage
    let imageHash: string | null = null;
    if (character.imageData) {
      imageHash = await this.computeImageHash(character.imageData, character.thumbnailData);
    }

    // Store the payload with image data (the DB will store it in storedImages)
    // The payload will be stripped when stored in the snapshot table
    return characterDb.createSnapshot({
      characterId: character.id,
      source,
      payload: fullPayload,
      payloadHash,
      imageHash,
    });
  }

  async listSnapshots(characterId: string): Promise<CharacterSnapshot[]> {
    const snapshots = await characterDb.getSnapshotsForCharacter(characterId);
    return [...snapshots].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  /**
   * Get lightweight snapshot metadata for a character (excludes heavy payload)
   * Use this for timeline lists; the full payload is loaded only when needed
   * @param {string} characterId - Character ID
   * @returns {Promise<SnapshotMetadata[]>} Array of snapshot metadata
   */
  async listSnapshotMetadata(characterId: string): Promise<SnapshotMetadata[]> {
    return characterDb.getSnapshotMetadataForCharacter(characterId);
  }

  /**
   * Load the full snapshot payload from the database with resolved image data
   * Use this when you need the actual snapshot data for diff/restore
   * @param {string} snapshotId - Snapshot ID
   * @returns {Promise<CharacterSnapshot | undefined>} Full snapshot or undefined
   */
  async loadSnapshotPayload(snapshotId: string): Promise<CharacterSnapshot | undefined> {
    const snapshot = await characterDb.getSnapshotById(snapshotId);
    if (!snapshot) {
      return undefined;
    }

    // Resolve image data from content-addressed storage if needed
    if (snapshot.imageHash && !snapshot.payload.imageData) {
      const resolvedImage = await characterDb.resolveSnapshotImage(snapshot.imageHash);
      if (resolvedImage) {
        return {
          ...snapshot,
          payload: {
            ...snapshot.payload,
            imageData: resolvedImage.imageData,
            thumbnailData: resolvedImage.thumbnailData,
          },
        };
      }
    }

    return snapshot;
  }

  async deleteSnapshot(snapshot: CharacterSnapshot): Promise<void> {
    await characterDb.deleteSnapshot(snapshot.id);
  }

  /**
   * Delete a snapshot by ID
   * @param {string} snapshotId - Snapshot ID
   * @returns {Promise<void>}
   */
  async deleteSnapshotById(snapshotId: string): Promise<void> {
    await characterDb.deleteSnapshot(snapshotId);
  }

  async diffSnapshotAgainstCharacter(snapshot: CharacterSnapshot, character: Character): Promise<SnapshotDiffEntry[]> {
    const effectivePayload: CharacterSnapshotPayload = {
      ...snapshot.payload,
      imageData: snapshot.payload.imageData,
      thumbnailData: snapshot.payload.thumbnailData,
    };

    let imageResolved = Boolean(snapshot.payload.imageData);
    let imageChanged: boolean | null = null;

    if (snapshot.imageHash && character.imageData) {
      const currentImageHash = await this.computeImageHash(character.imageData, character.thumbnailData);
      imageChanged = snapshot.imageHash !== currentImageHash;
    }

    if (!imageResolved && imageChanged !== false) {
      const resolvedImage = await characterDb.resolveSnapshotImage(snapshot.imageHash);
      effectivePayload.imageData = resolvedImage?.imageData ?? '';
      effectivePayload.thumbnailData = resolvedImage?.thumbnailData ?? '';
      imageResolved = true;
      if (imageChanged === null) {
        imageChanged = stableSerialize(effectivePayload.imageData) !== stableSerialize(character.imageData);
      }
    } else if (!imageResolved && imageChanged === false) {
      effectivePayload.imageData = '';
      effectivePayload.thumbnailData = '';
    }

    return DIFFABLE_SECTIONS.map(section => {
      if (section === 'image') {
        const snapshotValue = imageResolved
          ? effectivePayload.imageData
          : '';
        const currentValue = character.imageData;
        const changed = imageChanged ?? (stableSerialize(snapshotValue) !== stableSerialize(currentValue));
        return {
          section,
          label: getSectionLabel(section),
          changed,
          snapshotValue,
          currentValue,
        };
      }

      const snapshotValue = getSectionValue(effectivePayload, section);
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

  async restoreWholeCharacter(currentCharacter: Character, snapshot: CharacterSnapshot): Promise<UpdateCharacterInput> {
    // Resolve image data from content-addressed storage
    const resolvedImage = await characterDb.resolveSnapshotImage(snapshot.imageHash);
    const imageData = resolvedImage?.imageData ?? currentCharacter.imageData;
    const thumbnailData = resolvedImage?.thumbnailData ?? currentCharacter.thumbnailData;

    return {
      name: snapshot.payload.name,
      imageData,
      thumbnailData,
      data: clonePayloadData(snapshot.payload.data),
    };
  }

  async restoreSection(currentCharacter: Character, snapshot: CharacterSnapshot, section: CharacterSection): Promise<SnapshotRestoreAction | null> {
    switch (section) {
      case 'image': {
        const resolvedImage = await characterDb.resolveSnapshotImage(snapshot.imageHash);
        const imageData = resolvedImage?.imageData ?? currentCharacter.imageData;
        return { kind: 'image', value: imageData };
      }
      case 'lorebook':
        return {
          kind: 'character',
          input: {
            data: {
              ...currentCharacter.data,
              characterBook: normalizeLorebook(clonePayloadData(snapshot.payload.data.characterBook)) ?? undefined,
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

  /**
   * Overwrite an existing snapshot's payload in place with the current
   * character's content. Preserves the snapshot's id, source, and createdAt.
   * Used to update the baseline ('open') snapshot when accepting diffs.
   * @param {string} snapshotId - Snapshot ID to overwrite
   * @param {Character} character - Current character to snapshot
   * @returns {Promise<void>}
   */
  async overwriteSnapshot(snapshotId: string, character: Character): Promise<void> {
    const fullPayload: CharacterSnapshotPayload = this.buildPayload(character);
    const payloadHash = await this.buildPayloadHash(fullPayload);

    let imageHash: string | null = null;
    if (character.imageData) {
      imageHash = await this.computeImageHash(character.imageData, character.thumbnailData);
    }

    await characterDb.overwriteSnapshotPayload(
      snapshotId,
      character.id,
      fullPayload,
      payloadHash,
      imageHash,
    );
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

  /**
   * Check if a snapshot is a baseline snapshot using metadata only
   * @param {SnapshotMetadata} metadata - Snapshot metadata
   * @returns {boolean} True if the snapshot is a baseline (open) snapshot
   */
  isBaselineSnapshotMetadata(metadata: SnapshotMetadata): boolean {
    return metadata.source === 'open';
  }

  /**
   * Compute the current character's payload hash
   * Use this to compare with snapshot payloadHash for cheap diff detection
   * @param {Character} character - Current character
   * @returns {Promise<string>} Payload hash
   */
  async computeCharacterPayloadHash(character: Character): Promise<string> {
    const payload = this.buildPayload(character);
    return this.buildPayloadHash(payload);
  }

  /**
   * Check if a snapshot matches the current character (cheap check using hashes)
   * @param {SnapshotMetadata} metadata - Snapshot metadata
   * @param {string} currentPayloadHash - Current character's payload hash
   * @returns {boolean} True if the snapshot matches the current character
   */
  snapshotMatchesCurrent(metadata: SnapshotMetadata, currentPayloadHash: string): boolean {
    return metadata.payloadHash === currentPayloadHash;
  }
}

export const characterSnapshotService = new CharacterSnapshotService();
export { CharacterSnapshotService };
