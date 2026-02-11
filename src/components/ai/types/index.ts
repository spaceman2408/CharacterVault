/**
 * @fileoverview Type definitions for AI chat components.
 * @module components/ai/types
 */

import type { SamplerSettings, AIConfig, PromptSettings } from '../../../db/types';

/**
 * Chat message in a conversation
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  timestamp: number;
}

/**
 * Selection info from the editor
 */
export interface SelectionInfo {
  from: number;
  to: number;
  text: string;
}

/**
 * Props for the AIChatPanel component
 */
export interface AIChatPanelProps {
  /** The selected text (optional context) */
  selectedText: string;
  /** Context entry IDs (will be resolved to content) */
  contextEntryIds: string[];
  /** AI configuration */
  aiConfig: AIConfig;
  /** Sampler settings */
  samplerSettings: SamplerSettings;
  /** Prompt settings */
  promptSettings: PromptSettings;
  /** Callback when an operation is completed (user accepts result) */
  onComplete: (result: string, operation: 'ask', originalSelectedText: string) => void;
  /** Function to resolve context entry IDs to content */
  getContextContent?: (entryIds: string[]) => Promise<string[]>;
  /** Callback to replace selected text (does not close panel) - receives text and selection range */
  onReplaceSelectedText?: (text: string, selection: SelectionInfo | null) => void;
  /** Function to get current selection info from editor */
  getEditorSelection?: () => SelectionInfo | null;
  /** Current section ID - used for context */
  activeSection?: string | null;
  /** Callback to close panel (for mobile) */
  onClose?: () => void;
  /** Whether this is mobile view (shows close button) */
  isMobile?: boolean;
}

/**
 * Streaming chunk from AI service
 */
export interface StreamingChunk {
  content?: string;
  reasoning?: string;
}

/**
 * Conversation message for AI service
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}
