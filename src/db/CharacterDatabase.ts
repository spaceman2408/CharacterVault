/**
 * @fileoverview Database class for CharacterVault.
 * Manages characters in IndexedDB.
 * @module @db/CharacterDatabase
 */

import Dexie, { type Table } from 'dexie';
import type {
  Character,
  CharacterSnapshot,
  CharacterSnapshotPayload,
  CharacterVaultSettings,
  CreateSnapshotInput,
  CreateCharacterInput,
  UpdateCharacterInput,
  SnapshotMetadata,
  CharacterListItem,
  SpellDictionaryCacheEntry,
  StoredImage,
  CharacterCustomContext,
  LorebookCustomContext,
  VaultLorebook,
  LorebookListItem,
  LorebookSnapshot,
  CreateLorebookSnapshotInput,
  LorebookSnapshotMetadata,
  CreateVaultLorebookInput,
  UpdateVaultLorebookInput,
  CharacterLorebookAttachments,
  CharacterBook,
} from './characterTypes';
import { DEFAULT_CHARACTER_VAULT_SETTINGS, createEmptyCharacterBook } from './characterTypes';
import { estimateCharacterCardTokens, estimateTokens } from '../services/AIService';
import { v4 as uuidv4 } from 'uuid';

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

async function computeSnapshotPayloadHash(payload: CharacterSnapshot['payload']): Promise<string> {
  const serializedPayload = stableSerialize(payload);

  if (globalThis.crypto?.subtle) {
    const payloadBytes = new TextEncoder().encode(serializedPayload);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', payloadBytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  return hashString(serializedPayload);
}

/**
 * Build a lightweight vault-list row from a full character.
 * Keeps thumbnails + token estimates without retaining imageData / lorebook blobs in React state.
 */
export function toCharacterListItem(character: Character): CharacterListItem {
  const tokens = estimateCharacterCardTokens(character.data, character.name);
  return {
    id: character.id,
    name: character.name,
    thumbnailData: character.thumbnailData,
    lastOpenedAt: character.lastOpenedAt,
    updatedAt: character.updatedAt,
    activeTokens: tokens.active,
    totalTokens: tokens.total,
    tags: character.data.spec.tags ?? [],
  };
}

/** Estimate total tokens for a character book body (entry contents only). */
export function estimateLorebookTokens(book: CharacterBook): number {
  return book.entries.reduce((sum, entry) => sum + estimateTokens(entry.content || ''), 0);
}

/**
 * Build a lightweight vault-list row from a full standalone lorebook.
 */
export function toLorebookListItem(lorebook: VaultLorebook): LorebookListItem {
  return {
    id: lorebook.id,
    name: lorebook.name,
    description: lorebook.description,
    tags: lorebook.tags ?? [],
    entryCount: lorebook.book?.entries?.length ?? 0,
    totalTokens: estimateLorebookTokens(lorebook.book ?? createEmptyCharacterBook()),
    updatedAt: lorebook.updatedAt,
    lastOpenedAt: lorebook.lastOpenedAt,
  };
}

/**
 * Database class for CharacterVault.
 * Single database storing all characters and settings.
 */
export class CharacterDatabase extends Dexie {
  /** Table storing characters */
  characters!: Table<Character, string>;

  /** Table storing snapshots */
  snapshots!: Table<CharacterSnapshot, string>;

  /** Table storing settings */
  settings!: Table<CharacterVaultSettings, string>;

  /** Table storing images - content-addressed storage */
  storedImages!: Table<StoredImage, string>;

  /** Table storing cached spellcheck dictionary blobs */
  spellDictionaryCache!: Table<SpellDictionaryCacheEntry, string>;

  /**
   * Lightweight vault index — no full imageData / character JSON.
   * Vault UI reads only this table so large lorebooks/images stay on disk until opened.
   */
  characterListIndex!: Table<CharacterListItem, string>;

  /** Per-character vault-local custom AI context (1:1 with character) */
  characterCustomContext!: Table<CharacterCustomContext, string>;

  /** Per-lorebook vault-local custom AI context (1:1 with standalone book) */
  lorebookCustomContext!: Table<LorebookCustomContext, string>;

  /** Standalone lorebooks (world info library) */
  lorebooks!: Table<VaultLorebook, string>;

  /** Lightweight lorebook vault index */
  lorebookListIndex!: Table<LorebookListItem, string>;

  /** Snapshots for standalone lorebooks */
  lorebookSnapshots!: Table<LorebookSnapshot, string>;

  /** Character → standalone lorebook attach list (vault-local) */
  characterLorebookAttachments!: Table<CharacterLorebookAttachments, string>;

  constructor() {
    super('character-vault-db');

    this.version(1).stores({
      // Characters indexed by name for search, updatedAt for sorting
      characters: 'id, name, updatedAt, createdAt',

      // Single settings record
      settings: 'id',
    });

    this.version(2).stores({
      characters: 'id, name, updatedAt, createdAt',
      settings: 'id',
      snapshots: 'id, characterId, createdAt, [characterId+createdAt]',
    });

    this.version(3).stores({
      characters: 'id, name, updatedAt, createdAt',
      settings: 'id',
      snapshots: 'id, characterId, createdAt, [characterId+createdAt]',
    }).upgrade(async (tx) => {
      const snapshots = await tx.table<CharacterSnapshot, string>('snapshots').toArray();

      await Promise.all(snapshots.map(async (snapshot) => {
        const compactPayloadHash = await computeSnapshotPayloadHash(snapshot.payload);
        if (snapshot.payloadHash !== compactPayloadHash) {
          await tx.table<CharacterSnapshot, string>('snapshots').put({
            ...snapshot,
            payloadHash: compactPayloadHash,
          });
        }
      }));
    });

    // Version 4: Add thumbnailData field and storedImages table (no migration needed - app is unreleased)
    this.version(4).stores({
      characters: 'id, name, updatedAt, createdAt',
      settings: 'id',
      snapshots: 'id, characterId, createdAt, [characterId+createdAt]',
      storedImages: 'id',
    });

    // Version 5: Add spellDictionaryCache table for spellcheck dictionary blobs
    this.version(5).stores({
      characters: 'id, name, updatedAt, createdAt',
      settings: 'id',
      snapshots: 'id, characterId, createdAt, [characterId+createdAt]',
      storedImages: 'id',
      spellDictionaryCache: 'id',
    });

    // Version 6: Lightweight vault list index (avoids loading full cards on home)
    this.version(6)
      .stores({
        characters: 'id, name, updatedAt, createdAt',
        settings: 'id',
        snapshots: 'id, characterId, createdAt, [characterId+createdAt]',
        storedImages: 'id',
        spellDictionaryCache: 'id',
        characterListIndex: 'id, name, updatedAt, lastOpenedAt',
      })
      .upgrade(async (tx) => {
        const indexTable = tx.table<CharacterListItem, string>('characterListIndex');
        // Stream characters one-by-one so peak memory stays lower during migration
        await tx
          .table<Character, string>('characters')
          .toCollection()
          .each(async (character) => {
            await indexTable.put(toCharacterListItem(character));
          });
      });

    // Version 7: Per-character custom AI context (vault-local, not card export)
    this.version(7).stores({
      characters: 'id, name, updatedAt, createdAt',
      settings: 'id',
      snapshots: 'id, characterId, createdAt, [characterId+createdAt]',
      storedImages: 'id',
      spellDictionaryCache: 'id',
      characterListIndex: 'id, name, updatedAt, lastOpenedAt',
      characterCustomContext: 'characterId',
    });

    // Version 8: Standalone lorebook vault + snapshots + character attach links
    this.version(8).stores({
      characters: 'id, name, updatedAt, createdAt',
      settings: 'id',
      snapshots: 'id, characterId, createdAt, [characterId+createdAt]',
      storedImages: 'id',
      spellDictionaryCache: 'id',
      characterListIndex: 'id, name, updatedAt, lastOpenedAt',
      characterCustomContext: 'characterId',
      lorebooks: 'id, name, updatedAt, createdAt',
      lorebookListIndex: 'id, name, updatedAt, lastOpenedAt',
      lorebookSnapshots: 'id, lorebookId, createdAt, [lorebookId+createdAt]',
      characterLorebookAttachments: 'characterId',
    });

    // Version 9: Per-lorebook custom AI context (vault-local, not book export)
    this.version(9).stores({
      characters: 'id, name, updatedAt, createdAt',
      settings: 'id',
      snapshots: 'id, characterId, createdAt, [characterId+createdAt]',
      storedImages: 'id',
      spellDictionaryCache: 'id',
      characterListIndex: 'id, name, updatedAt, lastOpenedAt',
      characterCustomContext: 'characterId',
      lorebooks: 'id, name, updatedAt, createdAt',
      lorebookListIndex: 'id, name, updatedAt, lastOpenedAt',
      lorebookSnapshots: 'id, lorebookId, createdAt, [lorebookId+createdAt]',
      characterLorebookAttachments: 'characterId',
      lorebookCustomContext: 'lorebookId',
    });
  }

  private async syncLorebookListIndex(lorebook: VaultLorebook): Promise<void> {
    await this.lorebookListIndex.put(toLorebookListItem(lorebook));
  }

  /** Upsert the vault list row for a character (call after any write). */
  private async syncCharacterListIndex(character: Character): Promise<void> {
    await this.characterListIndex.put(toCharacterListItem(character));
  }

  // ============================================================================
  // Character Operations
  // ============================================================================

  /**
   * Get all characters sorted by last opened (most recent first)
   * @returns {Promise<Character[]>} Array of characters
   */
  async getAllCharacters(): Promise<Character[]> {
    return this.characters
      .orderBy('updatedAt')
      .reverse()
      .toArray();
  }

  /**
   * Yield every full character one at a time (by primary key).
   * Prefer this over getAllCharacters() when building exports so peak heap
   * stays near one card (+ output buffers) instead of the whole vault.
   */
  async *iterateAllCharacters(): AsyncGenerator<Character, void, undefined> {
    const ids = await this.characters.orderBy('updatedAt').reverse().primaryKeys();
    for (const id of ids) {
      const character = await this.characters.get(id);
      if (character) {
        yield character;
      }
    }
  }

  /**
   * Yield every standalone lorebook one at a time (by primary key).
   * Prefer this over loading the full table when building vault backups.
   */
  async *iterateAllLorebooks(): AsyncGenerator<VaultLorebook, void, undefined> {
    const ids = await this.lorebooks.orderBy('updatedAt').reverse().primaryKeys();
    for (const id of ids) {
      const lorebook = await this.lorebooks.get(id);
      if (lorebook) {
        yield lorebook;
      }
    }
  }

  /**
   * Get lightweight list items for vault view.
   * Reads `characterListIndex` only — never loads full cards (imageData / lorebook).
   */
  async getAllCharacterListItems(): Promise<CharacterListItem[]> {
    // Backfill if index is empty but characters exist (edge case / failed migration)
    const indexCount = await this.characterListIndex.count();
    if (indexCount === 0) {
      const charCount = await this.characters.count();
      if (charCount > 0) {
        await this.rebuildCharacterListIndex();
      }
    }

    return this.characterListIndex.orderBy('updatedAt').reverse().toArray();
  }

  /** Rebuild the entire vault list index from full character records. */
  async rebuildCharacterListIndex(): Promise<void> {
    await this.transaction('rw', this.characters, this.characterListIndex, async () => {
      await this.characterListIndex.clear();
      await this.characters.toCollection().each(async (character) => {
        await this.characterListIndex.put(toCharacterListItem(character));
      });
    });
  }

  /**
   * Get a character by ID
   * @param {string} id - Character ID
   * @returns {Promise<Character | undefined>} Character or undefined
   */
  async getCharacter(id: string): Promise<Character | undefined> {
    return this.characters.get(id);
  }

  /**
   * Search characters by name
   * @param {string} query - Search query
   * @returns {Promise<Character[]>} Array of matching characters
   */
  async searchCharacters(query: string): Promise<Character[]> {
    const lowerQuery = query.toLowerCase();
    return this.characters
      .filter(char => {
        if (char.name.toLowerCase().includes(lowerQuery)) return true;
        const tags = char.data.spec.tags ?? [];
        return tags.some(tag => tag.toLowerCase().includes(lowerQuery));
      })
      .toArray();
  }

  /**
   * Create a new character
   * @param {CreateCharacterInput} input - Character creation input
   * @returns {Promise<Character>} Created character
   */
  async createCharacter(input: CreateCharacterInput): Promise<Character> {
    const timestamp = new Date().toISOString();
    const id = uuidv4();

    const character: Character = {
      id,
      name: input.name,
      imageData: input.imageData || '',
      thumbnailData: input.thumbnailData || '',
      data: {
        spec: {
          name: input.name,
          description: input.data?.spec?.description || '',
          personality: input.data?.spec?.personality || '',
          scenario: input.data?.spec?.scenario || '',
          first_mes: input.data?.spec?.first_mes || '',
          mes_example: input.data?.spec?.mes_example || '',
          system_prompt: input.data?.spec?.system_prompt || '',
          post_history_instructions: input.data?.spec?.post_history_instructions || '',
          alternate_greetings: input.data?.spec?.alternate_greetings || [],
          physical_description: input.data?.spec?.physical_description || '',
          // V3 spec fields
          avatar: input.data?.spec?.avatar,
          creator_notes: input.data?.spec?.creator_notes,
          creator: input.data?.spec?.creator,
          character_version: input.data?.spec?.character_version,
          tags: input.data?.spec?.tags,
        },
        characterBook: input.data?.characterBook,
        extensions: input.data?.extensions || {},
      },
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
    };

    await this.transaction('rw', this.characters, this.characterListIndex, async () => {
      await this.characters.add(character);
      await this.syncCharacterListIndex(character);
    });
    return character;
  }

  /**
   * Update a character
   * @param {string} id - Character ID
   * @param {UpdateCharacterInput} input - Update input
   * @returns {Promise<Character>} Updated character
   */
  async updateCharacter(id: string, input: UpdateCharacterInput): Promise<Character> {
    const character = await this.characters.get(id);
    if (!character) {
      throw new Error(`Character with ID "${id}" not found`);
    }

    const timestamp = new Date().toISOString();

    const updatedCharacter: Character = {
      ...character,
      name: input.name ?? character.name,
      imageData: input.imageData ?? character.imageData,
      thumbnailData: input.thumbnailData ?? character.thumbnailData,
      data: {
        spec: {
          ...character.data.spec,
          ...input.data?.spec,
        },
        characterBook: input.data && 'characterBook' in input.data
          ? input.data.characterBook
          : character.data.characterBook,
        extensions: input.data?.extensions ?? character.data.extensions,
      },
      updatedAt: timestamp,
    };

    await this.transaction('rw', this.characters, this.characterListIndex, async () => {
      await this.characters.put(updatedCharacter);
      await this.syncCharacterListIndex(updatedCharacter);
    });
    return updatedCharacter;
  }

  /**
   * Update a specific spec field
   * @param {string} id - Character ID
   * @param {string} field - Spec field name
   * @param {string | string[]} value - New value
   * @returns {Promise<Character>} Updated character
   */
  async updateSpecField(
    id: string,
    field: keyof Character['data']['spec'],
    value: string | string[]
  ): Promise<Character> {
    const character = await this.characters.get(id);
    if (!character) {
      throw new Error(`Character with ID "${id}" not found`);
    }

    const timestamp = new Date().toISOString();

    const updatedCharacter: Character = {
      ...character,
      name: field === 'name' && typeof value === 'string' ? value : character.name,
      data: {
        ...character.data,
        spec: {
          ...character.data.spec,
          [field]: value,
        },
      },
      updatedAt: timestamp,
    };

    await this.transaction('rw', this.characters, this.characterListIndex, async () => {
      await this.characters.put(updatedCharacter);
      await this.syncCharacterListIndex(updatedCharacter);
    });
    return updatedCharacter;
  }

  /**
   * Update character image
   * @param {string} id - Character ID
   * @param {string} imageData - Base64 image data
   * @returns {Promise<Character>} Updated character
   */
  async updateCharacterImage(id: string, imageData: string): Promise<Character> {
    return this.updateCharacter(id, { imageData });
  }

  /**
   * Delete a character
   * @param {string} id - Character ID
   * @returns {Promise<void>}
   */
  async deleteCharacter(id: string): Promise<void> {
    await this.transaction(
      'rw',
      [
        this.characters,
        this.snapshots,
        this.characterListIndex,
        this.characterCustomContext,
        this.characterLorebookAttachments,
      ],
      async () => {
        await this.characters.delete(id);
        await this.characterListIndex.delete(id);
        await this.snapshots.where('characterId').equals(id).delete();
        await this.characterCustomContext.delete(id);
        await this.characterLorebookAttachments.delete(id);
      }
    );
  }

  /**
   * Duplicate a character
   * @param {string} id - Character ID to duplicate
   * @param {string} newName - Name for the duplicate
   * @returns {Promise<Character>} Duplicated character
   */
  async duplicateCharacter(id: string, newName: string): Promise<Character> {
    const character = await this.characters.get(id);
    if (!character) {
      throw new Error(`Character with ID "${id}" not found`);
    }

    const timestamp = new Date().toISOString();
    const newId = uuidv4();

    const duplicatedCharacter: Character = {
      ...character,
      id: newId,
      name: newName,
      data: {
        ...character.data,
        spec: {
          ...character.data.spec,
          name: newName,
        },
      },
      createdAt: timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
    };

    await this.transaction(
      'rw',
      this.characters,
      this.characterListIndex,
      this.characterCustomContext,
      async () => {
        await this.characters.add(duplicatedCharacter);
        await this.syncCharacterListIndex(duplicatedCharacter);

        const customContext = await this.characterCustomContext.get(id);
        if (customContext) {
          await this.characterCustomContext.put({
            ...customContext,
            characterId: newId,
            updatedAt: timestamp,
          });
        }
      }
    );
    return duplicatedCharacter;
  }

  /**
   * Update last opened timestamp on the character and vault list index.
   * @returns ISO timestamp written (for in-memory list patches without a full reload)
   */
  async updateLastOpened(id: string): Promise<string> {
    const timestamp = new Date().toISOString();
    await this.transaction('rw', this.characters, this.characterListIndex, async () => {
      await this.characters.update(id, { lastOpenedAt: timestamp });
      // Patch index only — avoid loading the full card just for a timestamp
      const existing = await this.characterListIndex.get(id);
      if (existing) {
        await this.characterListIndex.put({ ...existing, lastOpenedAt: timestamp });
      }
    });
    return timestamp;
  }

  // ============================================================================
  // Settings Operations
  // ============================================================================

  /**
   * Get application settings
   * @returns {Promise<CharacterVaultSettings>} Settings
   */
  async getSettings(): Promise<CharacterVaultSettings> {
    const settings = await this.settings.get('app-settings');
    if (!settings) {
      // Initialize default settings
      const defaultSettings: CharacterVaultSettings = {
        ...DEFAULT_CHARACTER_VAULT_SETTINGS,
        id: 'app-settings',
      };
      await this.settings.add(defaultSettings);
      return defaultSettings;
    }
    return settings;
  }

  /**
   * Update application settings
   * @param {Partial<CharacterVaultSettings>} updates - Settings updates
   * @returns {Promise<CharacterVaultSettings>} Updated settings
   */
  async updateSettings(
    updates: Partial<Omit<CharacterVaultSettings, 'id'>>
  ): Promise<CharacterVaultSettings> {
    const settings = await this.getSettings();
    const updatedSettings: CharacterVaultSettings = {
      ...settings,
      ...updates,
      ui: {
        ...settings.ui,
        ...updates.ui,
      },
    };
    await this.settings.put(updatedSettings);
    return updatedSettings;
  }

  // ============================================================================
  // Import/Export Operations
  // ============================================================================

  /**
   * Import a character from parsed data
   * @param {Partial<Character>} characterData - Character data to import
   * @returns {Promise<Character>} Imported character
   */
  async importCharacter(characterData: Partial<Character>): Promise<Character> {
    const timestamp = new Date().toISOString();
    const id = uuidv4();

    const character: Character = {
      id,
      name: characterData.name || 'Imported Character',
      imageData: characterData.imageData || '',
      thumbnailData: characterData.thumbnailData || '',
      data: {
        spec: {
          name: characterData.data?.spec?.name || characterData.name || 'Imported Character',
          description: characterData.data?.spec?.description || '',
          personality: characterData.data?.spec?.personality || '',
          scenario: characterData.data?.spec?.scenario || '',
          first_mes: characterData.data?.spec?.first_mes || '',
          mes_example: characterData.data?.spec?.mes_example || '',
          system_prompt: characterData.data?.spec?.system_prompt || '',
          post_history_instructions: characterData.data?.spec?.post_history_instructions || '',
          alternate_greetings: characterData.data?.spec?.alternate_greetings || [],
          physical_description: characterData.data?.spec?.physical_description || '',
          // V3 spec fields
          avatar: characterData.data?.spec?.avatar,
          creator_notes: characterData.data?.spec?.creator_notes,
          creator: characterData.data?.spec?.creator,
          character_version: characterData.data?.spec?.character_version,
          tags: characterData.data?.spec?.tags,
        },
        characterBook: characterData.data?.characterBook,
        extensions: characterData.data?.extensions || {},
      },
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
    };

    await this.transaction('rw', this.characters, this.characterListIndex, async () => {
      await this.characters.add(character);
      await this.syncCharacterListIndex(character);
    });
    return character;
  }

  // ============================================================================
  // Snapshot Operations
  // ============================================================================

  async createSnapshot(input: CreateSnapshotInput): Promise<CharacterSnapshot | null> {
    const latestSnapshot = await this.getLatestSnapshot(input.characterId);
    if (latestSnapshot?.payloadHash === input.payloadHash) {
      return null;
    }

    // Create snapshot with empty image data in payload (stored separately in storedImages)
    const snapshot: CharacterSnapshot = {
      id: uuidv4(),
      characterId: input.characterId,
      source: input.source,
      createdAt: new Date().toISOString(),
      payload: {
        ...input.payload,
        imageData: '', // Stored in storedImages via imageHash
        thumbnailData: '',
      },
      payloadHash: input.payloadHash,
      imageHash: input.imageHash,
    };

    await this.transaction('rw', this.snapshots, this.storedImages, async () => {
      // Store the image in content-addressed storage if provided
      if (input.imageHash && input.payload.imageData) {
        await this.storedImages.put({
          id: input.imageHash,
          imageData: input.payload.imageData,
          thumbnailData: input.payload.thumbnailData,
        });
      }

      await this.snapshots.add(snapshot);
      await this.pruneSnapshotsForCharacter(input.characterId, 10);
    });

    return snapshot;
  }

  async getSnapshotsForCharacter(characterId: string): Promise<CharacterSnapshot[]> {
    const snapshots = await this.snapshots
      .where('characterId')
      .equals(characterId)
      .sortBy('createdAt');
    return snapshots.reverse();
  }

  async getLatestSnapshot(characterId: string): Promise<CharacterSnapshot | undefined> {
    const snapshots = await this.snapshots
      .where('characterId')
      .equals(characterId)
      .sortBy('createdAt');
    return snapshots.at(-1);
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    const snapshot = await this.snapshots.get(snapshotId);
    if (!snapshot) {
      return;
    }

    await this.transaction('rw', this.snapshots, this.storedImages, async () => {
      await this.snapshots.delete(snapshotId);
      await this.cleanOrphanedImages(snapshot.characterId);
    });
  }

  async pruneSnapshotsForCharacter(characterId: string, limit: number): Promise<void> {
    const snapshots = await this.snapshots
      .where('characterId')
      .equals(characterId)
      .sortBy('createdAt');

    if (snapshots.length <= limit) {
      return;
    }

    const snapshotsToDelete = snapshots.slice(0, snapshots.length - limit);
    await this.transaction('rw', this.snapshots, this.storedImages, async () => {
      await Promise.all(snapshotsToDelete.map(snapshot => this.snapshots.delete(snapshot.id)));
      await this.cleanOrphanedImages(characterId);
    });
  }

  /**
   * Get lightweight snapshot metadata for a character (excludes heavy payload)
   * Use this for timeline lists; load full payload only when needed
   * @param {string} characterId - Character ID
   * @returns {Promise<SnapshotMetadata[]>} Array of snapshot metadata, sorted newest first
   */
  async getSnapshotMetadataForCharacter(characterId: string): Promise<SnapshotMetadata[]> {
    const snapshots = await this.snapshots
      .where('characterId')
      .equals(characterId)
      .sortBy('createdAt');
    return snapshots.reverse().map(({ id, characterId: cId, source, createdAt, payloadHash, imageHash }) => ({
      id,
      characterId: cId,
      source,
      createdAt,
      payloadHash,
      imageHash,
    }));
  }

  /**
   * Resolve the actual image data for a snapshot from the storedImages table
   * @param {string} imageHash - The image hash stored on the snapshot
   * @returns {Promise<{ imageData: string; thumbnailData: string } | null>} Image data or null
   */
  async resolveSnapshotImage(imageHash: string | null): Promise<{ imageData: string; thumbnailData: string } | null> {
    if (!imageHash) {
      return null;
    }
    const storedImage = await this.storedImages.get(imageHash);
    if (!storedImage) {
      return null;
    }
    return { imageData: storedImage.imageData, thumbnailData: storedImage.thumbnailData };
  }

  /**
   * Clean up orphaned stored images that are no longer referenced by any snapshot
   * @param {string} characterId - The character ID to check (optional - if not provided, checks all)
   * @returns {Promise<void>}
   */
  async cleanOrphanedImages(characterId?: string): Promise<void> {
    let snapshots: CharacterSnapshot[];

    if (characterId) {
      snapshots = await this.snapshots
        .where('characterId')
        .equals(characterId)
        .toArray();
    } else {
      snapshots = await this.snapshots.toArray();
    }

    // Get all image hashes that are still referenced
    const referencedHashes = new Set(
      snapshots.map(s => s.imageHash).filter((hash): hash is string => hash !== null)
    );

    // Get all stored image IDs
    const allStoredImages = await this.storedImages.toArray();
    const storedImageIds = allStoredImages.map(img => img.id);

    // Find orphaned images (stored but not referenced)
    const orphanedIds = storedImageIds.filter(id => !referencedHashes.has(id));

    // Delete orphaned images
    if (orphanedIds.length > 0) {
      await Promise.all(orphanedIds.map(id => this.storedImages.delete(id)));
    }
  }

  /**
   * Get a single snapshot by ID (includes full payload)
   * Use this when you need the actual snapshot data for diff/restore
   * @param {string} snapshotId - Snapshot ID
   * @returns {Promise<CharacterSnapshot | undefined>} Full snapshot or undefined
   */
  async getSnapshotById(snapshotId: string): Promise<CharacterSnapshot | undefined> {
    return this.snapshots.get(snapshotId);
  }

  /**
   * Delete a snapshot by ID directly
   * @param {string} snapshotId - Snapshot ID
   * @returns {Promise<void>}
   */
  async deleteSnapshotById(snapshotId: string): Promise<void> {
    await this.snapshots.delete(snapshotId);
  }

  /**
   * Repair a snapshot's image reference by storing the image in content-addressed
   * storage and updating the snapshot's imageHash. Used for snapshots created
   * before v4 (storedImages) that have null imageHash.
   * @param {string} snapshotId - Snapshot ID to repair
   * @param {string} imageHash - Computed image hash
   * @param {string} imageData - Base64 image data
   * @param {string} thumbnailData - Base64 thumbnail data
   */
  async repairSnapshotImage(
    snapshotId: string,
    imageHash: string,
    imageData: string,
    thumbnailData: string,
  ): Promise<void> {
    await this.transaction('rw', this.snapshots, this.storedImages, async () => {
      await this.storedImages.put({ id: imageHash, imageData, thumbnailData });
      await this.snapshots.update(snapshotId, { imageHash });
    });
  }

  /**
   * Overwrite an existing snapshot's payload and hashes in place.
   * Preserves the snapshot's id, source, and createdAt. Used to update the
   * baseline ('open') snapshot with the current draft's content.
   * @param {string} snapshotId - Snapshot ID to overwrite
   * @param {string} characterId - Character ID (for orphaned image cleanup)
   * @param {CharacterSnapshotPayload} payload - New payload (with image data)
   * @param {string} payloadHash - New payload hash
   * @param {string | null} imageHash - New image hash (null if no image)
   * @returns {Promise<void>}
   */
  async overwriteSnapshotPayload(
    snapshotId: string,
    characterId: string,
    payload: CharacterSnapshotPayload,
    payloadHash: string,
    imageHash: string | null,
  ): Promise<void> {
    await this.transaction('rw', this.snapshots, this.storedImages, async () => {
      if (imageHash && payload.imageData) {
        await this.storedImages.put({
          id: imageHash,
          imageData: payload.imageData,
          thumbnailData: payload.thumbnailData,
        });
      }

      await this.snapshots.update(snapshotId, {
        payload: {
          ...payload,
          imageData: '', // Stored in storedImages via imageHash
          thumbnailData: '',
        },
        payloadHash,
        imageHash,
      });

      await this.cleanOrphanedImages(characterId);
    });
  }

  // ============================================================================
  // Standalone lorebook operations
  // ============================================================================

  async getAllLorebookListItems(): Promise<LorebookListItem[]> {
    const indexCount = await this.lorebookListIndex.count();
    if (indexCount === 0) {
      const bookCount = await this.lorebooks.count();
      if (bookCount > 0) {
        await this.rebuildLorebookListIndex();
      }
    }
    return this.lorebookListIndex.orderBy('updatedAt').reverse().toArray();
  }

  async rebuildLorebookListIndex(): Promise<void> {
    await this.transaction('rw', this.lorebooks, this.lorebookListIndex, async () => {
      await this.lorebookListIndex.clear();
      await this.lorebooks.toCollection().each(async (lorebook) => {
        await this.lorebookListIndex.put(toLorebookListItem(lorebook));
      });
    });
  }

  async getLorebook(id: string): Promise<VaultLorebook | undefined> {
    return this.lorebooks.get(id);
  }

  async createLorebook(input: CreateVaultLorebookInput): Promise<VaultLorebook> {
    const timestamp = new Date().toISOString();
    const id = uuidv4();
    const book = input.book
      ? { ...input.book, name: input.book.name || input.name, extensions: input.book.extensions || {} }
      : createEmptyCharacterBook(input.name);

    const lorebook: VaultLorebook = {
      id,
      name: input.name,
      description: input.description ?? book.description ?? '',
      tags: input.tags ?? [],
      book: {
        ...book,
        name: book.name || input.name,
        description: book.description ?? input.description ?? '',
      },
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
    };

    await this.transaction('rw', this.lorebooks, this.lorebookListIndex, async () => {
      await this.lorebooks.add(lorebook);
      await this.syncLorebookListIndex(lorebook);
    });
    return lorebook;
  }

  async updateLorebook(id: string, input: UpdateVaultLorebookInput): Promise<VaultLorebook> {
    const existing = await this.lorebooks.get(id);
    if (!existing) {
      throw new Error(`Lorebook with ID "${id}" not found`);
    }

    const timestamp = new Date().toISOString();
    const nextBook = input.book
      ? {
          ...input.book,
          extensions: input.book.extensions || {},
          entries: input.book.entries || [],
        }
      : existing.book;

    const updated: VaultLorebook = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      tags: input.tags ?? existing.tags,
      book: nextBook,
      updatedAt: timestamp,
    };

    // Keep book.name in sync with vault display name when name is updated
    if (input.name !== undefined) {
      updated.book = { ...updated.book, name: input.name };
    }
    if (input.description !== undefined) {
      updated.book = { ...updated.book, description: input.description };
    }

    await this.transaction('rw', this.lorebooks, this.lorebookListIndex, async () => {
      await this.lorebooks.put(updated);
      await this.syncLorebookListIndex(updated);
    });
    return updated;
  }

  async deleteLorebook(id: string): Promise<void> {
    await this.transaction(
      'rw',
      [
        this.lorebooks,
        this.lorebookListIndex,
        this.lorebookSnapshots,
        this.characterLorebookAttachments,
        this.lorebookCustomContext,
      ],
      async () => {
        await this.lorebooks.delete(id);
        await this.lorebookListIndex.delete(id);
        await this.lorebookSnapshots.where('lorebookId').equals(id).delete();
        await this.lorebookCustomContext.delete(id);

        // Drop attach references to this book
        const attachments = await this.characterLorebookAttachments.toArray();
        await Promise.all(
          attachments.map(async (row) => {
            if (!row.lorebookIds.includes(id)) return;
            const nextIds = row.lorebookIds.filter((bookId) => bookId !== id);
            if (nextIds.length === 0) {
              await this.characterLorebookAttachments.delete(row.characterId);
            } else {
              await this.characterLorebookAttachments.put({
                ...row,
                lorebookIds: nextIds,
                updatedAt: new Date().toISOString(),
              });
            }
          }),
        );
      },
    );
  }

  async duplicateLorebook(id: string, newName: string): Promise<VaultLorebook> {
    const existing = await this.lorebooks.get(id);
    if (!existing) {
      throw new Error(`Lorebook with ID "${id}" not found`);
    }

    const timestamp = new Date().toISOString();
    const newId = uuidv4();
    const duplicated: VaultLorebook = {
      ...existing,
      id: newId,
      name: newName,
      book: {
        ...existing.book,
        name: newName,
        entries: existing.book.entries.map((entry) => ({
          ...entry,
          extensions: { ...entry.extensions },
          keys: [...entry.keys],
          secondary_keys: entry.secondary_keys ? [...entry.secondary_keys] : undefined,
        })),
        extensions: { ...existing.book.extensions },
      },
      tags: [...(existing.tags ?? [])],
      createdAt: timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
    };

    await this.transaction(
      'rw',
      this.lorebooks,
      this.lorebookListIndex,
      this.lorebookCustomContext,
      async () => {
        await this.lorebooks.add(duplicated);
        await this.syncLorebookListIndex(duplicated);

        const customContext = await this.lorebookCustomContext.get(id);
        if (customContext) {
          await this.lorebookCustomContext.put({
            ...customContext,
            lorebookId: newId,
            updatedAt: timestamp,
          });
        }
      },
    );
    return duplicated;
  }

  async updateLorebookLastOpened(id: string): Promise<string> {
    const timestamp = new Date().toISOString();
    await this.transaction('rw', this.lorebooks, this.lorebookListIndex, async () => {
      await this.lorebooks.update(id, { lastOpenedAt: timestamp });
      const existing = await this.lorebookListIndex.get(id);
      if (existing) {
        await this.lorebookListIndex.put({ ...existing, lastOpenedAt: timestamp });
      }
    });
    return timestamp;
  }

  // ============================================================================
  // Lorebook snapshot operations
  // ============================================================================

  async createLorebookSnapshot(input: CreateLorebookSnapshotInput): Promise<LorebookSnapshot | null> {
    const latest = await this.getLatestLorebookSnapshot(input.lorebookId);
    if (latest?.payloadHash === input.payloadHash) {
      return null;
    }

    const snapshot: LorebookSnapshot = {
      id: uuidv4(),
      lorebookId: input.lorebookId,
      source: input.source,
      createdAt: new Date().toISOString(),
      payload: input.payload,
      payloadHash: input.payloadHash,
    };

    await this.transaction('rw', this.lorebookSnapshots, async () => {
      await this.lorebookSnapshots.add(snapshot);
      await this.pruneLorebookSnapshots(input.lorebookId, 10);
    });

    return snapshot;
  }

  async getLorebookSnapshots(lorebookId: string): Promise<LorebookSnapshot[]> {
    const snapshots = await this.lorebookSnapshots
      .where('lorebookId')
      .equals(lorebookId)
      .sortBy('createdAt');
    return snapshots.reverse();
  }

  async getLatestLorebookSnapshot(lorebookId: string): Promise<LorebookSnapshot | undefined> {
    const snapshots = await this.lorebookSnapshots
      .where('lorebookId')
      .equals(lorebookId)
      .sortBy('createdAt');
    return snapshots.at(-1);
  }

  async getLorebookSnapshotMetadata(lorebookId: string): Promise<LorebookSnapshotMetadata[]> {
    const snapshots = await this.lorebookSnapshots
      .where('lorebookId')
      .equals(lorebookId)
      .sortBy('createdAt');
    return snapshots.reverse().map(({ id, lorebookId: bookId, source, createdAt, payloadHash }) => ({
      id,
      lorebookId: bookId,
      source,
      createdAt,
      payloadHash,
    }));
  }

  async getLorebookSnapshotById(snapshotId: string): Promise<LorebookSnapshot | undefined> {
    return this.lorebookSnapshots.get(snapshotId);
  }

  async deleteLorebookSnapshot(snapshotId: string): Promise<void> {
    await this.lorebookSnapshots.delete(snapshotId);
  }

  async pruneLorebookSnapshots(lorebookId: string, limit: number): Promise<void> {
    const snapshots = await this.lorebookSnapshots
      .where('lorebookId')
      .equals(lorebookId)
      .sortBy('createdAt');

    if (snapshots.length <= limit) {
      return;
    }

    const toDelete = snapshots.slice(0, snapshots.length - limit);
    await Promise.all(toDelete.map((snapshot) => this.lorebookSnapshots.delete(snapshot.id)));
  }

  // ============================================================================
  // Character ↔ lorebook attachments (vault-local)
  // ============================================================================

  async getCharacterLorebookAttachments(
    characterId: string,
  ): Promise<CharacterLorebookAttachments | undefined> {
    return this.characterLorebookAttachments.get(characterId);
  }

  async setCharacterLorebookAttachments(
    characterId: string,
    lorebookIds: string[],
  ): Promise<CharacterLorebookAttachments> {
    // At most one attached lorebook per character.
    const unique = [...new Set(lorebookIds)];
    const limited = unique.length > 0 ? [unique[unique.length - 1]] : [];
    const row: CharacterLorebookAttachments = {
      characterId,
      lorebookIds: limited,
      updatedAt: new Date().toISOString(),
    };
    if (row.lorebookIds.length === 0) {
      await this.characterLorebookAttachments.delete(characterId);
      return row;
    }
    await this.characterLorebookAttachments.put(row);
    return row;
  }

  /**
   * Characters that attach this vault lorebook (list index only; no full cards).
   * Orphan attachment rows (deleted character) are omitted.
   */
  async getCharacterListItemsLinkedToLorebook(
    lorebookId: string,
  ): Promise<CharacterListItem[]> {
    const rows = await this.characterLorebookAttachments
      .filter((row) => row.lorebookIds.includes(lorebookId))
      .toArray();
    if (rows.length === 0) return [];

    const items = await this.characterListIndex.bulkGet(
      rows.map((row) => row.characterId),
    );
    return items
      .filter((item): item is CharacterListItem => item != null)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  /**
   * Reverse index: lorebookId → characterIds (attachment rows only; no thumbnails).
   * Used by the vault list to join against the in-memory character list index.
   */
  async getLinkedCharacterIdsByLorebook(): Promise<Record<string, string[]>> {
    const rows = await this.characterLorebookAttachments.toArray();
    const result: Record<string, string[]> = {};
    for (const row of rows) {
      for (const lorebookId of row.lorebookIds) {
        const list = result[lorebookId];
        if (list) list.push(row.characterId);
        else result[lorebookId] = [row.characterId];
      }
    }
    return result;
  }

  /**
   * Count characters that attach this book without loading list-item thumbnails.
   * Uses primary keys only so badge refreshes stay cheap.
   */
  async countCharactersLinkedToLorebook(lorebookId: string): Promise<number> {
    const rows = await this.characterLorebookAttachments
      .filter((row) => row.lorebookIds.includes(lorebookId))
      .toArray();
    if (rows.length === 0) return 0;

    const characterIds = rows.map((row) => row.characterId);
    const keys = await this.characterListIndex
      .where('id')
      .anyOf(characterIds)
      .primaryKeys();
    return keys.length;
  }
}

/**
 * Singleton instance of the character database
 */
export const characterDb = new CharacterDatabase();
