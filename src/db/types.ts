/**
 * @fileoverview TypeScript interfaces and types for Lore Vault database schema.
 * @module @db/types
 */

// ============================================================================
// Core Types
// ============================================================================

/** Unique identifier type for type safety */
export type UUID = string;

/** Timestamp type (ISO 8601) */
export type Timestamp = string;

/** Category slot identifier (cat-01 through cat-20) */
export type CategorySlot =
  | 'cat-01' | 'cat-02' | 'cat-03' | 'cat-04' | 'cat-05'
  | 'cat-06' | 'cat-07' | 'cat-08' | 'cat-09' | 'cat-10'
  | 'cat-11' | 'cat-12' | 'cat-13' | 'cat-14' | 'cat-15'
  | 'cat-16' | 'cat-17' | 'cat-18' | 'cat-19' | 'cat-20';

/** Vault template types */
export type VaultTemplate = 'blank' | 'fantasy' | 'scifi' | 'modern';

/** Theme mode options */
export type ThemeMode = 'light' | 'dark' | 'system';

// ============================================================================
// Vault Metadata (Stored in Main Database)
// ============================================================================

/**
 * Vault metadata stored in the main 'lore-vault-registry' database.
 * Each vault has its own separate IndexedDB instance.
 */
export interface VaultMetadata {
  /** Unique vault identifier */
  id: UUID;

  /** Display name */
  name: string;

  /** Optional description */
  description?: string;

  /** Database name (IndexedDB name) */
  dbName: string;

  /** Template used for creation */
  template: VaultTemplate;

  /** Creation timestamp */
  createdAt: Timestamp;

  /** Last modification timestamp */
  updatedAt: Timestamp;

  /** Number of entries (cached for display) */
  entryCount: number;

  /** Last opened timestamp */
  lastOpenedAt?: Timestamp;
}

/**
 * Input for creating a new vault
 */
export interface CreateVaultInput {
  name: string;
  description?: string;
  template?: VaultTemplate;
}

/**
 * Input for updating a vault
 */
export interface UpdateVaultInput {
  name?: string;
  description?: string;
}

// ============================================================================
// Entry Entity
// ============================================================================

/**
 * A lore entry containing markdown content and metadata.
 * Stored in the vault-specific database.
 */
export interface Entry {
  /** Unique entry identifier */
  id: UUID;

  /** Entry title (also used for Lore-Link matching) */
  title: string;

  /** Markdown content */
  content: string;

  /** Category slot reference */
  categoryId: CategorySlot;

  /** User-defined keywords for Lore-Link system */
  keywords: string[];

  /** Creation timestamp */
  createdAt: Timestamp;

  /** Last modification timestamp */
  updatedAt: Timestamp;

  /** Whether entry is pinned in the list */
  isPinned: boolean;

  /** Custom sort order (null for default) */
  sortOrder: number | null;

  /** Word count (cached) */
  wordCount: number;
}

/**
 * Entry creation payload (omits auto-generated fields)
 */
export interface CreateEntryInput {
  title: string;
  content?: string;
  categoryId?: CategorySlot;
  keywords?: string[];
  isPinned?: boolean;
}

/**
 * Entry update payload (all fields optional)
 */
export interface UpdateEntryInput {
  title?: string;
  content?: string;
  categoryId?: CategorySlot;
  keywords?: string[];
  isPinned?: boolean;
  sortOrder?: number | null;
}

// ============================================================================
// Category Entity
// ============================================================================

/**
 * Color configuration for a category
 */
export interface CategoryColors {
  /** Background color (Tailwind class or hex) */
  background: string;

  /** Text color */
  text: string;

  /** Border color */
  border: string;
}

/**
 * A category for organizing entries.
 * Fixed 20 slots per vault, each can be configured independently.
 */
export interface Category {
  /** Slot identifier (cat-01 through cat-20) */
  id: CategorySlot;

  /** Display name */
  name: string;

  /** Whether this slot is active/visible */
  isActive: boolean;

  /** Display colors */
  colors: CategoryColors;

  /** Default category for new entries */
  isDefault: boolean;

  /** Icon name from Lucide */
  icon?: string;

  /** Sort order for display */
  sortOrder: number;
}

/**
 * Input for updating a category
 */
export interface UpdateCategoryInput {
  name?: string;
  isActive?: boolean;
  colors?: Partial<CategoryColors>;
  isDefault?: boolean;
  icon?: string;
  sortOrder?: number;
}

/**
 * Default categories for new vaults (20 slots)
 */
export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Characters', isActive: true, colors: { background: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' }, isDefault: false, icon: 'User', sortOrder: 1 },
  { name: 'Locations', isActive: true, colors: { background: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' }, isDefault: false, icon: 'MapPin', sortOrder: 2 },
  { name: 'Items', isActive: true, colors: { background: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' }, isDefault: false, icon: 'Sword', sortOrder: 3 },
  { name: 'Events', isActive: true, colors: { background: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' }, isDefault: false, icon: 'Calendar', sortOrder: 4 },
  { name: 'Organizations', isActive: true, colors: { background: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' }, isDefault: false, icon: 'Building', sortOrder: 5 },
  { name: 'Races & Species', isActive: true, colors: { background: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300' }, isDefault: false, icon: 'Users', sortOrder: 6 },
  { name: 'Magic & Technology', isActive: true, colors: { background: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' }, isDefault: false, icon: 'Sparkles', sortOrder: 7 },
  { name: 'History', isActive: true, colors: { background: 'bg-stone-100', text: 'text-stone-800', border: 'border-stone-300' }, isDefault: false, icon: 'Clock', sortOrder: 8 },
  { name: 'Notes', isActive: true, colors: { background: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' }, isDefault: false, icon: 'FileText', sortOrder: 9 },
  { name: 'Factions', isActive: true, colors: { background: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' }, isDefault: false, icon: 'Flag', sortOrder: 10 },
  { name: 'Creatures', isActive: true, colors: { background: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' }, isDefault: false, icon: 'Bug', sortOrder: 11 },
  { name: 'Languages', isActive: true, colors: { background: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300' }, isDefault: false, icon: 'Languages', sortOrder: 12 },
  { name: 'Religions', isActive: true, colors: { background: 'bg-lime-100', text: 'text-lime-800', border: 'border-lime-300' }, isDefault: false, icon: 'Church', sortOrder: 13 },
  { name: 'Cultures', isActive: true, colors: { background: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' }, isDefault: false, icon: 'Globe', sortOrder: 14 },
  { name: 'Artifacts', isActive: true, colors: { background: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' }, isDefault: false, icon: 'Gem', sortOrder: 15 },
  { name: 'Timelines', isActive: true, colors: { background: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300' }, isDefault: false, icon: 'Timer', sortOrder: 16 },
  { name: 'Worlds', isActive: true, colors: { background: 'bg-fuchsia-100', text: 'text-fuchsia-800', border: 'border-fuchsia-300' }, isDefault: false, icon: 'Earth', sortOrder: 17 },
  { name: 'Concepts', isActive: true, colors: { background: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-300' }, isDefault: false, icon: 'Lightbulb', sortOrder: 18 },
  { name: 'References', isActive: true, colors: { background: 'bg-zinc-100', text: 'text-zinc-800', border: 'border-zinc-300' }, isDefault: false, icon: 'BookOpen', sortOrder: 19 },
  { name: 'Miscellaneous', isActive: true, colors: { background: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' }, isDefault: false, icon: 'Box', sortOrder: 20 },
];

// ============================================================================
// Settings Entity
// ============================================================================

/**
 * AI generation parameters (samplers)
 */
export interface SamplerSettings {
  /** Randomness (0.0 - 2.0) */
  temperature: number;

  /** Nucleus sampling threshold (0.0 - 1.0) */
  minP: number;

  /** Top-k sampling (1 - 100) */
  topK: number;

  /** Repetition penalty (1.0 - 2.0) */
  repetitionPenalty: number;

  /** Top P nucleus sampling (0.0 - 1.0) */
  topP: number;

  /** Context window size (min 2048) */
  contextLength: number;

  /** Max generation tokens (min 100) */
  maxTokens: number;
}

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
}

/**
 * AI provider configuration
 */
export interface AIConfig {
  /** API base URL */
  baseUrl: string;

  /** API key (encrypted at rest in production) */
  apiKey: string;

  /** Selected model ID */
  modelId: string;

  /** Available models (cached from API) */
  availableModels?: AIModelInfo[];

  /** Enable streaming responses */
  enableStreaming: boolean;

  /** Whether to enable reasoning/thinking mode for supported models */
  enableReasoning?: boolean;

  /** Whether to show reasoning content in the UI (when enabled by the model) */
  showReasoning?: boolean;
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
 * UI preferences
 */
export interface UIPreferences {
  /** Theme mode */
  theme: ThemeMode;

  /** Editor font size in pixels */
  editorFontSize: number;

  /** Sidebar width in pixels */
  sidebarWidth: number;

  /** Whether to show word count */
  showWordCount: boolean;

  /** Whether to enable Lore-Link highlighting */
  enableKeywordHighlight: boolean;

  /** Whether to show inline AI suggestions */
  enableAIHints: boolean;
}

/**
 * Google Drive integration configuration
 */
export interface GoogleDriveConfig {
  /** OAuth 2.0 Client ID (encrypted at rest) */
  clientId: string;

  /** API Key (encrypted at rest) */
  apiKey: string;
}

/**
 * Application settings stored per vault
 */
export interface Settings {
  /** Single settings record ID */
  id: 'app-settings';

  /** AI configuration */
  ai: AIConfig;

  /** Current sampler settings */
  sampler: SamplerSettings;

  /** Saved sampler presets */
  samplerPresets: SamplerPreset[];

  /** UI preferences */
  ui: UIPreferences;

  /** AI prompt settings */
  prompts: PromptSettings;

  /** Google Drive configuration */
  googleDrive: GoogleDriveConfig;

  /** Last active entry ID */
  lastActiveEntryId?: UUID;

  /** Context panel entry IDs */
  contextEntryIds: UUID[];

  /** Settings version for migrations */
  version: number;
}

/**
 * Default settings for new vaults
 */
export const DEFAULT_SETTINGS: Omit<Settings, 'id'> = {
  ai: {
    baseUrl: 'https://nano-gpt.com/api/v1',
    apiKey: '',
    modelId: '',
    availableModels: [],
    enableStreaming: false,
    enableReasoning: false,
    showReasoning: false,
  },
  sampler: {
    temperature: 0.7,
    minP: 0.05,
    topK: 40,
    repetitionPenalty: 1.1,
    topP: 1.0,
    contextLength: 4096,
    maxTokens: 2048,
  },
  samplerPresets: [
    { id: 'preset-creative', name: 'Creative', settings: { temperature: 0.9, minP: 0.05, topK: 50, repetitionPenalty: 1.05, topP: 0.95, contextLength: 4096, maxTokens: 2048 } },
    { id: 'preset-balanced', name: 'Balanced', settings: { temperature: 0.7, minP: 0.05, topK: 40, repetitionPenalty: 1.1, topP: 1.0, contextLength: 4096, maxTokens: 2048 } },
    { id: 'preset-factual', name: 'Factual', settings: { temperature: 0.3, minP: 0.1, topK: 20, repetitionPenalty: 1.2, topP: 0.5, contextLength: 4096, maxTokens: 1024 } },
  ],
  ui: {
    theme: 'system',
    editorFontSize: 16,
    sidebarWidth: 280,
    showWordCount: true,
    enableKeywordHighlight: true,
    enableAIHints: true,
  },
  prompts: {
    expand: 'Please expand and elaborate on the following text, adding more detail and depth while maintaining the same style and tone:\n\n"""\n${text}\n"""\n\nProvide only the expanded text without any additional commentary.',
    rewrite: 'Please rewrite the following text to improve clarity, flow, and impact while preserving the original meaning:\n\n"""\n${text}\n"""\n\nProvide only the rewritten text without any additional commentary.',
    instruct: 'Please apply the following instruction to the text below:\n\nInstruction: ${instruction}\n\nText:\n"""\n${text}\n"""\n\nProvide only the modified text without any additional commentary.',
    shorten: 'Please shorten and condense the following text, making it more concise while preserving the key meaning and essential details:\n\n"""\n${text}\n"""\n\nProvide only the shortened text without any additional commentary.',
    lengthen: 'Please lengthen the following text by adding more detail, depth, and elaboration while maintaining the same style and tone:\n\n"""\n${text}\n"""\n\nProvide only the lengthened text without any additional commentary.',
    vivid: 'Please rewrite the following text to make it more vivid and descriptive, adding sensory details, imagery, and evocative language:\n\n"""\n${text}\n"""\n\nProvide only the enhanced text without any additional commentary.',
    emotion: 'Please rewrite the following text to add more emotional depth, feeling, and character voice while preserving the original meaning:\n\n"""\n${text}\n"""\n\nProvide only the enhanced text without any additional commentary.',
    grammar: 'Please fix any grammar, spelling, and punctuation errors in the following text while preserving the original meaning and style:\n\n"""\n${text}\n"""\n\nProvide only the corrected text without any additional commentary.',
  },
  googleDrive: {
    clientId: '',
    apiKey: '',
  },
  contextEntryIds: [],
  version: 1,
};

// ============================================================================
// Keyword Entity
// ============================================================================

/**
 * Keyword entry for the Lore-Link system.
 * Stored separately for efficient indexing and lookup.
 * Composite primary key: [id, entryId] allows same keyword across multiple entries
 */
export interface Keyword {
  /** The keyword/phrase itself (case-insensitive, part of composite key) */
  id: string;

  /** Associated entry ID (part of composite key) */
  entryId: UUID;

  /** Whether this is the entry's title (auto-keyword) */
  isTitle: boolean;

  /** Creation timestamp */
  createdAt: Timestamp;
}

/**
 * In-memory keyword dictionary entry
 */
export interface KeywordDictionaryEntry {
  keyword: string;
  entryId: UUID;
  entryTitle: string;
  categoryId: CategorySlot;
}

// ============================================================================
// Export/Import Types
// ============================================================================

/**
 * Export manifest structure for ZIP exports
 */
export interface ExportManifest {
  /** Manifest version */
  version: number;

  /** Vault metadata */
  vault: {
    name: string;
    description?: string;
    exportedAt: Timestamp;
  };

  /** All entries with metadata */
  entries: Array<{
    id: UUID;
    filename: string;
    title: string;
    categoryId: CategorySlot;
    keywords: string[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
  }>;

  /** Category configurations */
  categories: Category[];

  /** Settings (excluding sensitive data) */
  settings: Omit<Settings, 'ai'> & {
    ai: Pick<AIConfig, 'modelId'>;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Options for entry queries
 */
export interface EntryQueryOptions {
  categoryId?: CategorySlot;
  searchQuery?: string;
  sortBy?: 'updatedAt' | 'createdAt' | 'title' | 'sortOrder';
  includePinned?: boolean;
}

/**
 * Repository operation result
 */
export interface RepositoryResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}
