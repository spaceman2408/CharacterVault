/**
 * Vault-local character ↔ standalone lorebook attachments.
 */

import { characterDb } from '../db/CharacterDatabase';
import type {
  CharacterBook,
  CharacterListItem,
  CharacterLorebookAttachments,
  VaultLorebook,
} from '../db/characterTypes';
import { createEmptyCharacterBook } from '../db/characterTypes';
import { stableSerialize } from '../utils/snapshotCompare';
import { normalizeCardBook } from './LorebookConverter';

export interface ResolvedLorebookAttachment {
  lorebookId: string;
  lorebook: VaultLorebook | null;
  /** True when the ID is attached but the book was deleted */
  missing: boolean;
}

export function cloneLorebookEntries(book: CharacterBook): CharacterBook['entries'] {
  return (book.entries || []).map((entry) => ({
    ...entry,
    extensions: { ...entry.extensions },
    keys: [...entry.keys],
    secondary_keys: entry.secondary_keys ? [...entry.secondary_keys] : undefined,
  }));
}

export function cloneBookForEmbed(lorebook: VaultLorebook): CharacterBook {
  return {
    ...lorebook.book,
    name: lorebook.book.name || lorebook.name,
    description: lorebook.book.description ?? lorebook.description ?? '',
    entries: cloneLorebookEntries(lorebook.book),
    extensions: { ...lorebook.book.extensions },
  };
}

export function cloneEmbeddedBook(
  embeddedBook: CharacterBook | undefined,
  fallbackName: string,
): CharacterBook {
  if (!embeddedBook) {
    return createEmptyCharacterBook(fallbackName);
  }
  return {
    ...embeddedBook,
    name: (embeddedBook.name || '').trim() || fallbackName,
    description: embeddedBook.description ?? '',
    entries: cloneLorebookEntries(embeddedBook),
    extensions: { ...(embeddedBook.extensions || {}) },
  };
}

/**
 * Append the source book's entries after the target's, keeping the target's
 * book settings. Incoming ids start past the highest existing id so the
 * merged entries list after the originals.
 */
export function mergeLorebookEntries(target: CharacterBook, source: CharacterBook): CharacterBook {
  const existing = cloneLorebookEntries(target);
  let nextId = existing.reduce((max, entry) => Math.max(max, entry.id), -1) + 1;
  const incoming = cloneLorebookEntries(source).map((entry) => ({ ...entry, id: nextId++ }));
  return {
    ...target,
    entries: [...existing, ...incoming],
    extensions: { ...(target.extensions || {}) },
  };
}

export function sameLorebookContent(left: CharacterBook, right: CharacterBook): boolean {
  return stableSerialize(normalizeCardBook(left)) === stableSerialize(normalizeCardBook(right));
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

  /**
   * Create a vault book from the character's embedded lorebook and attach it
   * before returning, so the workspace linked list can load on first paint.
   */
  async createAndAttachFromEmbedded(
    characterId: string,
    embedded: CharacterBook | undefined,
    fallbackName: string,
  ): Promise<VaultLorebook> {
    const book = cloneEmbeddedBook(embedded, fallbackName);
    const created = await characterDb.createLorebook({
      name: book.name || fallbackName,
      description: book.description || '',
      book,
    });
    await this.attach(characterId, created.id);
    return created;
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

  /**
   * Characters that have this vault lorebook attached.
   * Lightweight list items only (name/thumbnail); attach is edited from the character side.
   */
  async listLinkedCharacters(lorebookId: string): Promise<CharacterListItem[]> {
    return characterDb.getCharacterListItemsLinkedToLorebook(lorebookId);
  }

  /** Badge count without loading thumbnails into memory. */
  async countLinkedCharacters(lorebookId: string): Promise<number> {
    return characterDb.countCharactersLinkedToLorebook(lorebookId);
  }

  /** All lorebook → character id links (no thumbnails). */
  async listLinkedCharacterIdsByLorebook(): Promise<Record<string, string[]>> {
    return characterDb.getLinkedCharacterIdsByLorebook();
  }

  /**
   * If this character has a vault lorebook attached, overwrite that vault book
   * and every other linked character. Does not rewrite the source character.
   */
  async syncEmbeddedIfAttached(
    characterId: string,
    embedded: CharacterBook,
    fallbackName: string,
  ): Promise<boolean> {
    const { lorebookIds } = await this.getAttachments(characterId);
    const lorebookId = lorebookIds.length > 0 ? lorebookIds[lorebookIds.length - 1] : undefined;
    if (!lorebookId) return false;
    if (!(await characterDb.hasLorebook(lorebookId))) return false;
    await this.writeEmbeddedToVault(lorebookId, embedded, fallbackName, characterId);
    return true;
  }

  /**
   * After a card save, push its lorebook to the attached vault book and the
   * other linked characters. Only pushes when the card matched the vault book
   * before this save, so a card linked without copying keeps its own entries
   * until Open in vault.
   */
  async syncSavedEmbedded(
    characterId: string,
    previous: CharacterBook | undefined,
    next: CharacterBook | undefined,
  ): Promise<boolean> {
    if (!previous || !next || sameLorebookContent(previous, next)) return false;
    const { lorebookIds } = await this.getAttachments(characterId);
    const lorebookId = lorebookIds.length > 0 ? lorebookIds[lorebookIds.length - 1] : undefined;
    if (!lorebookId) return false;
    const vault = await characterDb.getLorebook(lorebookId);
    if (!vault) return false;
    const vaultName = vault.book.name || vault.name;
    if (!sameLorebookContent(cloneEmbeddedBook(previous, vaultName), vault.book)) return false;
    await this.writeEmbeddedToVault(lorebookId, next, vaultName, characterId);
    return true;
  }

  /**
   * Overwrite a vault book with the character's current embedded lorebook.
   * Used when opening the attached book from the character editor.
   * Also pushes the new vault book to every other linked character.
   */
  async writeEmbeddedToVault(
    lorebookId: string,
    embedded: CharacterBook,
    fallbackName: string,
    exceptCharacterId?: string,
  ): Promise<VaultLorebook> {
    const book = cloneEmbeddedBook(embedded, fallbackName);
    const updated = await characterDb.updateLorebook(lorebookId, {
      book,
      name: book.name?.trim() || undefined,
      description: book.description,
    });
    await this.writeVaultToLinkedCharacters(lorebookId, updated, exceptCharacterId);
    return updated;
  }

  /**
   * Copy the vault book into every linked character's embedded lorebook.
   * Each card gets its own clone. Missing cards are skipped.
   */
  async writeVaultToLinkedCharacters(
    lorebookId: string,
    vault: VaultLorebook,
    exceptCharacterId?: string,
  ): Promise<number> {
    const characterIds = await characterDb.getCharacterIdsLinkedToLorebook(lorebookId);
    let written = 0;
    for (const characterId of characterIds) {
      if (characterId === exceptCharacterId) continue;
      const book = cloneBookForEmbed(vault);
      const exists = await characterDb.updateCharacterEmbeddedBook(characterId, book);
      if (exists) written += 1;
    }
    return written;
  }
}

export const lorebookAttachmentService = new LorebookAttachmentService();
