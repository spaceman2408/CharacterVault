/**
 * Snapshot / history for standalone vault lorebooks.
 */

import { characterDb } from '../db/CharacterDatabase';
import { lorebookAttachmentService } from './LorebookAttachmentService';
import type {
  LorebookSnapshot,
  LorebookSnapshotMetadata,
  LorebookSnapshotPayload,
  SnapshotSource,
  VaultLorebook,
} from '../db/characterTypes';
import { createEmptyCharacterBook } from '../db/characterTypes';

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
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

export async function computeLorebookPayloadHash(payload: LorebookSnapshotPayload): Promise<string> {
  const serialized = stableSerialize(payload);
  if (globalThis.crypto?.subtle) {
    const payloadBytes = new TextEncoder().encode(serialized);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', payloadBytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return hashString(serialized);
}

export function buildLorebookSnapshotPayload(lorebook: VaultLorebook): LorebookSnapshotPayload {
  return {
    name: lorebook.name,
    description: lorebook.description,
    tags: [...(lorebook.tags ?? [])],
    book: lorebook.book ?? createEmptyCharacterBook(lorebook.name),
  };
}

export class LorebookSnapshotService {
  async createFromLorebook(
    lorebook: VaultLorebook,
    source: SnapshotSource,
  ): Promise<LorebookSnapshot | null> {
    if (source === 'open') {
      const existing = await characterDb.getLorebookSnapshotMetadata(lorebook.id);
      const openSnapshots = existing.filter((meta) => meta.source === 'open');
      if (openSnapshots.length > 0) {
        // Metadata is newest-first; keep the oldest baseline and drop leftover duplicates.
        if (openSnapshots.length > 1) {
          const oldestId = openSnapshots[openSnapshots.length - 1].id;
          for (const meta of openSnapshots) {
            if (meta.id !== oldestId) {
              await characterDb.deleteLorebookSnapshot(meta.id);
            }
          }
        }
        return null;
      }
    }

    const payload = buildLorebookSnapshotPayload(lorebook);
    const payloadHash = await computeLorebookPayloadHash(payload);
    return characterDb.createLorebookSnapshot({
      lorebookId: lorebook.id,
      source,
      payload,
      payloadHash,
    });
  }

  async listMetadata(lorebookId: string): Promise<LorebookSnapshotMetadata[]> {
    return characterDb.getLorebookSnapshotMetadata(lorebookId);
  }

  async getById(snapshotId: string): Promise<LorebookSnapshot | undefined> {
    return characterDb.getLorebookSnapshotById(snapshotId);
  }

  async delete(snapshotId: string): Promise<void> {
    const existing = await characterDb.getLorebookSnapshotById(snapshotId);
    if (existing?.source === 'open') {
      throw new Error('The opened baseline cannot be deleted');
    }
    return characterDb.deleteLorebookSnapshot(snapshotId);
  }

  /**
   * Overwrite the opened baseline in place with the current lorebook.
   * Skips when the payload already matches.
   */
  async overwriteBaseline(
    lorebook: VaultLorebook,
    snapshotId: string,
  ): Promise<'updated' | 'skipped'> {
    const existing = await characterDb.getLorebookSnapshotById(snapshotId);
    if (!existing) {
      throw new Error('Snapshot not found');
    }
    if (existing.source !== 'open') {
      throw new Error('Only the opened baseline can be updated');
    }

    const payload = buildLorebookSnapshotPayload(lorebook);
    const payloadHash = await computeLorebookPayloadHash(payload);
    if (existing.payloadHash === payloadHash) {
      return 'skipped';
    }

    await characterDb.overwriteLorebookSnapshot(snapshotId, payload, payloadHash);
    return 'updated';
  }

  /**
   * Restore a snapshot onto the live lorebook, then write a rollback snapshot of the result.
   */
  async restore(snapshotId: string): Promise<VaultLorebook> {
    const snapshot = await characterDb.getLorebookSnapshotById(snapshotId);
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    const updated = await characterDb.updateLorebook(snapshot.lorebookId, {
      name: snapshot.payload.name,
      description: snapshot.payload.description,
      tags: snapshot.payload.tags,
      book: snapshot.payload.book,
    });

    await lorebookAttachmentService.writeVaultToLinkedCharacters(updated.id, updated);
    await this.createFromLorebook(updated, 'rollback');
    return updated;
  }
}

export const lorebookSnapshotService = new LorebookSnapshotService();
