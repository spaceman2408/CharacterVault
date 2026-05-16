/**
 * @fileoverview Generated card preview component for AI Creation Studio
 * @module @pages/ai-creation-studio/GeneratedCardPreview
 */

import React, { useRef, useEffect, useState, memo } from 'react';
import { Type, FileText, MessageCircle, MessagesSquare, Sparkles } from 'lucide-react';
import type { GenerationField } from './types';
import { GENERATION_FIELDS } from './types';
import { estimateTokens } from '../../services/AIService';

const FieldReasoning: React.FC<{ reasoning: string }> = memo(({ reasoning }) => {
  const [open, setOpen] = useState(false);

  if (!reasoning.trim()) return null;

  return (
    <div className="flex items-start gap-1">
      <button
        onClick={() => setOpen(!open)}
        className="mt-0.5 flex items-center gap-1 p-0.5 rounded text-vault-300 dark:text-vault-600 hover:text-vault-500 dark:hover:text-vault-300 transition-colors"
        title={open ? 'Hide thinking' : 'Show thinking'}
      >
        <Sparkles className="w-3 h-3" />
        <span className="text-[11px]">Thinking</span>
      </button>
      {open && (
        <pre className="flex-1 text-[11px] font-mono text-vault-400 dark:text-vault-500 whitespace-pre-wrap leading-relaxed">
          {reasoning}
        </pre>
      )}
    </div>
  );
});

FieldReasoning.displayName = 'FieldReasoning';

interface GeneratedCardPreviewProps {
  generatedData: Record<string, string | undefined>;
  generatedReasoning: Partial<Record<GenerationField, string>>;
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

/** Auto-scrolling textarea that follows streamed content to the bottom */
const StreamingTextarea: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  rows: number;
  className: string;
}> = ({ value, onChange, placeholder, rows, className }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const userScrolledUp = useRef(false);

  // Detect if the user has scrolled up manually
  const handleScroll = () => {
    const el = ref.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    userScrolledUp.current = !atBottom;
  };

  // Auto-scroll to bottom when value changes, unless user scrolled up
  useEffect(() => {
    const el = ref.current;
    if (!el || userScrolledUp.current) return;
    el.scrollTop = el.scrollHeight;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      onScroll={handleScroll}
      placeholder={placeholder}
      rows={rows}
      className={className}
    />
  );
};

export const GeneratedCardPreview: React.FC<GeneratedCardPreviewProps> = ({
  generatedData,
  generatedReasoning,
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
        const reasoning = generatedReasoning[field.key];

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

            {reasoning && <FieldReasoning reasoning={reasoning} />}

            {field.key === 'name' ? (
              <input
                type="text"
                value={value}
                onChange={(e) => onFieldChange(field.key, e.target.value)}
                placeholder={FIELD_PLACEHOLDERS[field.key]}
                className="w-full px-3 py-2 bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-800 rounded-lg text-sm text-vault-900 dark:text-vault-100 focus:outline-none focus:ring-2 focus:ring-vault-500 dark:focus:ring-vault-400 transition-all"
              />
            ) : (
              <StreamingTextarea
                value={value}
                onChange={(e) => onFieldChange(field.key, e.target.value)}
                placeholder={FIELD_PLACEHOLDERS[field.key]}
                rows={field.key === 'description' ? 6 : 4}
                className={`w-full px-3 py-2 bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-800 rounded-lg text-sm text-vault-900 dark:text-vault-100 resize-y overflow-y-auto focus:outline-none focus:ring-2 focus:ring-vault-500 dark:focus:ring-vault-400 transition-all ${
                  field.key === 'description' ? 'max-h-48' : 'max-h-36'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
