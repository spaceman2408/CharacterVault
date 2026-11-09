/**
 * @fileoverview Preset OpenAI-compatible API base URLs for AI settings.
 * @module components/settings/config/aiBaseUrlPresets
 */

export {
  normalizeBaseUrl,
  getStoredApiKey,
  getStoredModelId,
  defaultPresetLabel,
} from '../../../utils/aiBaseUrl';

import type { CustomBaseUrlPreset } from '../../../db/characterTypes';
import { defaultPresetLabel, normalizeBaseUrl } from '../../../utils/aiBaseUrl';

export const SAVED_PRESET_PREFIX = 'saved:';

export interface AIBaseUrlPreset {
  id: string;
  label: string;
  baseUrl: string;
  helper: string;
  keyUrl?: string;
  referralUrl?: string;
  referralPerk?: string;
}

export const AI_BASE_URL_PRESETS: AIBaseUrlPreset[] = [
  {
    id: 'nano-gpt',
    label: 'Nano-GPT',
    baseUrl: 'https://nano-gpt.com/api/v1',
    helper: 'Hosted OpenAI-compatible endpoint.',
    keyUrl: 'https://nano-gpt.com/api',
    referralUrl: 'https://nano-gpt.com/r/6YU364c4',
    referralPerk: 'You get 5% off usage.',
  },
  {
    id: 'synthetic',
    label: 'Synthetic',
    baseUrl: 'https://api.synthetic.new/v1',
    helper:
      'OpenAI-compatible endpoint. Prefer syn: aliases so you always get the latest recommended model.',
    keyUrl: 'https://dev.synthetic.new/docs/api/getting-started',
    referralUrl: 'https://synthetic.new/?referral=eZOSi642hhtJQM7',
    referralPerk: 'You get $10 in subscription credit when you subscribe (does not stack with other offers).',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    helper:
      'OpenAI-compatible gateway. Use org/model slugs such as openai/gpt-4o.',
    keyUrl: 'https://openrouter.ai/workspaces/default/keys',
  },
  {
    id: 'minimax',
    label: 'Minimax',
    baseUrl: 'https://api.minimax.io/v1',
    helper: 'OpenAI-compatible endpoint. API keys start with sk-cp.',
    keyUrl: 'https://platform.minimax.io/console/plan',
  },
  {
    id: 'moonshot',
    label: 'Moonshot (Kimi)',
    baseUrl: 'https://api.moonshot.ai/v1',
    helper: 'Kimi models direct from Moonshot. Use a key from the Moonshot platform.',
    keyUrl: 'https://platform.moonshot.ai/console/api-keys',
  },
  {
    id: 'zai',
    label: 'Z.ai (GLM)',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    helper: 'GLM models, pay as you go. On a GLM Coding Plan? Pick Z.ai Coding Plan instead.',
    keyUrl: 'https://z.ai/manage-apikey/apikey-list',
  },
  {
    id: 'zai-coding',
    label: 'Z.ai Coding Plan',
    baseUrl: 'https://api.z.ai/api/coding/paas/v4',
    helper: 'GLM models on your Coding Plan quota. Uses a normal Z.ai API key.',
    keyUrl: 'https://z.ai/manage-apikey/apikey-list',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    helper: 'DeepSeek models direct from DeepSeek.',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio / localhost',
    baseUrl: 'http://127.0.0.1:1234/v1',
    helper: 'Default local endpoint for LM Studio.',
  },
];

/** Model list cache staleness window. */
export const MODEL_CACHE_STALENESS_MS = 10 * 60 * 1000;

export function builtinPresetForUrl(url: string): AIBaseUrlPreset | undefined {
  const normalized = normalizeBaseUrl(url);
  if (!normalized) return undefined;
  return AI_BASE_URL_PRESETS.find((preset) => normalizeBaseUrl(preset.baseUrl) === normalized);
}

/** True for a built-in preset URL, or a saved one when `saved` is given. */
export function isPresetUrl(url: string, saved?: CustomBaseUrlPreset[]): boolean {
  const normalized = normalizeBaseUrl(url);
  return (
    !!builtinPresetForUrl(normalized) ||
    (!!normalized && !!saved?.some((preset) => normalizeBaseUrl(preset.baseUrl) === normalized))
  );
}

/** The saved preset for this URL and model: one pinned to that model first, then one pinning none. */
export function findSavedPreset(
  saved: CustomBaseUrlPreset[] | undefined,
  url: string,
  modelId?: string
): CustomBaseUrlPreset | undefined {
  const normalized = normalizeBaseUrl(url);
  if (!normalized || !saved) return undefined;
  const forUrl = saved.filter((preset) => normalizeBaseUrl(preset.baseUrl) === normalized);
  return (
    forUrl.find((preset) => !!preset.modelId && preset.modelId === modelId) ??
    forUrl.find((preset) => !preset.modelId)
  );
}

export function suggestPresetLabel(url: string, modelId?: string): string {
  const base = builtinPresetForUrl(url)?.label ?? defaultPresetLabel(url);
  const model = modelId?.trim();
  return model ? `${base} · ${model.split('/').pop()}` : base;
}

function isSamePreset(preset: CustomBaseUrlPreset, url: string, modelId: string): boolean {
  return normalizeBaseUrl(preset.baseUrl) === url && (preset.modelId ?? '') === modelId;
}

/** Unchanged for an empty URL, a built-in URL with no model, or a URL and model already saved. */
export function addSavedPreset(
  saved: CustomBaseUrlPreset[] | undefined,
  label: string,
  url: string,
  modelId?: string
): CustomBaseUrlPreset[] {
  const list = saved ?? [];
  const baseUrl = normalizeBaseUrl(url);
  const model = modelId?.trim() ?? '';
  if (!baseUrl || (!model && builtinPresetForUrl(baseUrl))) return list;
  if (list.some((preset) => isSamePreset(preset, baseUrl, model))) return list;
  return [
    ...list,
    {
      label: label.trim() || suggestPresetLabel(baseUrl, model),
      baseUrl,
      ...(model ? { modelId: model } : {}),
    },
  ];
}

export function removeSavedPreset(
  saved: CustomBaseUrlPreset[] | undefined,
  target: CustomBaseUrlPreset
): CustomBaseUrlPreset[] {
  const url = normalizeBaseUrl(target.baseUrl);
  const model = target.modelId ?? '';
  return (saved ?? []).filter((preset) => !isSamePreset(preset, url, model));
}
