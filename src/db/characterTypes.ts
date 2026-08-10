export type UUID = string;

/** ISO 8601 */
export type Timestamp = string;

/** Insertion position for a lorebook entry (SillyTavern-compatible strings + at-depth). */
export type LorebookPosition =
  | 'before_char'
  | 'after_char'
  | 'before_example'
  | 'after_example'
  | 'at_depth';

/** ST selectiveLogic: 0=AND ANY, 1=NOT ALL, 2=NOT ANY, 3=AND ALL */
export type LorebookSelectiveLogic = 0 | 1 | 2 | 3;

/** ST role when position is at_depth: 0=system, 1=user, 2=assistant */
export type LorebookDepthRole = 0 | 1 | 2;

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
  position?: LorebookPosition;
  /** Selective logic when selective is true (ST selectiveLogic). */
  selectiveLogic?: LorebookSelectiveLogic;
  /** Match whole words (ST matchWholeWords). Null/undefined = inherit default. */
  matchWholeWords?: boolean | null;
  /** Trigger probability 0–100 (ST probability). */
  probability?: number;
  /** When false, probability is ignored (ST useProbability). */
  useProbability?: boolean;
  /** Chat depth for at_depth position (ST depth). */
  depth?: number;
  /** Message role for at_depth (ST role). */
  role?: LorebookDepthRole | null;
  /** Non-recursable (ST excludeRecursion). */
  excludeRecursion?: boolean;
  /** Prevent further recursion (ST preventRecursion). */
  preventRecursion?: boolean;
  /** Delay until recursion (ST delayUntilRecursion). */
  delayUntilRecursion?: boolean;
}

export interface CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions: Record<string, unknown>;
  entries: LorebookEntry[];
}

/** Standalone vault lorebook (not embedded in a character card). */
export interface VaultLorebook {
  id: UUID;
  name: string;
  description?: string;
  tags: string[];
  book: CharacterBook;
  version: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastOpenedAt?: Timestamp;
}

/** Lightweight row for the lorebook vault grid. */
export interface LorebookListItem {
  id: UUID;
  name: string;
  description?: string;
  tags: string[];
  entryCount: number;
  totalTokens: number;
  updatedAt: Timestamp;
  lastOpenedAt?: Timestamp;
}

export interface LorebookSnapshotPayload {
  name: string;
  description?: string;
  tags: string[];
  book: CharacterBook;
}

export interface LorebookSnapshot {
  id: UUID;
  lorebookId: UUID;
  source: SnapshotSource;
  createdAt: Timestamp;
  payload: LorebookSnapshotPayload;
  payloadHash: string;
}

export interface LorebookSnapshotMetadata {
  id: UUID;
  lorebookId: UUID;
  source: SnapshotSource;
  createdAt: Timestamp;
  payloadHash: string;
}

export interface CreateLorebookSnapshotInput {
  lorebookId: UUID;
  source: SnapshotSource;
  payload: LorebookSnapshotPayload;
  payloadHash: string;
}

export interface CreateVaultLorebookInput {
  name: string;
  description?: string;
  tags?: string[];
  book?: CharacterBook;
}

export interface UpdateVaultLorebookInput {
  name?: string;
  description?: string;
  tags?: string[];
  book?: CharacterBook;
}

/**
 * Vault-local attachment of standalone lorebooks to a character.
 * Not part of SillyTavern card export.
 */
export interface CharacterLorebookAttachments {
  characterId: UUID;
  lorebookIds: UUID[];
  updatedAt: Timestamp;
}

export function createEmptyCharacterBook(name = ''): CharacterBook {
  return {
    name,
    description: '',
    entries: [],
    extensions: {},
  };
}

/** Character card V2/V3 fields */
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
  // V3
  avatar?: string;
  creator_notes?: string;
  creator?: string;
  character_version?: string;
  tags?: string[];
}

export interface CharacterExtensions {
  [key: string]: unknown;
}

export interface Character {
  id: UUID;
  name: string;
  /** Full-resolution PNG (base64) */
  imageData: string;
  /** JPEG thumbnail, max 128×192 (base64) */
  thumbnailData: string;
  data: {
    spec: CharacterSpec;
    characterBook?: CharacterBook;
    extensions?: CharacterExtensions;
  };
  version: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastOpenedAt?: Timestamp;
}

export type SnapshotSource = 'open' | 'auto' | 'manual' | 'rollback';

/** Content-addressed image store; identical images share one row */
export interface StoredImage {
  /** Content hash of imageData (primary key) */
  id: string;
  imageData: string;
  thumbnailData: string;
}

/** Cached Hunspell dictionary (raw .aff / .dic text) */
export interface SpellDictionaryCacheEntry {
  id: string;
  aff: string;
  dic: string;
  cachedAt: number;
}

/**
 * Vault-local custom AI context for a character (1:1).
 * Not part of card export/import or SillyTavern fields.
 */
export interface CharacterCustomContext {
  characterId: UUID;
  content: string;
  /** When true, body is included in Orion + AI toolbar context */
  enabled: boolean;
  updatedAt: Timestamp;
  /** For usage UI without loading the full body */
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
  /** FK into storedImages; null when no image */
  imageHash: string | null;
}

/** Timeline list shape — excludes heavy payload */
export interface SnapshotMetadata {
  id: UUID;
  characterId: UUID;
  source: SnapshotSource;
  createdAt: Timestamp;
  payloadHash: string;
  imageHash: string | null;
}

export interface CreateSnapshotInput {
  characterId: UUID;
  source: SnapshotSource;
  payload: CharacterSnapshotPayload;
  payloadHash: string;
  imageHash: string | null;
}

export interface SnapshotDiffEntry {
  section: CharacterSection | 'image' | 'extensions' | 'lorebook';
  label: string;
  changed: boolean;
  snapshotValue: unknown;
  currentValue: unknown;
}

export interface CreateCharacterInput {
  name: string;
  imageData?: string;
  thumbnailData?: string;
  data?: Partial<Character['data']>;
}

export interface UpdateCharacterInput {
  name?: string;
  imageData?: string;
  thumbnailData?: string;
  data?: Partial<Character['data']>;
}

/** Vault card list row */
export interface CharacterListItem {
  id: UUID;
  name: string;
  thumbnailData: string;
  lastOpenedAt?: Timestamp;
  updatedAt: Timestamp;
  /** Tokens typically always in an RP prompt (core fields, not greetings/lore) */
  activeTokens: number;
  /** Full-card estimate including greetings, lorebook, and metadata */
  totalTokens: number;
  /** Search only — not rendered as tag chips on the card */
  tags: string[];
}

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
  // V3
  | 'avatar'
  | 'creator_notes'
  | 'creator'
  | 'character_version'
  | 'tags';

export interface SectionMeta {
  id: CharacterSection;
  label: string;
  icon: string;
  description: string;
}

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

/** Fallback tab order when settings.sectionOrder is unset */
export const DEFAULT_SECTION_ORDER: CharacterSection[] = CHARACTER_SECTIONS.map(s => s.id);

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
  // V3
  creator?: string;
  character_version?: string;
  tags?: string[];
  creator_notes?: string;
  avatar?: string;
}

export interface PNGMetadata {
  /** Base64-encoded character JSON (tEXt `chara` chunk) */
  chara?: string;
  [key: string]: string | undefined;
}

export interface ImportCharacterResult {
  success: boolean;
  character?: Character;
  error?: string;
}

export interface ExportCharacterResult {
  success: boolean;
  blob?: Blob;
  filename?: string;
  error?: string;
}

export interface SillyTavernClipboardPayload {
  source: 'st';
  character: CharacterCardV2;
  avatar: string | null;
}

export interface ClipboardValidationResult {
  success: boolean;
  characterData?: CharacterCardV2;
  avatarData?: string;
  error?: string;
}

export interface SpellcheckSettings {
  enabled: boolean;
  /** Currently only `en` is bundled */
  language: string;
  ignoredWords: string[];
  customWords: string[];
}

export interface CharacterVaultSettings {
  id: 'app-settings';
  ui: {
    theme: 'light' | 'dark' | 'system';
    editorFontSize: number;
    sidebarWidth: number;
    showLuckyVortex?: boolean;
    /**
     * When true, clicking Markdown image syntax opens the URL after a safety
     * warning. Highlighting is always on. Default true when undefined.
     */
    markdownImageOpenLinks?: boolean;
    spellcheck?: SpellcheckSettings;
  };
  ai?: AIConfig;
  sampler?: SamplerSettings;
  prompts?: PromptSettings;
  promptModels?: PromptModelMap;
  contextSectionIds?: CharacterSection[];
  /** Undefined = default order */
  sectionOrder?: CharacterSection[];
  /** Undefined = all visible */
  hiddenSections?: CharacterSection[];
  lastActiveCharacterId?: UUID;
  version: number;
}

export const DEFAULT_CHARACTER_VAULT_SETTINGS: Omit<CharacterVaultSettings, 'id'> = {
  ui: {
    theme: 'system',
    editorFontSize: 16,
    sidebarWidth: 280,
    markdownImageOpenLinks: true,
    spellcheck: {
      enabled: true,
      language: 'en',
      ignoredWords: [],
      customWords: [],
    },
  },
  version: 1,
};

/** Default for Studio → open control on Markdown image links */
export const DEFAULT_MARKDOWN_IMAGE_OPEN_LINKS = true;

/** Used to backfill old settings records missing `ui.spellcheck` */
export const DEFAULT_SPELLCHECK_SETTINGS: SpellcheckSettings = {
  enabled: true,
  language: 'en',
  ignoredWords: [],
  customWords: [],
};

export interface SamplerSettings {
  temperature: number;
  minP: number;
  /** 0 = disabled */
  topK: number;
  repetitionPenalty: number;
  topP: number;
  contextLength: number;
  maxTokens: number;
}

/** Absolute minimum (2K preset only) */
export const CONTEXT_LENGTH_MIN = 2048;

/** Minimum for free-form custom context length */
export const CONTEXT_LENGTH_CUSTOM_MIN = 4096;

export const CONTEXT_LENGTH_MAX = 1_000_000;

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

export interface AIModelInfo {
  id: string;
  name: string;
  contextLength?: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
  /** NanoGPT provider-selection support */
  supportsProviderSelection?: boolean;
}

/**
 * Reasoning effort for thinking models.
 * Gateways accept different subsets; AIService remaps unsupported values at request time.
 */
export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface AIConfig {
  baseUrl: string;
  apiKey: string;
  apiKeysByBaseUrl?: Record<string, string>;
  modelId: string;
  modelIdsByBaseUrl?: Record<string, string>;
  availableModels?: AIModelInfo[];
  enableStreaming: boolean;
  enableReasoning?: boolean;
  showReasoning?: boolean;
  reasoningEffort?: ReasoningEffort;
  /** Preserved when switching between preset and custom base URLs */
  lastCustomBaseUrl?: string;
  selectedProvider?: string;
  providerByModelId?: Record<string, string>;
  subscriptionModelsOnly?: boolean;
  /** `sub` = subscription (default); `paygo` forces pay-as-you-go for provider selection */
  billingMode?: 'sub' | 'paygo';
}

export interface SamplerPreset {
  id: UUID;
  name: string;
  settings: SamplerSettings;
}

export type AIOperation =
  | 'expand'
  | 'rewrite'
  | 'instruct'
  | 'shorten'
  | 'lengthen'
  | 'vivid'
  | 'emotion'
  | 'grammar';

/** Toolbar operation prompts; each template must include `${text}` (instruct also needs `${instruction}`) */
export interface PromptSettings {
  expand: string;
  rewrite: string;
  instruct: string;
  shorten: string;
  lengthen: string;
  vivid: string;
  emotion: string;
  grammar: string;
}

/**
 * Per-operation endpoint + model override.
 * `baseUrl` should be normalized (trim, no trailing slash) to match apiKeysByBaseUrl keys.
 */
export interface PromptModelBinding {
  baseUrl: string;
  modelId: string;
}

/** Missing key = use global AIConfig */
export type PromptModelMap = Partial<Record<keyof PromptSettings, PromptModelBinding>>;

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

export function clampContextLength(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.sampler.contextLength;
  return Math.min(CONTEXT_LENGTH_MAX, Math.max(CONTEXT_LENGTH_MIN, Math.round(value)));
}
