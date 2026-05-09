/**
 * @fileoverview Generated card preview component for AI Creation Studio
 * @module @pages/ai-creation-studio/GeneratedCardPreview
 */

import React from 'react';
import { Type, FileText, MessageCircle, MessagesSquare } from 'lucide-react';
import type { GenerationField } from './types';
import { GENERATION_FIELDS } from './types';
import { estimateTokens } from '../../services/AIService';

interface GeneratedCardPreviewProps {
  generatedData: Record<string, string | undefined>;
  onFieldChange: (field: GenerationField, value: string) => void;
}

const FIELD_ICONS: Record<GenerationField, React.ReactNode> = {
  name: <Type className="w-4 h-4" />,
  description: <FileText className="w-4 h-4" />,
  first_mes: <MessageCircle className="w-4 h-4" />,
  mes_example: <MessagesSquare className="w-4 h-4" />,
};

const FIELD_PLACEHOLDERS: Record<GenerationField, string> = {
  name: 'Character name...',
  description: 'Character description...',
  first_mes: 'First message...',
  mes_example: 'Example dialogues...',
};

export const GeneratedCardPreview: React.FC<GeneratedCardPreviewProps> = ({
  generatedData,
  onFieldChange,
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-vault-700 dark:text-vault-300 mb-3">
        Generated Card
      </h3>

      {GENERATION_FIELDS.map((field) => {
        const value = generatedData[field.key] || '';
        const tokenCount = estimateTokens(value);

        return (
          <div key={field.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-vault-600 dark:text-vault-400 uppercase tracking-wider">
                {FIELD_ICONS[field.key]}
                {field.label}
              </label>
              {value && (
                <span className="text-xs text-vault-400 dark:text-vault-500">
                  ~{tokenCount} tokens
                </span>
              )}
            </div>

            {field.key === 'name' ? (
              <input
                type="text"
                value={value}
                onChange={(e) => onFieldChange(field.key, e.target.value)}
                placeholder={FIELD_PLACEHOLDERS[field.key]}
                className="w-full px-3 py-2 bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-800 rounded-lg text-sm text-vault-900 dark:text-vault-100 focus:outline-none focus:ring-2 focus:ring-vault-500 dark:focus:ring-vault-400 transition-all"
              />
            ) : (
              <textarea
                value={value}
                onChange={(e) => onFieldChange(field.key, e.target.value)}
                placeholder={FIELD_PLACEHOLDERS[field.key]}
                rows={field.key === 'description' ? 6 : 4}
                className="w-full px-3 py-2 bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-800 rounded-lg text-sm text-vault-900 dark:text-vault-100 resize-y focus:outline-none focus:ring-2 focus:ring-vault-500 dark:focus:ring-vault-400 transition-all"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
