/**
 * @fileoverview Barrel export for services layer.
 * @module @services
 */

export {
  AIService,
  AIError,
  createAIService,
  estimateTokens,
  estimateCharacterCardTokens,
  formatTokenEstimate,
  truncateTextToTokenLimit,
  fitContextChunks,
  BYTES_PER_TOKEN,
  type AIErrorType,
  type CharacterTokenEstimate,
  type ChatMessage,
  type ChatCompletionRequestBody,
  type AIRequestPreview,
} from './AIService';
export {
  ReasoningFormat,
  ReasoningParser,
  detectReasoningFormat,
  extractMessageReasoning,
  STRUCTURED_FIELD_EXTRACTORS,
  THINK_TAG_PAIRS,
  FORMAT_HINT_RULES,
  type ReasoningParseResult,
} from './ReasoningParser';

// Provider adapters
export {
  resolveProvider,
  NanoGPTProvider,
  OpenAICompatProvider,
  OpenRouterProvider,
  SyntheticProvider,
  type IProviderAdapter,
  type ModelProvider,
  type ModelProviderInfo,
  type ExtendedAIModelInfo,
  type FetchModelsOptions,
  type OpenRouterKeyInfo,
  type SyntheticQuotas,
  type SyntheticQuotaWindow,
  type SyntheticRollingFiveHourLimit,
  type SyntheticSubscriptionQuota,
  type SyntheticWeeklyTokenLimit,
} from './providers';

// CharacterVault services
export { CharacterSettingsService, characterSettingsService } from './CharacterSettingsService';
export { CharacterImportService, characterImportService } from './CharacterImportService';
export { CharacterExportService, characterExportService } from './CharacterExportService';
export { CharacterSnapshotService, characterSnapshotService, type SnapshotRestoreAction } from './CharacterSnapshotService';
export {
  CustomContextService,
  customContextService,
  CUSTOM_CONTEXT_HEADER,
  formatCustomContextChunk,
  estimateCustomContextTokensFromCharLength,
  type CustomContextOwner,
} from './CustomContextService';
export {
  openHistoryAfterFlush,
  shouldComputePayloadHash,
  loadSnapshotDiff,
  type OpenHistoryAfterFlushOptions,
  type SnapshotDiffLoader,
} from './historyLifecycle';

// Lorebook format converter
export {
  detectLorebookFormat,
  importLorebook,
  exportLorebook,
  convertSTLorebook,
  convertToSTLorebook,
  type STLorebookEntry,
  type STLorebookExport,
} from './LorebookConverter';

export { LorebookService, lorebookService } from './LorebookService';
export {
  LorebookSnapshotService,
  lorebookSnapshotService,
  buildLorebookSnapshotPayload,
  computeLorebookPayloadHash,
} from './LorebookSnapshotService';
export {
  LorebookAttachmentService,
  lorebookAttachmentService,
  type ResolvedLorebookAttachment,
} from './LorebookAttachmentService';
