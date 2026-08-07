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
  CharacterSnapshot,
  CharacterSnapshotPayload,
  CharacterSection,
  SectionMeta,
  CharacterCardV2,
  PNGMetadata,
  ImportCharacterResult,
  ExportCharacterResult,
  CreateCharacterInput,
  CreateSnapshotInput,
  SnapshotDiffEntry,
  SnapshotSource,
  UpdateCharacterInput,
  CharacterExtensions,
  CharacterVaultSettings,
  SillyTavernClipboardPayload,
  ClipboardValidationResult,
  CharacterListItem,
  StoredImage,
  SpellDictionaryCacheEntry,
  SpellcheckSettings,
  CharacterCustomContext,
  CustomContextMeta,
} from './characterTypes';
export {
  CHARACTER_SECTIONS,
  DEFAULT_CHARACTER_VAULT_SETTINGS,
  DEFAULT_SPELLCHECK_SETTINGS,
  DEFAULT_MARKDOWN_IMAGE_OPEN_LINKS,
  EMPTY_CUSTOM_CONTEXT_META,
} from './characterTypes';
export { CharacterDatabase, characterDb, toCharacterListItem } from './CharacterDatabase';
