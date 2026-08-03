/**
 * @fileoverview Sampler settings tab (temperature, top-p, presets, etc.).
 * @module components/settings/tabs/SamplerTab
 */

import React, { useState } from 'react';
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
import {
  CONTEXT_LENGTH_CUSTOM_MIN,
  CONTEXT_LENGTH_MAX,
  CONTEXT_LENGTH_PRESETS,
  DEFAULT_SETTINGS,
  clampContextLength,
} from '../../../db/characterTypes';
import { SettingsCard } from '../components/SettingsCard';
import { SliderControl } from '../components/SliderControl';
import type { SettingsTabProps } from '../types';

const PRESET_CONTEXT_VALUES = new Set<number>(CONTEXT_LENGTH_PRESETS.map((p) => p.value));

function applyNamedPreset(
  settings: SamplerSettings,
  presetName: 'creative' | 'balanced' | 'factual'
): SamplerSettings {
  const preset = DEFAULT_SETTINGS.samplerPresets.find((p) =>
    p.id.endsWith(presetName) || p.name.toLowerCase() === presetName
  );
  if (!preset) return settings;
  // Apply sampling knobs only — keep the user's context window.
  const { temperature, minP, topK, repetitionPenalty, topP, maxTokens } = preset.settings;
  return {
    ...settings,
    temperature,
    minP,
    topK,
    repetitionPenalty,
    topP,
    maxTokens,
  };
}

export const SamplerTab: React.FC<SettingsTabProps> = ({ draft, setDraft }) => {
  const settings = draft.sampler;
  // Sticky custom mode so choosing "Custom…" while on a preset value still shows the number input
  const [customMode, setCustomMode] = useState(
    () => !PRESET_CONTEXT_VALUES.has(settings.contextLength)
  );
  const isCustomContext =
    customMode || !PRESET_CONTEXT_VALUES.has(settings.contextLength);

  const onChange = (next: SamplerSettings) => {
    setDraft((prev) => ({ ...prev, sampler: next }));
  };

  const handlePreset = (preset: 'creative' | 'balanced' | 'factual') => {
    setCustomMode(false);
    onChange(applyNamedPreset(settings, preset));
  };

  const updateSetting = <K extends keyof SamplerSettings>(key: K, value: SamplerSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const handleContextSelect = (raw: string) => {
    if (raw === 'custom') {
      setCustomMode(true);
      // Keep current value if already ≥ custom min; otherwise lift 2K → 4K
      const next = Math.max(CONTEXT_LENGTH_CUSTOM_MIN, settings.contextLength);
      if (next !== settings.contextLength) {
        updateSetting('contextLength', clampContextLength(next));
      }
      return;
    }
    setCustomMode(false);
    updateSetting('contextLength', parseInt(raw, 10));
  };

  const handleCustomContextChange = (raw: string) => {
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;
    setCustomMode(true);
    updateSetting('contextLength', parsed);
  };

  const handleCustomContextBlur = () => {
    const clamped = clampContextLength(
      Math.max(CONTEXT_LENGTH_CUSTOM_MIN, settings.contextLength)
    );
    if (clamped !== settings.contextLength) {
      updateSetting('contextLength', clamped);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsCard>
        <div className="mb-3 flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-fg-muted" />
          <span className="text-sm font-semibold text-fg">
            Quick Presets
          </span>
        </div>
        <div className="flex gap-2">
          {(['creative', 'balanced', 'factual'] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => handlePreset(preset)}
              className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <span className="capitalize">{preset}</span>
            </button>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard>
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="w-4 h-4 text-fg-muted" />
          <span className="text-sm font-semibold text-fg-muted">
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
          <Target className="w-4 h-4 text-fg-muted" />
          <span className="text-sm font-semibold text-fg-muted">
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
            <label className="flex items-center gap-2 text-sm font-medium text-fg-muted mb-2">
              <span className="p-1.5 rounded-md bg-muted text-fg-muted">
                <BookOpen className="w-4 h-4" />
              </span>
              Context Length
            </label>
            <select
              value={isCustomContext ? 'custom' : settings.contextLength}
              onChange={(e) => handleContextSelect(e.target.value)}
              className="w-full px-3 py-2.5 border border-border-strong rounded-lg bg-surface text-fg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all duration-200"
            >
              {CONTEXT_LENGTH_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
            {isCustomContext && (
              <input
                type="number"
                min={CONTEXT_LENGTH_CUSTOM_MIN}
                max={CONTEXT_LENGTH_MAX}
                step={1}
                value={settings.contextLength}
                onChange={(e) => handleCustomContextChange(e.target.value)}
                onBlur={handleCustomContextBlur}
                className="mt-2 w-full px-3 py-2.5 border border-border-strong rounded-lg bg-surface text-fg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all duration-200"
                aria-label="Custom context length in tokens"
              />
            )}
            <p className="mt-2 text-xs text-fg-muted">
              Maximum context window for AI requests
              {isCustomContext
                ? ` (custom: ${CONTEXT_LENGTH_CUSTOM_MIN.toLocaleString()}–${CONTEXT_LENGTH_MAX.toLocaleString()} tokens)`
                : ' (presets up to 1M, or Custom…)'}
            </p>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};
