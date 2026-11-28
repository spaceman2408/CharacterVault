import { LEGACY_STUDIO_PROMPTS } from './legacyStudioPrompts';

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
 * Vault-local attachment of a standalone lorebook to a character.
 * At most one id is kept (legacy multi-id rows are collapsed on read).
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

export interface CharacterAsset {
  type: string;
  uri: string;
  name: string;
  ext: string;
}

/** V3 card fields kept for round-trip fidelity; not editable in the app. */
export interface CharacterCardV3Extras {
  nickname?: string;
  group_only_greetings?: string[];
  source?: string[];
  creator_notes_multilingual?: Record<string, string>;
  assets?: CharacterAsset[];
  creation_date?: number;
  modification_date?: number;
}

/** Character card V2/V3 fields */
export interface CharacterSpec extends CharacterCardV3Extras {
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
  favorite?: boolean;
}

export type SnapshotSource = 'open' | 'auto' | 'manual' | 'rollback' | 'replace';

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

/**
 * Vault-local custom AI context for a standalone lorebook (1:1).
 * Not part of lorebook export/import or SillyTavern fields.
 */
export interface LorebookCustomContext {
  lorebookId: UUID;
  content: string;
  /** When true, body is included in Orion + AI toolbar context */
  enabled: boolean;
  updatedAt: Timestamp;
  charLength: number;
}

export type ChatOwnerType = 'character' | 'lorebook';
export type ChatPanel = 'orion' | 'agent';

export interface StoredChatToolEvent {
  toolName: string;
  ok: boolean;
  message: string;
  target?:
    | { type: 'field'; id: string }
    | { type: 'greeting'; index: number }
    | { type: 'entry'; id: number };
  call?: { headers: Record<string, string>; body: string };
}

export interface StoredChatResponseStats {
  ttft?: number;
  tokensPerSecond?: number;
  modelId?: string;
  providerId?: string;
  promptTokens?: number;
  cachedTokens?: number;
}

/** Vault-local Orion/Agent transcript row. Not part of card export. */
export interface StoredChatMessage {
  /** UI message id (`msg_<uuid>` or legacy `msg_${timestamp}_${random}`). */
  id: string;
  ownerType: ChatOwnerType;
  ownerId: UUID;
  panel: ChatPanel;
  seq: number;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  timestamp: number;
  stats?: StoredChatResponseStats;
  toolEvents?: StoredChatToolEvent[];
  error?: string;
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
  favorite?: boolean;
  updatedAt: Timestamp;
  createdAt: Timestamp;
  /** Tokens sent with every chat message (core definition fields) */
  activeTokens: number;
  /** Chat-relevant max: active plus greetings and lorebook entry bodies. Excludes metadata never sent to chat. */
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
  { id: 'alternate_greetings', label: 'Greetings', icon: 'MessageSquare', description: 'Alternate greetings' },
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

export interface CharacterCardV2 extends CharacterCardV3Extras {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  /** CharacterVault extension, not part of the official V2/V3 spec */
  physical_description?: string;
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

/** Prose color coding for `"dialogue"`, plain narration, and `*actions*` in editors. */
export interface RoleplayHighlightSettings {
  enabled: boolean;
  /** Hex color for `"quoted dialogue"` */
  dialogue: string;
  /**
   * Hex color for plain narration (text outside quotes / asterisks).
   * Empty string follows the editor text color.
   */
  narration: string;
  /** Hex color for `*asterisked actions*` */
  action: string;
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
    /** Ask AI opens on this chat. Missing = Orion. */
    defaultChatPanel?: DefaultChatPanel;
    /** When true, Agent tool-loop edits need review before they are applied. */
    requireAgentReview?: boolean;
    /** When true, later Agent runs are sent the exact edits of earlier runs. Missing = off. */
    agentKeepEdits?: boolean;
    /** When false, the Agent gets no skills at all; each skill keeps its own on/off. Missing = on. */
    agentSkillsEnabled?: boolean;
    /** Warn when a Creator Notes preview loads remote resources. Missing = on. */
    creatorNotesRemoteWarning?: boolean;
    spellcheck?: SpellcheckSettings;
    /** Missing = highlighting on with built-in default colors. */
    roleplayHighlight?: RoleplayHighlightSettings;
    /** Missing = macros follow the theme default. */
    macroHighlight?: MacroHighlightSettings;
    /** Typing `char` / `user` then a space or punctuation writes `{{char}}` / `{{user}}`. Missing = on. */
    macroAutoConvert?: boolean;
  };
  ai?: AIConfig;
  sampler?: SamplerSettings;
  prompts?: PromptSettings;
  promptModels?: PromptModelMap;
  /** Toolbar button layout + user-created ops. Missing = default layout. */
  toolbar?: ToolbarConfig;
  /** Per-agent endpoint + model override. Missing = use global AIConfig */
  agentModel?: PromptModelBinding;
  /** Instructions the Agent loads on demand with read_skill. Missing = DEFAULT_AGENT_SKILLS. */
  agentSkills?: AgentSkill[];
  studio?: StudioSettings;
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
    defaultChatPanel: 'orion',
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

export const DEFAULT_MACRO_AUTO_CONVERT = true;

/**
 * Single color set for both themes; each default reads on light and dark.
 * Narration defaults to empty (follow the editor text color) because no
 * single hex reads as body text on both themes.
 */
export const DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS: RoleplayHighlightSettings = {
  enabled: true,
  dialogue: '#b45309',
  narration: '',
  action: '#707070',
};

/** Retired gray narration default; stored values equal to it mean "never customized". */
const RETIRED_NARRATION_DEFAULT = '#6b7280';

function normalizeHexColor(value: unknown, fallback: string, allowEmpty = false): string {
  if (typeof value !== 'string') return fallback;
  const hex = value.trim().toLowerCase();
  if (hex === '' && allowEmpty) return '';
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  const short = /^#([0-9a-f]{3})$/.exec(hex);
  if (short) return `#${short[1][0]}${short[1][0]}${short[1][1]}${short[1][1]}${short[1][2]}${short[1][2]}`;
  return fallback;
}

/**
 * `{{char}}` / `{{user}}` name-macro colors.
 * Empty string follows the theme default.
 */
export interface MacroHighlightSettings {
  char: string;
  user: string;
}

export const DEFAULT_MACRO_HIGHLIGHT_SETTINGS: MacroHighlightSettings = {
  char: '',
  user: '',
};

export function normalizeMacroHighlight(value: unknown): MacroHighlightSettings {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Partial<MacroHighlightSettings>;
  return {
    char: normalizeHexColor(raw.char, '', true),
    user: normalizeHexColor(raw.user, '', true),
  };
}

export function normalizeRoleplayHighlight(value: unknown): RoleplayHighlightSettings {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Partial<RoleplayHighlightSettings>;
  let narration = normalizeHexColor(raw.narration, '', true);
  if (narration === RETIRED_NARRATION_DEFAULT) narration = '';
  return {
    enabled: raw.enabled !== false,
    dialogue: normalizeHexColor(raw.dialogue, DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS.dialogue),
    narration,
    action: normalizeHexColor(raw.action, DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS.action),
  };
}

export type DefaultChatPanel = 'orion' | 'agent';

export const DEFAULT_CHAT_PANEL: DefaultChatPanel = 'orion';

/** Default for Studio → Agent review gate (auto-apply preserves legacy behavior). */
export const DEFAULT_REQUIRE_AGENT_REVIEW = false;

export const DEFAULT_AGENT_KEEP_EDITS = false;

export const DEFAULT_AGENT_SKILLS_ENABLED = true;

export interface AgentSkill {
  id: string;
  name: string;
  /** The Agent sees only this line until it loads the skill, so it should say when to use it. */
  description: string;
  content: string;
  /** Missing = on. An off skill stays saved but the Agent and the @ list never see it. */
  enabled?: boolean;
}

export { DEFAULT_AGENT_SKILLS } from './defaultAgentSkills';

export const DEFAULT_CREATOR_NOTES_REMOTE_WARNING = true;

export function normalizeDefaultChatPanel(value: unknown): DefaultChatPanel {
  return value === 'agent' ? 'agent' : 'orion';
}

/** Used to backfill old settings records missing `ui.spellcheck` */
export const DEFAULT_SPELLCHECK_SETTINGS: SpellcheckSettings = {
  enabled: true,
  language: 'en',
  ignoredWords: [],
  customWords: [],
};

export interface SamplerSettings {
  temperature: number;
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

/** Identified by `baseUrl` + `modelId`, so one endpoint can have a preset per model. */
export interface CustomBaseUrlPreset {
  label: string;
  /** Normalized */
  baseUrl: string;
  /** Picked along with the URL; without it the URL's remembered model is used */
  modelId?: string;
}

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
  /** User-named endpoints shown under Saved in the base URL dropdown; kept by Clear AI Settings */
  customBaseUrlPresets?: CustomBaseUrlPreset[];
  selectedProvider?: string;
  providerByModelId?: Record<string, string>;
  subscriptionModelsOnly?: boolean;
  /** `sub` = subscription (default); `paygo` forces pay-as-you-go for provider selection */
  billingMode?: 'sub' | 'paygo';
  /** NanoGPT: route requests to a cache-capable provider via top-level `caching: true` */
  enableCacheProviderRouting?: boolean;
  openRouter?: OpenRouterOptions;
}

export const OPENROUTER_SORTS = ['price', 'throughput', 'latency'] as const;
export type OpenRouterSort = (typeof OPENROUTER_SORTS)[number];

export const OPENROUTER_QUANT_FLOORS = ['fp4', 'fp6', 'fp8', 'fp16', 'fp32'] as const;
export type OpenRouterQuantFloor = (typeof OPENROUTER_QUANT_FLOORS)[number];

/** OpenRouter routing preferences, sent as the request body's `provider` object. */
export interface OpenRouterOptions {
  /**
   * Endpoint tag (e.g. `deepinfra/fp8`) pinned per model id.
   * Kept apart from `providerByModelId` because NanoGPT and OpenRouter share model ids.
   */
  providerByModelId?: Record<string, string>;
  /** Fail instead of falling back to another host when the pinned one is down. */
  pinnedHostOnly?: boolean;
  /** Host order when no host is pinned; unset keeps OpenRouter's load balancing. */
  sort?: OpenRouterSort;
  /** Skip hosts that may store and train on prompts (`data_collection: 'deny'`). */
  denyDataCollection?: boolean;
  /** Only route to Zero Data Retention endpoints. */
  zdrOnly?: boolean;
  /** Skip hosts below this bit width (`fp8` also allows int8/mxfp8, …); unknown hosts still pass. */
  minQuantization?: OpenRouterQuantFloor;
  /** Skip hosts that don't report their quantization. */
  hideUnknownQuant?: boolean;
  /** Show only $0 models in OpenRouter model lists (requests are unchanged). */
  freeModelsOnly?: boolean;
  /**
   * Tool-calling requests (the Agent) use the `:exacto` model variant and skip `sort`.
   * OpenRouter's Auto Exacto already covers tool calls unless an explicit sort turns it off.
   */
  exactoForAgent?: boolean;
}

export interface SamplerPreset {
  id: UUID;
  name: string;
  settings: SamplerSettings;
}

export type BuiltinOperation =
  | 'expand'
  | 'rewrite'
  | 'instruct'
  | 'shorten'
  | 'lengthen'
  | 'vivid'
  | 'emotion'
  | 'grammar';

/** Toolbar operation id: one of the builtins, or a user-created `custom:<id>` op. */
export type AIOperation = BuiltinOperation | (string & {});

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

/** Missing key = use global AIConfig. Keys are builtin op ids or `custom:<id>` op ids. */
export type PromptModelMap = Partial<Record<string, PromptModelBinding>>;

/** User-created toolbar button. `id` is stable (`custom:<suffix>`) and never reused. */
export interface CustomToolbarOp {
  id: string;
  label: string;
  icon: string;
  /** Button chrome; must be a `TOOLBAR_COLOR_PALETTE` value. */
  color: string;
  /** Template; must contain `${text}`. */
  prompt: string;
}

/** Swatches offered for custom toolbar buttons. Literal hexes: native dropdown
 * popups do not resolve CSS vars, so theme vars cannot be used here. */
export const TOOLBAR_COLOR_PALETTE: { value: string; label: string }[] = [
  { value: '#7c3aed', label: 'Violet' },
  { value: '#4f46e5', label: 'Indigo' },
  { value: '#059669', label: 'Green' },
  { value: '#d97706', label: 'Amber' },
  { value: '#0891b2', label: 'Cyan' },
  { value: '#db2777', label: 'Pink' },
  { value: '#e11d48', label: 'Rose' },
  { value: '#5b5270', label: 'Gray' },
];

export const DEFAULT_CUSTOM_BUTTON_COLOR = '#5b5270';

/**
 * Toolbar layout: a single user-ordered list of op ids (builtins absent from
 * `order` are hidden). `instruct` (Custom) is always pinned by normalization.
 */
export interface ToolbarConfig {
  order: string[];
  customOps: CustomToolbarOp[];
}

/** Default toolbar order matches the historical layout (primary row first). */
export const DEFAULT_TOOLBAR_ORDER: string[] = [
  'expand',
  'rewrite',
  'instruct',
  'shorten',
  'lengthen',
  'vivid',
  'emotion',
  'grammar',
];

export const DEFAULT_TOOLBAR_CONFIG: ToolbarConfig = {
  order: [...DEFAULT_TOOLBAR_ORDER],
  customOps: [],
};

const CUSTOM_OP_ID_PATTERN = /^custom:[A-Za-z0-9_-]{1,64}$/;

function normalizeCustomToolbarOp(value: unknown): CustomToolbarOp | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id : '';
  if (!CUSTOM_OP_ID_PATTERN.test(id)) return undefined;
  const label = typeof raw.label === 'string' ? raw.label.trim() : '';
  if (!label || label.length > 40) return undefined;
  let icon = typeof raw.icon === 'string' ? raw.icon.trim() : '';
  if (!icon) icon = '✨';
  if ([...icon].length > 8) icon = '✨';
  const rawColor = typeof raw.color === 'string' ? raw.color : '';
  const color = TOOLBAR_COLOR_PALETTE.some((entry) => entry.value === rawColor)
    ? rawColor
    : DEFAULT_CUSTOM_BUTTON_COLOR;
  const prompt = typeof raw.prompt === 'string' ? raw.prompt : '';
  if (!prompt.includes('${text}')) return undefined;
  return { id, label, icon, color, prompt };
}

export function normalizeToolbarConfig(value: unknown): ToolbarConfig {
  if (value === null || value === undefined) {
    return { order: [...DEFAULT_TOOLBAR_ORDER], customOps: [] };
  }
  const raw = (typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const customOps: CustomToolbarOp[] = [];
  const seenIds = new Set<string>();
  if (Array.isArray(raw.customOps)) {
    for (const entry of raw.customOps) {
      const op = normalizeCustomToolbarOp(entry);
      if (!op || seenIds.has(op.id)) continue;
      seenIds.add(op.id);
      customOps.push(op);
    }
  }
  const knownCustom = new Set(customOps.map((op) => op.id));
  let order: string[];
  if (!Array.isArray(raw.order)) {
    order = [...DEFAULT_TOOLBAR_ORDER];
  } else {
    order = [];
    const seenOrder = new Set<string>();
    for (const entry of raw.order) {
      if (typeof entry !== 'string' || seenOrder.has(entry)) continue;
      if (DEFAULT_TOOLBAR_ORDER.includes(entry) || knownCustom.has(entry)) {
        seenOrder.add(entry);
        order.push(entry);
      }
    }
  }
  if (!order.includes('instruct')) {
    order.splice(Math.min(2, order.length), 0, 'instruct');
  }
  return { order, customOps };
}

export type StudioGenerationField = 'name' | 'description' | 'first_mes' | 'mes_example';

export interface StudioPrompts {
  system: string;
  name: string;
  description: string;
  first_mes: string;
  mes_example: string;
}

export interface StudioSettings {
  enabledFields: Record<StudioGenerationField, boolean>;
  prompts: StudioPrompts;
  tags: StudioTagPrefs;
}

export interface StudioTagPrefs {
  hideNsfw: boolean;
  hiddenCategories: string[];
  customTags: Record<string, string[]>;
}

export const DEFAULT_STUDIO_TAG_PREFS: StudioTagPrefs = {
  hideNsfw: false,
  hiddenCategories: [],
  customTags: {},
};

export const DEFAULT_STUDIO_PROMPTS: StudioPrompts = {
  system: `You write character cards for SillyTavern roleplay. Output only the requested field: no preamble, labels, or closing remarks. Call the player {{user}}. Any genre or theme is allowed.`,
  name: `Name a character for this concept: "\${concept}"

- If the concept gives a name, use it exactly.
- Otherwise choose a first name, plus a surname if it fits, that suits the character's culture, era, and setting.
- Avoid overused names like Elara, Lyra, Seraphina, Kael, or Zephyr, and word-compound names like "Stormrider".
- Output only the name, on one line.`,
  description: `Write a character description for "\${name}" based on this concept: "\${concept}"\${styleBlock}

Start with "# \${name}", then use "## " section headings with "- " bullets: 3-6 short, concrete bullets per section. No bold or asterisks.

Sections, in this order. Skip any that don't apply:
## Appearance: age, build, face, clothing
## Personality: core traits, at least one real flaw, how they act with strangers vs. people they trust
## Speech: how they talk (vocabulary, rhythm, habits)
## Likes
## Dislikes
## Skills
## Goals
## Relationship with {{user}}: only if the concept names one
## Sexual Kinks: only if the concept is explicitly sexual, and then the character must be an adult with a stated age of 18 or older
## Background: one short prose paragraph

Be specific, not generic, and keep details consistent. Don't invent a role or history for {{user}}.`,
  first_mes: `Write \${name}'s opening roleplay message to {{user}}.

Concept: "\${concept}"
Description:
\${description}\${styleBlock}

- \${narrationRule}
- Actions in *asterisks*, dialogue in "quotes".
- 2-4 paragraphs: set the scene, show who \${name} is through what they do and say, and end on something {{user}} can respond to.
- Never write {{user}}'s actions, words, thoughts, or feelings, and don't assume their gender or appearance.`,
  mes_example: `Write 3 example exchanges that show how \${name} talks and acts.

Concept: "\${concept}"
Description:
\${description}\${firstMessageBlock}\${styleBlock}

Format each exchange exactly like this:
<START>
{{user}}: [one line]
{{char}}: [reply]

- \${narrationRule}
- Actions in *asterisks*, dialogue in "quotes". Each {{char}} reply is 1-2 paragraphs in the same style as the opening message.
- Show three different moments: everyday, tense or emotional, and one that shows a quirk or skill. Don't repeat the opening message or reuse catchphrases.
- Write {{char}} instead of the character's name.
- Never write {{user}}'s actions, words, thoughts, or feelings, and don't assume their gender or appearance.`,
};

export const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  enabledFields: {
    name: true,
    description: true,
    first_mes: true,
    mes_example: true,
  },
  prompts: { ...DEFAULT_STUDIO_PROMPTS },
  tags: {
    hideNsfw: false,
    hiddenCategories: [],
    customTags: {},
  },
};

function currentStudioPrompt(key: keyof StudioPrompts, value: string | undefined): string {
  if (!value || LEGACY_STUDIO_PROMPTS.some((legacy) => legacy[key] === value)) {
    return DEFAULT_STUDIO_PROMPTS[key];
  }
  return value;
}

export function normalizeStudioSettings(value: unknown): StudioSettings {
  const raw = (value ?? {}) as Partial<StudioSettings>;
  const enabled = (raw.enabledFields ?? {}) as Partial<Record<StudioGenerationField, boolean>>;
  const prompts = (raw.prompts ?? {}) as Partial<StudioPrompts>;
  const tags = (raw.tags ?? {}) as Partial<StudioTagPrefs>;
  const customTags: Record<string, string[]> = {};
  for (const [key, list] of Object.entries(tags.customTags ?? {})) {
    if (Array.isArray(list)) {
      const cleaned = [...new Set(list.filter((t) => typeof t === 'string' && t.trim()))];
      if (cleaned.length > 0) customTags[key] = cleaned;
    }
  }
  return {
    enabledFields: {
      name: true,
      description: true,
      first_mes: enabled.first_mes ?? true,
      mes_example: enabled.mes_example ?? true,
    },
    prompts: {
      system: currentStudioPrompt('system', prompts.system),
      name: currentStudioPrompt('name', prompts.name),
      description: currentStudioPrompt('description', prompts.description),
      first_mes: currentStudioPrompt('first_mes', prompts.first_mes),
      mes_example: currentStudioPrompt('mes_example', prompts.mes_example),
    },
    tags: {
      hideNsfw: tags.hideNsfw ?? false,
      hiddenCategories: Array.isArray(tags.hiddenCategories)
        ? tags.hiddenCategories.filter((c): c is string => typeof c === 'string')
        : [],
      customTags,
    },
  };
}

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
    enableCacheProviderRouting: false,
    customBaseUrlPresets: [],
  } satisfies AIConfig,
  sampler: {
    temperature: 1.0,
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
  toolbar: { order: [...DEFAULT_TOOLBAR_ORDER], customOps: [] },
  agentModel: undefined as PromptModelBinding | undefined,
};

export function clampContextLength(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.sampler.contextLength;
  return Math.min(CONTEXT_LENGTH_MAX, Math.max(CONTEXT_LENGTH_MIN, Math.round(value)));
}
