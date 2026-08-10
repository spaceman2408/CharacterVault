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
    return characterDb.setCharacterLorebookAttachments(characterId, lorebookIds);
  }

  async attach(characterId: string, lorebookId: string): Promise<CharacterLorebookAttachments> {
    const current = await this.getAttachments(characterId);
    if (current.lorebookIds.includes(lorebookId)) {
      return current;
    }
    return this.setAttachments(characterId, [...current.lorebookIds, lorebookId]);
  }

  async detach(characterId: string, lorebookId: string): Promise<CharacterLorebookAttachments> {
    const current = await this.getAttachments(characterId);
    return this.setAttachments(
      characterId,
      current.lorebookIds.filter((id) => id !== lorebookId),
    );
  }

  async resolve(characterId: string): Promise<ResolvedLorebookAttachment[]> {
    const { lorebookIds } = await this.getAttachments(characterId);
    const resolved = await Promise.all(
      lorebookIds.map(async (lorebookId) => {
        const lorebook = (await characterDb.getLorebook(lorebookId)) ?? null;
        return {
          lorebookId,
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
