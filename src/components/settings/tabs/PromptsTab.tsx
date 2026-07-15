/**
 * @fileoverview Custom AI operation prompts tab.
 * @module components/settings/tabs/PromptsTab
 */

import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, MessageSquare, Sparkles, Target } from 'lucide-react';
import type { PromptSettings } from '../../../db/characterTypes';
import { SettingsCard } from '../components/SettingsCard';
import type { SettingsTabProps } from '../types';

const PRIMARY_PROMPTS = ['expand', 'rewrite', 'instruct'] as const;
const POLISH_PROMPTS = ['shorten', 'lengthen', 'vivid', 'emotion', 'grammar'] as const;

function promptLabel(promptType: keyof PromptSettings): string {
  if (promptType === 'expand') return 'Enhance Prompt';
  if (promptType === 'rewrite') return 'Rephrase Prompt';
  if (promptType === 'instruct') return 'Custom Prompt';
  if (promptType === 'grammar') return 'Fix Prompt';
  return `${promptType.charAt(0).toUpperCase() + promptType.slice(1)} Prompt`;
}

interface PromptEditorProps {
  promptType: keyof PromptSettings;
  value: string;
  expanded: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}

const PromptEditor: React.FC<PromptEditorProps> = ({
  promptType,
  value,
  expanded,
  onToggle,
  onChange,
}) => (
  <div className="border border-vault-200 dark:border-vault-700 rounded-lg overflow-hidden mb-3 last:mb-0">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 bg-vault-50 dark:bg-vault-800/50 hover:bg-vault-100 dark:hover:bg-vault-800 transition-colors"
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-vault-700 dark:text-vault-300 capitalize">
        <MessageSquare className="w-4 h-4 text-vault-500" />
        {promptLabel(promptType)}
      </span>
      {expanded ? (
        <ChevronUp className="w-4 h-4 text-vault-500" />
      ) : (
        <ChevronDown className="w-4 h-4 text-vault-500" />
      )}
    </button>
    {expanded && (
      <div className="p-4">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-32 px-3 py-2 border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 text-sm focus:outline-none focus:ring-2 focus:ring-vault-500/50 resize-none transition-all duration-200"
          placeholder={`Enter ${promptType} prompt...`}
        />
        <div className="mt-2 text-xs space-y-1">
          {promptType === 'instruct' ? (
            <span className="text-vault-600 dark:text-vault-400">
              <span className="font-semibold text-red-500">Required:</span> Must contain ${'{text}'}{' '}
              and ${'{instruction}'}
            </span>
          ) : (
            <span className="text-vault-600 dark:text-vault-400">
              <span className="font-semibold text-red-500">Required:</span> Must contain ${'{text}'}
            </span>
          )}
        </div>
        {!value.includes('${text}') && (
          <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Missing required ${'{text}'} placeholder!
          </p>
        )}
        {promptType === 'instruct' && !value.includes('${instruction}') && (
          <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Missing required ${'{instruction}'} placeholder!
          </p>
        )}
      </div>
    )}
  </div>
);

export const PromptsTab: React.FC<SettingsTabProps> = ({ draft, setDraft }) => {
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});

  const setPrompt = (key: keyof PromptSettings, value: string) => {
    setDraft((prev) => ({
      ...prev,
      prompts: { ...prev.prompts, [key]: value },
    }));
  };

  const toggle = (key: string) => {
    setExpandedPrompts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4">
      <SettingsCard>
        <h3 className="text-xs font-bold text-vault-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Primary Operations
        </h3>
        {PRIMARY_PROMPTS.map((promptType) => (
          <PromptEditor
            key={promptType}
            promptType={promptType}
            value={draft.prompts[promptType]}
            expanded={!!expandedPrompts[promptType]}
            onToggle={() => toggle(promptType)}
            onChange={(v) => setPrompt(promptType, v)}
          />
        ))}
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-xs font-bold text-vault-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Polish Operations (More Menu)
        </h3>
        {POLISH_PROMPTS.map((promptType) => (
          <PromptEditor
            key={promptType}
            promptType={promptType}
            value={draft.prompts[promptType]}
            expanded={!!expandedPrompts[promptType]}
            onToggle={() => toggle(promptType)}
            onChange={(v) => setPrompt(promptType, v)}
          />
        ))}
      </SettingsCard>
    </div>
  );
};
