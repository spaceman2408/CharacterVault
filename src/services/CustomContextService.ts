/**
 * @fileoverview Vault-local custom AI context per character or standalone lorebook.
 * Full body stays in IndexedDB; callers load it only when editing or building AI requests.
 * @module services/CustomContextService
 */

import type {
  CharacterCustomContext,
  CustomContextMeta,
  LorebookCustomContext,
} from '../db/characterTypes';
import { EMPTY_CUSTOM_CONTEXT_META } from '../db/characterTypes';
import { characterDb } from '../db';
import { BYTES_PER_TOKEN, estimateTokens } from './AIService';

export type CustomContextOwner = 'character' | 'lorebook';

type CustomContextRow = CharacterCustomContext | LorebookCustomContext;

/** Header used when appending custom context to AI request chunks. */
export const CUSTOM_CONTEXT_HEADER = 'Custom Context:';

export function formatCustomContextChunk(content: string): string {
  return `${CUSTOM_CONTEXT_HEADER}\n${content}`;
}

/**
 * Approximate token count for usage UI when the body is not loaded.
 * Uses stored char length (ASCII-leaning) plus the fixed header overhead.
 */
export function estimateCustomContextTokensFromCharLength(charLength: number): number {
  if (charLength <= 0) return 0;
  const headerTokens = estimateTokens(`${CUSTOM_CONTEXT_HEADER}\n`);
  return headerTokens + Math.ceil(charLength / BYTES_PER_TOKEN);
}

function tableFor(owner: CustomContextOwner) {
  return owner === 'character'
    ? characterDb.characterCustomContext
    : characterDb.lorebookCustomContext;
}

function toMeta(row: CustomContextRow | undefined): CustomContextMeta {
  if (!row) return { ...EMPTY_CUSTOM_CONTEXT_META };
  return {
    enabled: row.enabled,
    charLength: row.charLength,
    updatedAt: row.updatedAt,
  };
}

export class CustomContextService {
  /**
   * Metadata only for UI. IndexedDB still deserializes the full row; we map and
   * drop the body reference so callers never receive content.
   */
  async getMeta(
    ownerId: string,
    owner: CustomContextOwner = 'character',
  ): Promise<CustomContextMeta> {
    const row = await tableFor(owner).get(ownerId);
    if (!row) return { ...EMPTY_CUSTOM_CONTEXT_META };
    const meta = toMeta(row);
    row.content = '';
    return meta;
  }

  /**
   * Load full body for edit modal or AI assembly. Do not cache the result in
   * long-lived React context.
   */
  async getContent(
    ownerId: string,
    owner: CustomContextOwner = 'character',
  ): Promise<string | null> {
    const row = await tableFor(owner).get(ownerId);
    if (!row || row.charLength === 0) return null;
    const content = row.content;
    row.content = '';
    return content;
  }

  /**
   * Load enabled body for AI (null if disabled or empty).
   */
  async getEnabledContent(
    ownerId: string,
    owner: CustomContextOwner = 'character',
  ): Promise<string | null> {
    const row = await tableFor(owner).get(ownerId);
    if (!row || !row.enabled || row.charLength === 0) return null;
    const content = row.content;
    row.content = '';
    if (!content.trim()) return null;
    return content;
  }

  async save(
    ownerId: string,
    input: { content: string; enabled: boolean },
    owner: CustomContextOwner = 'character',
  ): Promise<CustomContextMeta> {
    const content = input.content;
    const charLength = content.length;
    const updatedAt = new Date().toISOString();
    const table = tableFor(owner);

    if (charLength === 0) {
      await table.delete(ownerId);
      return { ...EMPTY_CUSTOM_CONTEXT_META };
    }

    if (owner === 'character') {
      await characterDb.characterCustomContext.put({
        characterId: ownerId,
        content,
        enabled: input.enabled,
        updatedAt,
        charLength,
      });
    } else {
      await characterDb.lorebookCustomContext.put({
        lorebookId: ownerId,
        content,
        enabled: input.enabled,
        updatedAt,
        charLength,
      });
    }
    return {
      enabled: input.enabled,
      charLength,
      updatedAt,
    };
  }

  /**
   * Toggle inclusion without reading or rewriting the body blob.
   * @returns true if a row was updated
   */
  async setEnabled(
    ownerId: string,
    enabled: boolean,
    owner: CustomContextOwner = 'character',
  ): Promise<boolean> {
    const updatedCount = await tableFor(owner).update(ownerId, {
      enabled,
      updatedAt: new Date().toISOString(),
    });
    return updatedCount > 0;
  }

  async clear(
    ownerId: string,
    owner: CustomContextOwner = 'character',
  ): Promise<void> {
    await tableFor(owner).delete(ownerId);
  }
}

export const customContextService = new CustomContextService();
