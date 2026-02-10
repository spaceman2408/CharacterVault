/**
 * @fileoverview Barrel export for database layer.
 * @module @db
 */

// CharacterVault exports
export type { 
  Character, 
  CharacterSpec, 
  CharacterBook, 
  LorebookEntry,
  CharacterSection,
  SectionMeta,
  CharacterCardV2,
  PNGMetadata,
  ImportCharacterResult,
  ExportCharacterResult,
  CreateCharacterInput,
  UpdateCharacterInput,
  CharacterExtensions,
  CharacterVaultSettings,
} from './characterTypes';
export { CHARACTER_SECTIONS, DEFAULT_CHARACTER_VAULT_SETTINGS } from './characterTypes';
export { CharacterDatabase, characterDb } from './CharacterDatabase';
