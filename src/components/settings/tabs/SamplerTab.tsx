/**
 * @fileoverview Sampler settings tab (temperature, top-p, presets, etc.).
 * @module components/settings/tabs/SamplerTab
 */

import React from 'react';
import {
  BookOpen,
  Filter,
  Hash,
  Layers,
  Percent,
  Repeat,
  Sliders,
  Target,
  Thermometer,
  Wand2,
} from 'lucide-react';
import type { SamplerSettings } from '../../../db/characterTypes';
import { DEFAULT_SETTINGS } from '../../../db/characterTypes';
import { SettingsCard } from '../components/SettingsCard';
import { SliderControl } from '../components/SliderControl';
import type { SettingsTabProps } from '../types';

function applyNamedPreset(
  settings: SamplerSettings,
  presetName: 'creative' | 'balanced' | 'factual'
): SamplerSettings {
  const preset = DEFAULT_SETTINGS.samplerPresets.find((p) =>
    p.id.endsWith(presetName) || p.name.toLowerCase() === presetName
  );
  if (!preset) return settings;
  return { ...settings, ...preset.settings };
}

export const SamplerTab: React.FC<SettingsTabProps> = ({ draft, setDraft }) => {
  const settings = draft.sampler;

  const onChange = (next: SamplerSettings) => {
    setDraft((prev) => ({ ...prev, sampler: next }));
  };

  const handlePreset = (preset: 'creative' | 'balanced' | 'factual') => {
    onChange(applyNamedPreset(settings, preset));
  };

  const updateSetting = <K extends keyof SamplerSettings>(key: K, value: SamplerSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-6">
      <SettingsCard variant="gradient">
        <div className="flex items-center gap-2 mb-3">
          <Wand2 className="w-4 h-4 text-vault-600 dark:text-vault-400" />
          <span className="text-sm font-semibold text-vault-700 dark:text-vault-300">
            Quick Presets
          </span>
        </div>
        <div className="flex gap-2">
          {(['creative', 'balanced', 'factual'] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => handlePreset(preset)}
              className="flex-1 px-3 py-2 text-sm font-medium bg-white dark:bg-vault-700 hover:bg-vault-50 dark:hover:bg-vault-600 text-vault-700 dark:text-vault-300 rounded-lg transition-all duration-200 border border-vault-200 dark:border-vault-600 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-vault-500/50"
            >
              <span className="capitalize">{preset}</span>
            </button>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard>
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="w-4 h-4 text-vault-600 dark:text-vault-400" />
          <span className="text-sm font-semibold text-vault-700 dark:text-vault-300">
            Primary Samplers
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <SliderControl
            id="temperature"
            label="Temperature"
            icon={<Thermometer className="w-4 h-4" />}
            value={settings.temperature}
            min={0}
            max={2}
            step={0.1}
            onChange={(v) => updateSetting('temperature', v)}
            formatValue={(v) => v.toFixed(1)}
          />
          <SliderControl
            id="topP"
            label="Top P"
            icon={<Percent className="w-4 h-4" />}
            value={settings.topP}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateSetting('topP', v)}
            formatValue={(v) => v.toFixed(2)}
          />
          <SliderControl
            id="minP"
            label="Min P"
            icon={<Filter className="w-4 h-4" />}
            value={settings.minP}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => updateSetting('minP', v)}
            formatValue={(v) => v.toFixed(2)}
          />
          <SliderControl
            id="topK"
            label="Top K"
            icon={<Layers className="w-4 h-4" />}
            value={settings.topK}
            min={0}
            max={100}
            step={1}
            onChange={(v) => updateSetting('topK', v)}
            formatValue={(v) => Math.round(v).toString()}
          />
        </div>
      </SettingsCard>

      <SettingsCard>
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-vault-600 dark:text-vault-400" />
          <span className="text-sm font-semibold text-vault-700 dark:text-vault-300">
            Secondary Samplers
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <SliderControl
            id="repetitionPenalty"
            label="Repetition Penalty"
            icon={<Repeat className="w-4 h-4" />}
            value={settings.repetitionPenalty}
            min={1}
            max={2}
            step={0.05}
            onChange={(v) => updateSetting('repetitionPenalty', v)}
            formatValue={(v) => v.toFixed(2)}
          />
          <SliderControl
            id="maxTokens"
            label="Max Tokens"
            icon={<Hash className="w-4 h-4" />}
            value={settings.maxTokens}
            min={100}
            max={8100}
            step={100}
            onChange={(v) => updateSetting('maxTokens', Math.round(v))}
            formatValue={(v) => Math.round(v).toString()}
          />
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-vault-700 dark:text-vault-300 mb-2">
              <span className="p-1.5 rounded-md bg-vault-100 dark:bg-vault-800 text-vault-600 dark:text-vault-400">
                <BookOpen className="w-4 h-4" />
              </span>
              Context Length
            </label>
            <select
              value={settings.contextLength}
              onChange={(e) => updateSetting('contextLength', parseInt(e.target.value, 10))}
              className="w-full px-3 py-2.5 border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-vault-500/50 transition-all duration-200"
            >
              <option value={2048}>2K tokens</option>
              <option value={4096}>4K tokens</option>
              <option value={8192}>8K tokens</option>
              <option value={16384}>16K tokens</option>
              <option value={32768}>32K tokens</option>
              <option value={65536}>64K tokens</option>
              <option value={128000}>128K tokens</option>
            </select>
            <p className="mt-2 text-xs text-vault-500">Maximum context window for AI requests</p>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};
