/**
 * @fileoverview Custom AI operation prompts tab.
 * @module components/settings/tabs/PromptsTab
 */

import React, { useState } from 'react';
import { AlertCircle, Bot, ChevronDown, ChevronUp, MessageSquare, Sparkles, Target } from 'lucide-react';
import type { PromptModelBinding, PromptSettings } from '../../../db/characterTypes';
import { SettingsCard } from '../components/SettingsCard';
import { PromptModelBindingSelect } from '../components/PromptModelBindingSelect';
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
  binding: PromptModelBinding | undefined;
  expanded: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  onBindingChange: (binding: PromptModelBinding | undefined) => void;
  helpers: SettingsTabProps['helpers'];
  globalAi: SettingsTabProps['draft']['ai'];
}

const PromptEditor: React.FC<PromptEditorProps> = ({
  promptType,
  value,
  binding,
  expanded,
  onToggle,
  onChange,
  onBindingChange,
  helpers,
  globalAi,
}) => {
  const endpoint = binding?.baseUrl ?? '';
  const isFetching =
    !!helpers && endpoint
      ? helpers.isFetchingModelsForUrl(endpoint)
      : false;

  return (
    <div className="border border-border rounded-lg mb-3 last:mb-0 overflow-visible">
      <button
        type="button"
        onClick={onToggle}
        className="w-full min-h-12 flex items-center justify-between gap-2 px-3 sm:px-4 py-3 bg-muted hover:bg-hover active:bg-hover transition-colors rounded-t-lg text-left"
      >
        <span className="flex items-start sm:items-center gap-2 text-sm font-semibold text-fg-muted min-w-0">
          <MessageSquare className="w-4 h-4 text-fg-muted shrink-0 mt-0.5 sm:mt-0" />
          <span className="min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="capitalize truncate">{promptLabel(promptType)}</span>
            {binding?.modelId && (
              <span className="normal-case font-normal text-xs text-fg-muted truncate max-w-full sm:max-w-[14rem]">
                → {binding.modelId}
              </span>
            )}
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-fg-muted shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-fg-muted shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="p-3 sm:p-4">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full min-h-28 h-32 px-3 py-2.5 border border-border-strong rounded-lg bg-surface text-fg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y transition-all duration-200"
            placeholder={`Enter ${promptType} prompt...`}
          />
          <div className="mt-2 text-xs space-y-1">
            {promptType === 'instruct' ? (
              <span className="text-fg-muted">
                <span className="font-semibold text-danger">Required:</span> Must contain ${'{text}'}{' '}
                and ${'{instruction}'}
              </span>
            ) : (
              <span className="text-fg-muted">
                <span className="font-semibold text-danger">Required:</span> Must contain ${'{text}'}
              </span>
            )}
          </div>
          {!value.includes('${text}') && (
            <p className="mt-2 text-xs text-danger flex items-start gap-1">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              Missing required ${'{text}'} placeholder!
            </p>
          )}
          {promptType === 'instruct' && !value.includes('${instruction}') && (
            <p className="mt-2 text-xs text-danger flex items-start gap-1">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              Missing required ${'{instruction}'} placeholder!
            </p>
          )}

          {helpers && (
            <PromptModelBindingSelect
              binding={binding}
              globalAi={globalAi}
              modelsByBaseUrl={helpers.modelsByBaseUrl}
              onChange={onBindingChange}
              onFetch={helpers.fetchModelsForUrl}
              isFetching={isFetching}
            />
          )}
        </div>
      )}
    </div>
  );
};

export const PromptsTab: React.FC<SettingsTabProps> = ({ draft, setDraft, helpers }) => {
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});

  const setPrompt = (key: keyof PromptSettings, value: string) => {
    setDraft((prev) => ({
      ...prev,
      prompts: { ...prev.prompts, [key]: value },
    }));
  };

  const setBinding = (key: keyof PromptSettings, binding: PromptModelBinding | undefined) => {
    setDraft((prev) => {
      const next = { ...prev.promptModels };
      if (!binding) {
        delete next[key];
      } else {
        next[key] = binding;
      }
      return { ...prev, promptModels: next };
    });
  };

  const toggle = (key: string) => {
    setExpandedPrompts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4">
      <SettingsCard>
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <Bot className="w-4 h-4" />
          Agent
        </h3>
        <p className="text-xs text-fg-muted mb-3">
          Uses the default AI Config model unless you pick another endpoint and model. Keys stay on
          the AI Config tab.
        </p>
        {helpers && (
          <PromptModelBindingSelect
            heading="Model for Agent"
            bare
            binding={draft.agentModel}
            globalAi={draft.ai}
            modelsByBaseUrl={helpers.modelsByBaseUrl}
            onChange={(binding) =>
              setDraft((prev) => ({ ...prev, agentModel: binding }))
            }
            onFetch={helpers.fetchModelsForUrl}
            isFetching={
              draft.agentModel?.baseUrl
                ? helpers.isFetchingModelsForUrl(draft.agentModel.baseUrl)
                : false
            }
          />
        )}
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Primary Operations
        </h3>
        <p className="text-xs text-fg-muted mb-3">
          Optionally route each prompt to a different endpoint and model. Keys are configured on the
          AI Config tab.
        </p>
        {PRIMARY_PROMPTS.map((promptType) => (
          <PromptEditor
            key={promptType}
            promptType={promptType}
            value={draft.prompts[promptType]}
            binding={draft.promptModels[promptType]}
            expanded={!!expandedPrompts[promptType]}
            onToggle={() => toggle(promptType)}
            onChange={(v) => setPrompt(promptType, v)}
            onBindingChange={(b) => setBinding(promptType, b)}
            helpers={helpers}
            globalAi={draft.ai}
          />
        ))}
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Polish Operations (More Menu)
        </h3>
        {POLISH_PROMPTS.map((promptType) => (
          <PromptEditor
            key={promptType}
            promptType={promptType}
            value={draft.prompts[promptType]}
            binding={draft.promptModels[promptType]}
            expanded={!!expandedPrompts[promptType]}
            onToggle={() => toggle(promptType)}
            onChange={(v) => setPrompt(promptType, v)}
            onBindingChange={(b) => setBinding(promptType, b)}
            helpers={helpers}
            globalAi={draft.ai}
          />
        ))}
      </SettingsCard>
    </div>
  );
};
