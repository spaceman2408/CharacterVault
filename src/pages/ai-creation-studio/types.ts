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
  error: string | null;
  failedField: GenerationField | null;
}

export interface FieldConfig {
  key: GenerationField;
  label: string;
  icon: string;
}

export const GENERATION_FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Name', icon: 'Type' },
  { key: 'description', label: 'Description', icon: 'FileText' },
  { key: 'first_mes', label: 'First Message', icon: 'MessageCircle' },
  { key: 'mes_example', label: 'Examples', icon: 'MessagesSquare' },
];
