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
  type ReasoningParseResult,
} from './ReasoningParser';

// Provider adapters
export {
  resolveProvider,
  NanoGPTProvider,
  OpenAICompatProvider,
  type IProviderAdapter,
  type ModelProvider,
  type ModelProviderInfo,
  type ExtendedAIModelInfo,
  type FetchModelsOptions,
} from './providers';

// CharacterVault services
export { CharacterSettingsService, characterSettingsService } from './CharacterSettingsService';
export { CharacterImportService, characterImportService } from './CharacterImportService';
export { CharacterExportService, characterExportService } from './CharacterExportService';
export { CharacterSnapshotService, characterSnapshotService, type SnapshotRestoreAction } from './CharacterSnapshotService';
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
