/**
 * @fileoverview Database class for CharacterVault.
 * Manages characters in IndexedDB.
 * @module @db/CharacterDatabase
 */

import Dexie, { type Table } from 'dexie';
import type {
  Character,
  CharacterSnapshot,
  CharacterVaultSettings,
  CreateSnapshotInput,
  CreateCharacterInput,
  UpdateCharacterInput,
  SnapshotMetadata,
  CharacterListItem,
} from './characterTypes';
import { DEFAULT_CHARACTER_VAULT_SETTINGS } from './characterTypes';
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

    // Version 4: Add thumbnailData field (no migration needed - app is unreleased)
    this.version(4).stores({
      characters: 'id, name, updatedAt, createdAt',
      settings: 'id',
      snapshots: 'id, characterId, createdAt, [characterId+createdAt]',
    });
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
   * Get lightweight list items for vault view
   * Returns only the fields needed for card display
   * @returns {Promise<CharacterListItem[]>} Array of character list items
   */
  async getAllCharacterListItems(): Promise<CharacterListItem[]> {
    const all = await this.characters
      .orderBy('updatedAt')
      .reverse()
      .toArray();
    // Destructure to drop heavy fields (data, imageData, version, createdAt) for GC
    return all.map(({ id, name, thumbnailData, lastOpenedAt, updatedAt }) => ({
      id, name, thumbnailData, lastOpenedAt, updatedAt,
    }));
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
      .filter(char =>
        char.name.toLowerCase().includes(lowerQuery)
      )
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

    await this.characters.add(character);
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
        characterBook: input.data?.characterBook ?? character.data.characterBook,
        extensions: input.data?.extensions ?? character.data.extensions,
      },
      updatedAt: timestamp,
    };

    await this.characters.put(updatedCharacter);
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

    await this.characters.put(updatedCharacter);
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
    await this.transaction('rw', this.characters, this.snapshots, async () => {
      await this.characters.delete(id);
      await this.snapshots.where('characterId').equals(id).delete();
    });
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

    await this.characters.add(duplicatedCharacter);
    return duplicatedCharacter;
  }

  /**
   * Update last opened timestamp
   * @param {string} id - Character ID
   * @returns {Promise<void>}
   */
  async updateLastOpened(id: string): Promise<void> {
    const timestamp = new Date().toISOString();
    await this.characters.update(id, { lastOpenedAt: timestamp });
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

    await this.characters.add(character);
    return character;
  }

  // ============================================================================
  // Snapshot Operations
  // ============================================================================

  async createSnapshot(input: CreateSnapshotInput): Promise<CharacterSnapshot | null> {
    // Enforce single "open" snapshot per character - return existing if already present
    if (input.source === 'open') {
      const existingOpen = await this.snapshots
        .where('characterId')
        .equals(input.characterId)
        .filter(s => s.source === 'open')
        .first();
      if (existingOpen) {
        return existingOpen;
      }
    }

    const latestSnapshot = await this.getLatestSnapshot(input.characterId);
    if (latestSnapshot?.payloadHash === input.payloadHash) {
      return null;
    }

    const snapshot: CharacterSnapshot = {
      id: uuidv4(),
      characterId: input.characterId,
      source: input.source,
      createdAt: new Date().toISOString(),
      payload: input.payload,
      payloadHash: input.payloadHash,
    };

    await this.transaction('rw', this.snapshots, async () => {
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

  async getLatestSnapshotWithImage(characterId: string): Promise<CharacterSnapshot | undefined> {
    const snapshots = await this.snapshots
      .where('characterId')
      .equals(characterId)
      .sortBy('createdAt');
    // Search from newest (end of array) to find the most recent one with image data
    for (let index = snapshots.length - 1; index >= 0; index -= 1) {
      if (snapshots[index].payload.imageData) {
        return snapshots[index];
      }
    }
    return undefined;
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    await this.snapshots.delete(snapshotId);
  }

  async pruneSnapshotsForCharacter(characterId: string, limit: number): Promise<void> {
    const snapshots = await this.snapshots
      .where('characterId')
      .equals(characterId)
      .sortBy('createdAt');

    // Separate baseline (open) snapshots from deletable ones - baseline is protected
    const deletableSnapshots = snapshots.filter(s => s.source !== 'open');

    if (deletableSnapshots.length <= limit) {
      return;
    }

    const snapshotsToDelete = deletableSnapshots.slice(0, deletableSnapshots.length - limit);
    await Promise.all(snapshotsToDelete.map(snapshot => this.snapshots.delete(snapshot.id)));
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
    return snapshots.reverse().map(({ id, characterId: cId, source, createdAt, payloadHash }) => ({
      id,
      characterId: cId,
      source,
      createdAt,
      payloadHash,
    }));
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
}

/**
 * Singleton instance of the character database
 */
export const characterDb = new CharacterDatabase();
