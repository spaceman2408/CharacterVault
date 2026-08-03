/**
 * @fileoverview Type definitions for AI chat components.
 * @module components/ai/types
 */

import type { SamplerSettings, AIConfig, PromptSettings } from '../../../db/characterTypes';

export interface ResponseStats {
  ttft?: number;
  tokensPerSecond?: number;
  modelId?: string;
  providerId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  timestamp: number;
  stats?: ResponseStats;
  suppressInitialAnimation?: boolean;
}

export interface SelectionInfo {
  from: number;
  to: number;
  text: string;
}

export interface AIChatPanelProps {
  selectedText: string;
  contextEntryIds: string[];
  /** When true, vault-local custom context is enabled for this character */
  customContextIncluded?: boolean;
  aiConfig: AIConfig;
  samplerSettings: SamplerSettings;
  promptSettings: PromptSettings;
  onComplete: (result: string, operation: 'ask', originalSelectedText: string) => void;
  getContextContent?: (entryIds: string[]) => Promise<string[]>;
  onReplaceSelectedText?: (text: string, selection: SelectionInfo | null) => void;
  getEditorSelection?: () => SelectionInfo | null;
  activeSection?: string | null;
  onClose?: () => void;
  isMobile?: boolean;
}

export interface StreamingChunk {
  content?: string;
  reasoning?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}
