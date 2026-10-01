/**
 * @fileoverview Preset OpenAI-compatible API base URLs for AI settings.
 * @module components/settings/config/aiBaseUrlPresets
 */

export {
  normalizeBaseUrl,
  getStoredApiKey,
  getStoredModelId,
} from '../../../utils/aiBaseUrl';

import { normalizeBaseUrl } from '../../../utils/aiBaseUrl';

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
    id: 'lmstudio',
    label: 'LM Studio / localhost',
    baseUrl: 'http://127.0.0.1:1234/v1',
    helper: 'Default local endpoint for LM Studio.',
  },
];

/** Model list cache staleness window. */
export const MODEL_CACHE_STALENESS_MS = 10 * 60 * 1000;

export function isPresetUrl(url: string): boolean {
  return AI_BASE_URL_PRESETS.some(
    (preset) => normalizeBaseUrl(preset.baseUrl) === normalizeBaseUrl(url)
  );
}
