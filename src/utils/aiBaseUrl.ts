/**
 * Pure helpers for AI base URL normalization and per-URL credential lookup.
 */

import type { CustomBaseUrlPreset } from '../db/characterTypes';

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

export function defaultPresetLabel(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  try {
    return new URL(normalized).host || normalized;
  } catch {
    return normalized;
  }
}

/** Keeps well-formed `{ label, baseUrl, modelId? }` entries, unique by URL + model. */
export function normalizeCustomBaseUrlPresets(value: unknown): CustomBaseUrlPreset[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: CustomBaseUrlPreset[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { label, baseUrl, modelId } = entry as Record<string, unknown>;
    if (typeof baseUrl !== 'string') continue;
    const url = normalizeBaseUrl(baseUrl);
    const model = typeof modelId === 'string' ? modelId.trim() : '';
    const key = `${url}\n${model}`;
    if (!url || seen.has(key)) continue;
    seen.add(key);
    const name = typeof label === 'string' ? label.trim() : '';
    out.push({
      label: name || defaultPresetLabel(url),
      baseUrl: url,
      ...(model ? { modelId: model } : {}),
    });
  }
  return out;
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
