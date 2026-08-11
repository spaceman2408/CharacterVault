/**
 * Vault-local character ↔ standalone lorebook attachments.
 */

import { characterDb } from '../db/CharacterDatabase';
import type { CharacterLorebookAttachments, VaultLorebook } from '../db/characterTypes';

export interface ResolvedLorebookAttachment {
  lorebookId: string;
  lorebook: VaultLorebook | null;
  /** True when the ID is attached but the book was deleted */
  missing: boolean;
}

export class LorebookAttachmentService {
  async getAttachments(characterId: string): Promise<CharacterLorebookAttachments> {
    const row = await characterDb.getCharacterLorebookAttachments(characterId);
    return (
      row ?? {
        characterId,
        lorebookIds: [],
        updatedAt: new Date(0).toISOString(),
      }
    );
  }

  async setAttachments(
    characterId: string,
    lorebookIds: string[],
  ): Promise<CharacterLorebookAttachments> {
    // At most one lorebook per character (keep last unique id if multiple passed).
    const unique = [...new Set(lorebookIds)];
    const limited = unique.length > 0 ? [unique[unique.length - 1]] : [];
    return characterDb.setCharacterLorebookAttachments(characterId, limited);
  }

  /**
   * Attach a single lorebook, replacing any previous attachment.
   * Callers should prompt to copy entries into the embedded book after attach.
   */
  async attach(characterId: string, lorebookId: string): Promise<CharacterLorebookAttachments> {
    return this.setAttachments(characterId, [lorebookId]);
  }

  async detach(characterId: string, lorebookId?: string): Promise<CharacterLorebookAttachments> {
    const current = await this.getAttachments(characterId);
    if (lorebookId !== undefined && !current.lorebookIds.includes(lorebookId)) {
      return current;
    }
    return this.setAttachments(characterId, []);
  }

  async resolve(characterId: string): Promise<ResolvedLorebookAttachment[]> {
    const { lorebookIds } = await this.getAttachments(characterId);
    // Normalize legacy multi-attach rows to a single id.
    const ids = lorebookIds.length > 1 ? [lorebookIds[lorebookIds.length - 1]] : lorebookIds;
    if (lorebookIds.length > 1) {
      await this.setAttachments(characterId, ids);
    }
    const resolved = await Promise.all(
      ids.map(async (id) => {
        const lorebook = (await characterDb.getLorebook(id)) ?? null;
        return {
          lorebookId: id,
          lorebook,
          missing: lorebook === null,
        };
      }),
    );
    return resolved;
  }

  /** Load full books for AI context (skips missing). */
  async loadAttachedBooks(characterId: string): Promise<VaultLorebook[]> {
    const resolved = await this.resolve(characterId);
    return resolved
      .filter((item): item is ResolvedLorebookAttachment & { lorebook: VaultLorebook } => !!item.lorebook)
      .map((item) => item.lorebook);
  }
}

export const lorebookAttachmentService = new LorebookAttachmentService();
