/**
 * @fileoverview Types for AI Creation Studio
 * @module @pages/ai-creation-studio/types
 */

import type { CharacterSpec } from '../../db/characterTypes';

export type GenerationField = 'name' | 'description' | 'first_mes' | 'mes_example';

export type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error';

export interface GenerationState {
  status: GenerationStatus;
  currentField: GenerationField | null;
  completedFields: GenerationField[];
  generatedData: Partial<Pick<CharacterSpec, GenerationField>>;
  generatedReasoning: Partial<Record<GenerationField, string>>;
  error: string | null;
  failedField: GenerationField | null;
}

export interface FieldConfig {
  key: GenerationField;
  label: string;
  icon: string;
  /** When true, the field can be toggled off in Studio settings. */
  isOptional: boolean;
}

export const GENERATION_FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Name', icon: 'Type', isOptional: false },
  { key: 'description', label: 'Description', icon: 'FileText', isOptional: false },
  { key: 'first_mes', label: 'First Message', icon: 'MessageCircle', isOptional: true },
  { key: 'mes_example', label: 'Examples', icon: 'MessagesSquare', isOptional: true },
];

/** Input mode for the creation studio concept area */
export type InputMode = 'write' | 'tags';

/** Tag selections grouped by category */
export type TagSelections = Record<string, string[]>;
