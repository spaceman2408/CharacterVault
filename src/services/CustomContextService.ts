/**
 * @fileoverview Vault-local custom AI context per character.
 * Full body stays in IndexedDB; callers load it only when editing or building AI requests.
 * @module services/CustomContextService
 */

import type {
  CharacterCustomContext,
  CustomContextMeta,
} from '../db/characterTypes';
import { EMPTY_CUSTOM_CONTEXT_META } from '../db/characterTypes';
import { characterDb } from '../db';
import { BYTES_PER_TOKEN, estimateTokens } from './AIService';

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

function toMeta(row: CharacterCustomContext | undefined): CustomContextMeta {
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
  async getMeta(characterId: string): Promise<CustomContextMeta> {
    const row = await characterDb.characterCustomContext.get(characterId);
    if (!row) return { ...EMPTY_CUSTOM_CONTEXT_META };
    const meta = toMeta(row);
    // Drop the large string on the local object so it is not retained by this frame
    row.content = '';
    return meta;
  }

  /**
   * Load full body for edit modal or AI assembly. Do not cache the result in
   * long-lived React context.
   */
  async getContent(characterId: string): Promise<string | null> {
    const row = await characterDb.characterCustomContext.get(characterId);
    if (!row || row.charLength === 0) return null;
    const content = row.content;
    row.content = '';
    return content;
  }

  /**
   * Load enabled body for AI (null if disabled or empty).
   */
  async getEnabledContent(characterId: string): Promise<string | null> {
    const row = await characterDb.characterCustomContext.get(characterId);
    if (!row || !row.enabled || row.charLength === 0) return null;
    const content = row.content;
    row.content = '';
    if (!content.trim()) return null;
    return content;
  }

  async save(
    characterId: string,
    input: { content: string; enabled: boolean }
  ): Promise<CustomContextMeta> {
    const content = input.content;
    const charLength = content.length;
    const updatedAt = new Date().toISOString();

    if (charLength === 0) {
      await characterDb.characterCustomContext.delete(characterId);
      return { ...EMPTY_CUSTOM_CONTEXT_META };
    }

    const row: CharacterCustomContext = {
      characterId,
      content,
      enabled: input.enabled,
      updatedAt,
      charLength,
    };
    await characterDb.characterCustomContext.put(row);
    // Return meta only; do not keep row (with body) alive via the return path
    return {
      enabled: row.enabled,
      charLength: row.charLength,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Toggle inclusion without reading or rewriting the body blob.
   * @returns true if a row was updated
   */
  async setEnabled(characterId: string, enabled: boolean): Promise<boolean> {
    const updatedCount = await characterDb.characterCustomContext.update(characterId, {
      enabled,
      updatedAt: new Date().toISOString(),
    });
    return updatedCount > 0;
  }

  async clear(characterId: string): Promise<void> {
    await characterDb.characterCustomContext.delete(characterId);
  }
}

export const customContextService = new CustomContextService();
