/**
 * Pure helpers for AI base URL normalization and per-URL credential lookup.
 */

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
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
