/**
 * @fileoverview Generated card preview component for AI Creation Studio
 * @module @pages/ai-creation-studio/GeneratedCardPreview
 */

import React, { useRef, useEffect, useState, memo } from 'react';
import { Type, FileText, MessageCircle, MessagesSquare, Sparkles } from 'lucide-react';
import type { GenerationField } from './types';
import { GENERATION_FIELDS } from './types';
import type { StudioSettings } from '../../db/characterTypes';
import { estimateTokens } from '../../services/AIService';

const FieldReasoning: React.FC<{ reasoning: string }> = memo(({ reasoning }) => {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || userScrolledUp.current) return;
    el.scrollTop = el.scrollHeight;
  }, [reasoning]);

  if (!reasoning.trim()) return null;

  return (
    <div>
      <button
        onClick={() => {
          setOpen(!open);
          userScrolledUp.current = false;
        }}
        className="flex items-center gap-1 p-0.5 rounded text-fg-subtle hover:text-fg transition-colors"
        title={open ? 'Hide thinking' : 'Show thinking'}
      >
        <Sparkles className="w-3 h-3 text-accent" />
        <span className="text-[11px]">Thinking</span>
      </button>
      {open && (
        <div
          ref={contentRef}
          onScroll={() => {
            const el = contentRef.current;
            if (!el) return;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
            userScrolledUp.current = !atBottom;
          }}
          className="mt-1 max-h-32 sm:max-h-40 overflow-y-auto bg-muted/90 border border-border rounded-md px-2 py-1.5 shadow-sm"
        >
          <pre className="font-mono text-fg-subtle whitespace-pre-wrap leading-relaxed">
            {reasoning}
          </pre>
        </div>
      )}
    </div>
  );
});

FieldReasoning.displayName = 'FieldReasoning';

interface GeneratedCardPreviewProps {
  generatedData: Record<string, string | undefined>;
  generatedReasoning: Partial<Record<GenerationField, string>>;
  enabledFields?: StudioSettings['enabledFields'];
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
  enabledFields,
  onFieldChange,
}) => {
  const visibleFields = enabledFields
    ? GENERATION_FIELDS.filter((f) => enabledFields[f.key] !== false)
    : GENERATION_FIELDS;
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-fg-muted mb-3">
        Generated Card
      </h3>

      {visibleFields.map((field) => {
        const value = generatedData[field.key] || '';
        const tokenCount = estimateTokens(value);
        const reasoning = generatedReasoning[field.key];

        return (
          <div key={field.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted uppercase tracking-wider">
                {FIELD_ICONS[field.key]}
                {field.label}
              </label>
              {value && (
                <span className="text-xs text-fg-subtle">
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
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent transition-all"
              />
            ) : (
              <StreamingTextarea
                value={value}
                onChange={(e) => onFieldChange(field.key, e.target.value)}
                placeholder={FIELD_PLACEHOLDERS[field.key]}
                rows={field.key === 'description' ? 6 : 4}
                className={`w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-fg resize-y overflow-y-auto focus:outline-none focus:ring-2 focus:ring-accent transition-all ${
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
