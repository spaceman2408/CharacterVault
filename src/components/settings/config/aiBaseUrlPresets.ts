/**
 * @fileoverview Preset OpenAI-compatible API base URLs for AI settings.
 * @module components/settings/config/aiBaseUrlPresets
 */

export interface AIBaseUrlPreset {
  id: string;
  label: string;
  baseUrl: string;
  helper: string;
  keyUrl?: string;
}

export const AI_BASE_URL_PRESETS: AIBaseUrlPreset[] = [
  {
    id: 'nano-gpt',
    label: 'Nano-GPT',
    baseUrl: 'https://nano-gpt.com/api/v1',
    helper: 'Hosted OpenAI-compatible endpoint.',
    keyUrl: 'https://nano-gpt.com/api',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    helper: 'Use the /api/v1 path for OpenRouter.',
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
    id: 'lmstudio',
    label: 'LM Studio / localhost',
    baseUrl: 'http://127.0.0.1:1234/v1',
    helper: 'Default local endpoint for LM Studio.',
  },
];

/** Model list cache staleness window. */
export const MODEL_CACHE_STALENESS_MS = 10 * 60 * 1000;

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

export function isPresetUrl(url: string): boolean {
  return AI_BASE_URL_PRESETS.some(
    (preset) => normalizeBaseUrl(preset.baseUrl) === normalizeBaseUrl(url)
  );
}

export function getStoredApiKey(
  apiKeysByBaseUrl: Record<string, string> | undefined,
  baseUrl: string
): string {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return '';
  return apiKeysByBaseUrl?.[normalized] ?? '';
}

export function getStoredModelId(
  modelIdsByBaseUrl: Record<string, string> | undefined,
  baseUrl: string
): string {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return '';
  return modelIdsByBaseUrl?.[normalized] ?? '';
}
