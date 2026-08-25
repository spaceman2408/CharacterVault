import type {
  AIConfig,
  CharacterBook,
  CharacterSection,
  CustomContextMeta,
  LorebookEntry,
  PromptModelMap,
  PromptSettings,
  SamplerSettings,
  SpellcheckSettings,
} from '../../../db/characterTypes';

export interface LorebookCustomContextControls {
  ownerId: string;
  meta: CustomContextMeta;
  onSetEnabled: (enabled: boolean) => Promise<void>;
  onSave: (input: { content: string; enabled: boolean }) => Promise<void>;
  onClear: () => Promise<void>;
}

export interface LorebookEditorProps {
  lorebook: CharacterBook | undefined;
  onChange: (lorebook: CharacterBook) => void;
  onDelete?: () => void;
  setSelectedText: (text: string) => void;
  contextSectionIds: CharacterSection[];
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  promptModels?: PromptModelMap;
  getContextContent: (sectionIds: CharacterSection[]) => string[] | Promise<string[]>;
  activeSection: string;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  characterName?: string;
  spellcheck?: SpellcheckSettings;
  markdownImageOpenLinks?: boolean;
  /** Standalone vault books only — not used for character-embedded lorebooks */
  customContext?: LorebookCustomContextControls;
  /** Character workspace only — compact attach control in the entry header */
  attachment?: LorebookAttachmentControls;
}

export interface LorebookAttachmentControls {
  characterId: string;
  embeddedBook: CharacterBook | undefined;
  characterName?: string;
  onCopyIntoEmbedded: (book: CharacterBook) => void;
}

export interface LorebookEntryListItemProps {
  entry: LorebookEntry;
  index: number;
  tokenCount: number | null;
  isSelected: boolean;
  isContextEnabled: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onToggleContext: () => void;
}

export interface LorebookEntryDetailProps {
  entry: LorebookEntry;
  /** All book entries (parent draft); open entry is merged with live draft for recursion stats. */
  allEntries: LorebookEntry[];
  onPersistUpdate: (entry: LorebookEntry) => void;
  onOpenRecursionMap: () => void; // opens map on ego tab
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  promptModels?: PromptModelMap;
  getContextContent: (sectionIds: CharacterSection[]) => string[] | Promise<string[]>;
  contextSectionIds: CharacterSection[];
  setSelectedText: (text: string) => void;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  spellcheck?: SpellcheckSettings;
  markdownImageOpenLinks?: boolean;
  isOptionsOpen: boolean;
  onOptionsOpenChange: (open: boolean) => void;
}

export type ContextUsageStatus = 'good' | 'warning' | 'danger';

export interface ContextUsageSummary {
  included: number;
  tokens: number;
  limit: number;
  percentage: number;
  status: ContextUsageStatus;
}
