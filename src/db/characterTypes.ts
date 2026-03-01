/**
 * @fileoverview TypeScript interfaces and types for CharacterVault database schema.
 * @module @db/characterTypes
 */

// ============================================================================
// Core Types
// ============================================================================

/** Unique identifier type for type safety */
export type UUID = string;

/** Timestamp type (ISO 8601) */
export type Timestamp = string;

// ============================================================================
// Character V2 Spec Types
// ============================================================================

/**
 * Character Book Entry for lorebook
 */
export interface LorebookEntry {
  id: number;
  keys: string[];
  content: string;
  extensions: Record<string, unknown>;
  enabled: boolean;
  insertion_order: number;
  case_sensitive: boolean;
  name?: string;
  priority?: number;
  comment?: string;
  selective?: boolean;
  secondary_keys?: string[];
  constant?: boolean;
  position?: 'before_char' | 'after_char' | 'before_example' | 'after_example';
}

/**
 * Character Book containing lore entries
 */
export interface CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions: Record<string, unknown>;
  entries: LorebookEntry[];
}

/**
 * Character V2/V3 Spec data structure
 * Supports both v2 and v3 spec fields
 */
export interface CharacterSpec {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  physical_description: string;
  // V3 spec fields
  avatar?: string;
  creator_notes?: string;
  creator?: string;
  character_version?: string;
  tags?: string[];
}

/**
 * Character extensions for V2 spec
 */
export interface CharacterExtensions {
  [key: string]: unknown;
}

// ============================================================================
// Character Entity
// ============================================================================

/**
 * Single entity: Character
 * Stores all character card v2 data including image and spec
 */
export interface Character {
  /** Unique character identifier */
  id: UUID;

  /** Character display name */
  name: string;

  /** Base64 encoded PNG image data */
  imageData: string;

  /** Character V2 spec data */
  data: {
    /** All V2 spec fields */
    spec: CharacterSpec;
    /** Optional lorebook */
    characterBook?: CharacterBook;
    /** Extensions data */
    extensions?: CharacterExtensions;
  };

  /** Database version for migrations */
  version: number;

  /** Creation timestamp */
  createdAt: Timestamp;

  /** Last modification timestamp */
  updatedAt: Timestamp;

  /** Last opened timestamp */
  lastOpenedAt?: Timestamp;
}

export type SnapshotSource = 'open' | 'auto' | 'manual' | 'rollback';

export interface CharacterSnapshotPayload {
  name: string;
  imageData: string;
  data: Character['data'];
}

export interface CharacterSnapshot {
  id: UUID;
  characterId: UUID;
  source: SnapshotSource;
  createdAt: Timestamp;
  payload: CharacterSnapshotPayload;
  payloadHash: string;
}

export interface CreateSnapshotInput {
  characterId: UUID;
  source: SnapshotSource;
  payload: CharacterSnapshotPayload;
  payloadHash: string;
}

export interface SnapshotDiffEntry {
  section: CharacterSection | 'image' | 'extensions' | 'lorebook';
  label: string;
  changed: boolean;
  snapshotValue: unknown;
  currentValue: unknown;
}

/**
 * Input for creating a new character
 */
export interface CreateCharacterInput {
  name: string;
  imageData?: string;
  data?: Partial<Character['data']>;
}

/**
 * Input for updating a character
 */
export interface UpdateCharacterInput {
  name?: string;
  imageData?: string;
  data?: Partial<Character['data']>;
}

// ============================================================================
// Section Types for Editor
// ============================================================================

/**
 * Available section tabs in the editor
 */
export type CharacterSection =
  | 'image'
  | 'name'
  | 'description'
  | 'personality'
  | 'scenario'
  | 'first_mes'
  | 'mes_example'
  | 'system_prompt'
  | 'post_history_instructions'
  | 'alternate_greetings'
  | 'physical_description'
  | 'extensions'
  | 'lorebook'
  // V3 spec sections
  | 'avatar'
  | 'creator_notes'
  | 'creator'
  | 'character_version'
  | 'tags';

/**
 * Section metadata for UI display
 */
export interface SectionMeta {
  id: CharacterSection;
  label: string;
  icon: string;
  description: string;
}

/**
 * All available sections with metadata
 */
export const CHARACTER_SECTIONS: SectionMeta[] = [
  { id: 'image', label: 'Image', icon: 'Image', description: 'Character avatar image' },
  { id: 'name', label: 'Name', icon: 'Type', description: 'Character name' },
  { id: 'description', label: 'Description', icon: 'FileText', description: 'Character description' },
  { id: 'first_mes', label: 'First Message', icon: 'MessageCircle', description: 'First greeting message' },
  { id: 'alternate_greetings', label: 'Greetings', icon: 'Greeting', description: 'Alternate greetings' },
  { id: 'mes_example', label: 'Examples', icon: 'MessagesSquare', description: 'Message examples' },
  { id: 'scenario', label: 'Scenario', icon: 'Map', description: 'Roleplay scenario' },
  { id: 'physical_description', label: 'Appearance', icon: 'Eye', description: 'Physical description' },
  { id: 'personality', label: 'Personality', icon: 'User', description: 'Personality traits' },
  { id: 'system_prompt', label: 'System', icon: 'Terminal', description: 'System prompt' },
  { id: 'post_history_instructions', label: 'Post-History', icon: 'History', description: 'Post-history instructions' },
  { id: 'lorebook', label: 'Lorebook', icon: 'Book', description: 'Character lore entries' },
  { id: 'creator', label: 'Creator', icon: 'UserCircle', description: 'Character creator name' },
  { id: 'creator_notes', label: 'Creator Notes', icon: 'NotebookPen', description: 'Notes from the creator (supports CSS)' },
  { id: 'tags', label: 'Tags', icon: 'Tags', description: 'Character tags (comma-separated)' },
  { id: 'character_version', label: 'Version', icon: 'Tag', description: 'Character version identifier' },
  { id: 'extensions', label: 'Extensions', icon: 'Puzzle', description: 'Extension data' },
  { id: 'avatar', label: 'Avatar URL', icon: 'Link', description: 'Character avatar URL (CharHub, etc.)' },
];

// ============================================================================
// Import/Export Types
// ============================================================================

/**
 * Character card V2/V3 JSON structure for export/import
 */
export interface CharacterCardV2 {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  character_book?: CharacterBook;
  extensions: CharacterExtensions;
  // V3 spec fields
  creator?: string;
  character_version?: string;
  tags?: string[];
  creator_notes?: string;
  avatar?: string;
}

/**
 * PNG metadata chunk for character data
 */
export interface PNGMetadata {
  chara?: string; // Base64 encoded character JSON
  [key: string]: string | undefined;
}

/**
 * Import result
 */
export interface ImportCharacterResult {
  success: boolean;
  character?: Character;
  error?: string;
}

/**
 * Export result
 */
export interface ExportCharacterResult {
  success: boolean;
  blob?: Blob;
  filename?: string;
  error?: string;
}

// ============================================================================
// Settings Types
// ============================================================================

/**
 * Application settings for CharacterVault
 */
export interface CharacterVaultSettings {
  /** Single settings record ID */
  id: 'app-settings';

  /** UI preferences */
  ui: {
    /** Theme mode */
    theme: 'light' | 'dark' | 'system';
    /** Editor font size in pixels */
    editorFontSize: number;
    /** Sidebar width in pixels */
    sidebarWidth: number;
  };

  /** AI configuration */
  ai?: import('./types').AIConfig;

  /** Sampler settings */
  sampler?: import('./types').SamplerSettings;

  /** Prompt settings */
  prompts?: import('./types').PromptSettings;

  /** Context section IDs for AI context */
  contextSectionIds?: CharacterSection[];

  /** Last active character ID */
  lastActiveCharacterId?: UUID;

  /** Settings version for migrations */
  version: number;
}

/**
 * Default settings
 */
export const DEFAULT_CHARACTER_VAULT_SETTINGS: Omit<CharacterVaultSettings, 'id'> = {
  ui: {
    theme: 'system',
    editorFontSize: 16,
    sidebarWidth: 280,
  },
  version: 1,
};
