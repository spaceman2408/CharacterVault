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
  insertion_order?: number;
  case_sensitive?: boolean | null;
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

  /** Base64 encoded PNG image data (full resolution) */
  imageData: string;

  /** Base64 encoded JPEG thumbnail (128x192 max) for vault view */
  thumbnailData: string;

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

/**
 * Stored image entry - content-addressed storage for character images
 * Images are keyed by hash so identical images are stored only once
 */
export interface StoredImage {
  /** Content hash of imageData (used as primary key) */
  id: string;
  /** Base64 encoded PNG image data */
  imageData: string;
  /** Base64 encoded JPEG thumbnail */
  thumbnailData: string;
}

/**
 * Cached spellcheck dictionary entry, keyed by language code.
 * Stores the raw Hunspell `.aff` and `.dic` text as loaded.
 */
export interface SpellDictionaryCacheEntry {
  /** Language code (e.g. "en") */
  id: string;
  /** Raw Hunspell .aff file contents */
  aff: string;
  /** Raw Hunspell .dic file contents */
  dic: string;
  /** When the entry was cached (ms since epoch) */
  cachedAt: number;
}

/**
 * Vault-local custom AI context for a single character (1:1).
 * Not part of card export/import or SillyTavern fields.
 */
export interface CharacterCustomContext {
  /** Character ID (primary key) */
  characterId: UUID;
  /** Free-text body pasted/edited by the user */
  content: string;
  /** When true, body is included in Orion + AI toolbar context */
  enabled: boolean;
  /** Last save time (ISO 8601) */
  updatedAt: Timestamp;
  /** Character length of content — for usage UI without loading body */
  charLength: number;
}

/** Lightweight custom-context fields safe to keep in React state */
export interface CustomContextMeta {
  enabled: boolean;
  charLength: number;
  updatedAt: Timestamp | null;
}

export const EMPTY_CUSTOM_CONTEXT_META: CustomContextMeta = {
  enabled: false,
  charLength: 0,
  updatedAt: null,
};

export interface CharacterSnapshotPayload {
  name: string;
  imageData: string;
  thumbnailData: string;
  data: Character['data'];
}

export interface CharacterSnapshot {
  id: UUID;
  characterId: UUID;
  source: SnapshotSource;
  createdAt: Timestamp;
  payload: CharacterSnapshotPayload;
  payloadHash: string;
  /** Hash referencing the stored image in storedImages table */
  imageHash: string | null;
}

/**
 * Lightweight snapshot metadata - excludes the heavy payload
 * Use this for timeline lists; load full payload only when needed
 */
export interface SnapshotMetadata {
  id: UUID;
  characterId: UUID;
  source: SnapshotSource;
  createdAt: Timestamp;
  payloadHash: string;
  /** Hash referencing the stored image in storedImages table */
  imageHash: string | null;
}

export interface CreateSnapshotInput {
  characterId: UUID;
  source: SnapshotSource;
  payload: CharacterSnapshotPayload;
  payloadHash: string;
  /** Hash referencing the stored image in storedImages table */
  imageHash: string | null;
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
  thumbnailData?: string;
  data?: Partial<Character['data']>;
}

/**
 * Input for updating a character
 */
export interface UpdateCharacterInput {
  name?: string;
  imageData?: string;
  thumbnailData?: string;
  data?: Partial<Character['data']>;
}

/**
 * Lightweight list item for vault view
 * Contains only the fields needed for card display
 */
export interface CharacterListItem {
  id: UUID;
  name: string;
  thumbnailData: string;
  lastOpenedAt?: Timestamp;
  updatedAt: Timestamp;
  /**
   * Estimated tokens always present in a typical RP prompt
   * (name, description, appearance, personality, scenario, system, post-history, examples).
   */
  activeTokens: number;
  /**
   * Estimated tokens for the full card (active fields + greetings + lorebook + metadata).
   */
  totalTokens: number;
  /** Tags used for search only — not rendered as a tag UI in the vault */
  tags: string[];
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
  { id: 'tags', label: 'Tags', icon: 'Tags', description: 'Character tags' },
  { id: 'character_version', label: 'Version', icon: 'Tag', description: 'Character version identifier' },
  { id: 'extensions', label: 'Extensions', icon: 'Puzzle', description: 'Extension data' },
  { id: 'avatar', label: 'Avatar URL', icon: 'Link', description: 'Character avatar URL (CharHub, etc.)' },
];

/**
 * Default section tab order (matches CHARACTER_SECTIONS order).
 * Used when no custom sectionOrder is saved in settings.
 */
export const DEFAULT_SECTION_ORDER: CharacterSection[] = CHARACTER_SECTIONS.map(s => s.id);

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
// Clipboard Import Types
// ============================================================================

/**
 * SillyTavern clipboard payload structure
 */
export interface SillyTavernClipboardPayload {
  source: 'st';
  character: CharacterCardV2;
  avatar: string | null;
}

/**
 * Result of validating clipboard data
 */
export interface ClipboardValidationResult {
  success: boolean;
  characterData?: CharacterCardV2;
  avatarData?: string;
  error?: string;
}

// ============================================================================
// Settings Types
// ============================================================================

/**
 * Application settings for CharacterVault
 */
/**
 * Spellcheck settings, stored under `ui.spellcheck`.
 */
export interface SpellcheckSettings {
  /** Whether in-editor spellcheck is enabled */
  enabled: boolean;
  /** Language code; currently only `en` is bundled */
  language: string;
  /** Words ignored for the current user (lowercased) */
  ignoredWords: string[];
  /** Words added to the personal dictionary (lowercased) */
  customWords: string[];
}

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
    /** Show the "I'm Feeling Lucky" vortex animation in AI Creation Studio */
    showLuckyVortex?: boolean;
    /** Spellcheck preferences */
    spellcheck?: SpellcheckSettings;
  };

  /** AI configuration */
  ai?: AIConfig;

  /** Sampler settings */
  sampler?: SamplerSettings;

  /** Prompt settings */
  prompts?: PromptSettings;

  /** Per-operation model routing for toolbar AI prompts */
  promptModels?: PromptModelMap;

  /** Context section IDs for AI context */
  contextSectionIds?: CharacterSection[];

  /** Custom section tab order (CharacterSection IDs in display order). Undefined = default order. */
  sectionOrder?: CharacterSection[];

  /** Sections hidden from the tab strip. Undefined = all visible. */
  hiddenSections?: CharacterSection[];

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
    spellcheck: {
      enabled: true,
      language: 'en',
      ignoredWords: [],
      customWords: [],
    },
  },
  version: 1,
};

/**
 * Default spellcheck settings (used to backfill old settings records).
 */
export const DEFAULT_SPELLCHECK_SETTINGS: SpellcheckSettings = {
  enabled: true,
  language: 'en',
  ignoredWords: [],
  customWords: [],
};

// ============================================================================
// AI Settings Types
// ============================================================================

/**
 * AI generation parameters (samplers)
 */
export interface SamplerSettings {
  /** Randomness (0.0 - 2.0) */
  temperature: number;

  /** Nucleus sampling threshold (0.0 - 1.0) */
  minP: number;

  /** Top-k sampling (0 = disabled, 1 - 100) */
  topK: number;

  /** Repetition penalty (1.0 - 2.0) */
  repetitionPenalty: number;

  /** Top P nucleus sampling (0.0 - 1.0) */
  topP: number;

  /** Context window size (2048 – 1_000_000) */
  contextLength: number;

  /** Max generation tokens (min 100) */
  maxTokens: number;
}

/** Absolute minimum context window (2K preset only). */
export const CONTEXT_LENGTH_MIN = 2048;

/** Minimum allowed for free-form custom context length. */
export const CONTEXT_LENGTH_CUSTOM_MIN = 4096;

/** Maximum context window (1M tokens). */
export const CONTEXT_LENGTH_MAX = 1_000_000;

/** Named context-length presets for the Sampler settings UI. */
export const CONTEXT_LENGTH_PRESETS = [
  { label: '2K tokens', value: 2048 },
  { label: '4K tokens', value: 4096 },
  { label: '8K tokens', value: 8192 },
  { label: '16K tokens', value: 16384 },
  { label: '32K tokens', value: 32768 },
  { label: '64K tokens', value: 65536 },
  { label: '128K tokens', value: 128000 },
  { label: '256K tokens', value: 256000 },
  { label: '512K tokens', value: 512000 },
  { label: '1M tokens', value: 1000000 },
] as const;

/**
 * AI model information
 */
export interface AIModelInfo {
  id: string;
  name: string;
  contextLength?: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
  /** Whether this model supports provider selection (NanoGPT) */
  supportsProviderSelection?: boolean;
}

/**
 * Reasoning effort ladder used by OpenAI-compatible gateways and thinking models.
 * Not every model accepts every value; unsupported values are remapped at request time.
 */
export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/**
 * AI provider configuration
 */
export interface AIConfig {
  /** API base URL */
  baseUrl: string;

  /** API key (encrypted at rest in production) */
  apiKey: string;

  /** Saved API keys per base URL */
  apiKeysByBaseUrl?: Record<string, string>;

  /** Selected model ID */
  modelId: string;

  /** Saved model selections per base URL */
  modelIdsByBaseUrl?: Record<string, string>;

  /** Available models (cached from API) */
  availableModels?: AIModelInfo[];

  /** Enable streaming responses */
  enableStreaming: boolean;

  /** Whether to enable reasoning/thinking mode for supported models */
  enableReasoning?: boolean;

  /** Whether to show reasoning content in the UI (when enabled by the model) */
  showReasoning?: boolean;

  /**
   * Reasoning effort level for thinking models.
   * Gateways accept different subsets; AIService remaps when the API reports supported values.
   */
  reasoningEffort?: ReasoningEffort;

  /** Last custom base URL entered by the user (preserved when switching to/from presets) */
  lastCustomBaseUrl?: string;

  /** Selected provider ID for models that support provider selection (NanoGPT) */
  selectedProvider?: string;

  /** Per-model provider overrides: modelId -> providerId */
  providerByModelId?: Record<string, string>;

  /** Whether to use subscription-only models endpoint (NanoGPT) */
  subscriptionModelsOnly?: boolean;

  /** Billing mode: 'sub' uses subscription (default), 'paygo' forces pay-as-you-go for provider selection */
  billingMode?: 'sub' | 'paygo';
}

/**
 * Sampler preset for quick switching
 */
export interface SamplerPreset {
  id: UUID;
  name: string;
  settings: SamplerSettings;
}

/**
 * AI Operation types for toolbar actions
 */
export type AIOperation =
  | 'expand'
  | 'rewrite'
  | 'instruct'
  | 'shorten'
  | 'lengthen'
  | 'vivid'
  | 'emotion'
  | 'grammar';

/**
 * AI prompt settings for customizable operation prompts
 */
export interface PromptSettings {
  /** Text expansion prompt - must include ${text} placeholder */
  expand: string;

  /** Text rewrite prompt - must include ${text} placeholder */
  rewrite: string;

  /** Custom instruction prompt - must include ${text} placeholder */
  instruct: string;

  /** Shorten text prompt - must include ${text} placeholder */
  shorten: string;

  /** Lengthen text prompt - must include ${text} placeholder */
  lengthen: string;

  /** Make vivid prompt - must include ${text} placeholder */
  vivid: string;

  /** Add emotion prompt - must include ${text} placeholder */
  emotion: string;

  /** Fix grammar prompt - must include ${text} placeholder */
  grammar: string;
}

/**
 * Routes one toolbar AI operation to a specific endpoint + model.
 * baseUrl should be normalized (trim, no trailing slash) to match apiKeysByBaseUrl keys.
 */
export interface PromptModelBinding {
  /** API base URL (preset or custom), e.g. https://nano-gpt.com/api/v1 */
  baseUrl: string;
  /** Model ID on that endpoint */
  modelId: string;
}

/** Sparse map: missing key = use global AIConfig as-is. */
export type PromptModelMap = Partial<Record<keyof PromptSettings, PromptModelBinding>>;

/**
 * Default AI-related settings for CharacterVault.
 */
export const DEFAULT_SETTINGS = {
  ai: {
    baseUrl: 'https://nano-gpt.com/api/v1',
    apiKey: '',
    apiKeysByBaseUrl: {},
    modelId: '',
    modelIdsByBaseUrl: {},
    availableModels: [],
    enableStreaming: true,
    enableReasoning: true,
    showReasoning: true,
    reasoningEffort: 'medium',
    selectedProvider: undefined,
    providerByModelId: {},
    subscriptionModelsOnly: false,
    billingMode: 'sub',
  } satisfies AIConfig,
  sampler: {
    temperature: 1.0,
    minP: 0,
    topK: 0,
    repetitionPenalty: 1.0,
    topP: 1.0,
    contextLength: 8192,
    maxTokens: 2048,
  } satisfies SamplerSettings,
  samplerPresets: [
    {
      id: 'preset-creative',
      name: 'Creative',
      settings: {
        temperature: 1.1,
        minP: 0.05,
        topK: 0,
        repetitionPenalty: 1.05,
        topP: 0.95,
        contextLength: 8192,
        maxTokens: 2048,
      },
    },
    {
      id: 'preset-balanced',
      name: 'Balanced',
      settings: {
        temperature: 0.8,
        minP: 0.05,
        topK: 0,
        repetitionPenalty: 1.05,
        topP: 1.0,
        contextLength: 8192,
        maxTokens: 2048,
      },
    },
    {
      id: 'preset-factual',
      name: 'Factual',
      settings: {
        temperature: 0.5,
        minP: 0.1,
        topK: 0,
        repetitionPenalty: 1.05,
        topP: 0.9,
        contextLength: 8192,
        maxTokens: 1024,
      },
    },
  ] satisfies SamplerPreset[],
  prompts: {
    expand: 'Please expand and elaborate on the following text, adding more detail and depth while maintaining the same style and tone:\n\n"""\n${text}\n"""\n\nProvide only the expanded text without any additional commentary.',
    rewrite: 'Please rewrite the following text to improve clarity, flow, and impact while preserving the original meaning:\n\n"""\n${text}\n"""\n\nProvide only the rewritten text without any additional commentary.',
    instruct: 'Please apply the following instruction to the text below:\n\nInstruction: ${instruction}\n\nText:\n"""\n${text}\n"""\n\nProvide only the modified text without any additional commentary.',
    shorten: 'Please shorten and condense the following text, making it more concise while preserving the key meaning and essential details:\n\n"""\n${text}\n"""\n\nProvide only the shortened text without any additional commentary.',
    lengthen: 'Please lengthen the following text by adding more detail, depth, and elaboration while maintaining the same style and tone:\n\n"""\n${text}\n"""\n\nProvide only the lengthened text without any additional commentary.',
    vivid: 'Please rewrite the following text to make it more vivid and descriptive, adding sensory details, imagery, and evocative language:\n\n"""\n${text}\n"""\n\nProvide only the enhanced text without any additional commentary.',
    emotion: 'Please rewrite the following text to add more emotional depth, feeling, and character voice while preserving the original meaning:\n\n"""\n${text}\n"""\n\nProvide only the enhanced text without any additional commentary.',
    grammar: 'Please fix any grammar, spelling, and punctuation errors in the following text while preserving the original meaning and style:\n\n"""\n${text}\n"""\n\nProvide only the corrected text without any additional commentary.',
  } satisfies PromptSettings,
  promptModels: {} as PromptModelMap,
};

/** Clamp a context length into the allowed absolute range (2048 – 1_000_000). */
export function clampContextLength(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.sampler.contextLength;
  return Math.min(CONTEXT_LENGTH_MAX, Math.max(CONTEXT_LENGTH_MIN, Math.round(value)));
}
