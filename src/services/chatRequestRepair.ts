/**
 * Pure helpers for repairing OpenAI-compatible chat completion requests after 400 errors.
 * Handles unsupported params (strip) and unsupported reasoning_effort values (remap).
 */

export type ReasoningEffortValue =
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max';

/** Non-OpenAI / gateway-specific fields we may strip on rejection. */
export const NON_STANDARD_PARAMS = [
  'min_p',
  'top_k',
  'repetition_penalty',
  'include_reasoning',
  'reasoning',
  'reasoning_effort',
  'reasoning_split',
] as const;

export type NonStandardParam = (typeof NON_STANDARD_PARAMS)[number];

/** Strip candidates checked longest-first so `reasoning` does not match `reasoning_effort`. */
const STRIPPABLE_PARAMS = [
  ...[...NON_STANDARD_PARAMS].sort((a, b) => b.length - a.length),
  'logit_bias',
  'temperature',
  'top_p',
] as const;

/** Effort rank high → low. max and xhigh are adjacent peers. */
const EFFORT_RANK: ReasoningEffortValue[] = [
  'max',
  'xhigh',
  'high',
  'medium',
  'low',
  'minimal',
  'none',
];

const EFFORT_PEER: Partial<Record<ReasoningEffortValue, ReasoningEffortValue>> = {
  max: 'xhigh',
  xhigh: 'max',
};

/** Hosts known to reject non-standard sampler extras up front. */
const STRICT_OPENAI_HOST_SNIPPETS = [
  'api.openai.com',
  'api.synthetic.new',
  'synthetic.new',
] as const;

export interface ChatRequestLike {
  model?: string;
  temperature?: number;
  top_p?: number;
  min_p?: number;
  top_k?: number;
  repetition_penalty?: number;
  include_reasoning?: boolean;
  reasoning?: boolean | { enabled?: boolean; effort?: string; [key: string]: unknown };
  reasoning_effort?: string;
  reasoning_split?: boolean;
  logit_bias?: unknown;
  [key: string]: unknown;
}

export interface ModelCapabilityCache {
  rejectedParams: Set<string>;
  effortAllowlist?: string[];
}

export interface RepairResult {
  request: ChatRequestLike;
  removed: string[];
  remapped: Record<string, string>;
}

const capabilityCaches = new Map<string, ModelCapabilityCache>();

export function capabilityCacheKey(baseUrl: string, modelId: string): string {
  return `${baseUrl.replace(/\/$/, '')}::${modelId}`;
}

export function getCapabilityCache(baseUrl: string, modelId: string): ModelCapabilityCache {
  const key = capabilityCacheKey(baseUrl, modelId);
  let entry = capabilityCaches.get(key);
  if (!entry) {
    entry = { rejectedParams: new Set() };
    capabilityCaches.set(key, entry);
  }
  return entry;
}

/** Test helper: clear all in-memory capability caches. */
export function clearCapabilityCaches(): void {
  capabilityCaches.clear();
}

export function shouldOmitNonStandardSamplers(baseUrl: string): boolean {
  const lower = baseUrl.toLowerCase();
  return STRICT_OPENAI_HOST_SNIPPETS.some((snippet) => lower.includes(snippet));
}

export function parseSupportedValues(message: string): string[] | null {
  if (!message) return null;
  const match = message.match(
    /supported values? (?:are|is)\s*:?\s*([^.]+?)(?:\.|$)/i
  );
  if (!match?.[1]) return null;

  const raw = match[1]
    .split(/,|\bor\b/i)
    .map((s) => s.trim().replace(/^["'`]+|["'`]+$/g, '').toLowerCase())
    .filter(Boolean);

  return raw.length > 0 ? raw : null;
}

function effortIndex(value: string): number {
  const idx = EFFORT_RANK.indexOf(value as ReasoningEffortValue);
  return idx === -1 ? EFFORT_RANK.indexOf('medium') : idx;
}

/**
 * Map a requested effort to the nearest value in `supported`.
 * When reasoning is enabled, never picks `none`.
 */
export function mapEffortToSupported(
  requested: string,
  supported: string[],
  options: { allowNone?: boolean } = {}
): string | null {
  const allowNone = options.allowNone ?? false;
  const normalizedRequested = requested.toLowerCase();
  const allowed = supported
    .map((s) => s.toLowerCase())
    .filter((s) => allowNone || s !== 'none');

  if (allowed.length === 0) return null;
  if (allowed.includes(normalizedRequested)) return normalizedRequested;

  const peer = EFFORT_PEER[normalizedRequested as ReasoningEffortValue];
  if (peer && allowed.includes(peer)) return peer;

  const reqIdx = effortIndex(normalizedRequested);
  let best: string | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const candidate of allowed) {
    const dist = Math.abs(effortIndex(candidate) - reqIdx);
    // Prefer higher effort on ties (smaller index = higher effort)
    if (
      dist < bestDist ||
      (dist === bestDist &&
        best !== null &&
        effortIndex(candidate) < effortIndex(best))
    ) {
      best = candidate;
      bestDist = dist;
    }
  }

  return best;
}

function extractErrorMessage(errorData: Record<string, unknown>): string {
  const errorObj = errorData.error as Record<string, unknown> | undefined;
  return (
    (errorObj?.message as string | undefined) ||
    (errorData.message as string | undefined) ||
    (typeof errorData.error === 'string' ? errorData.error : '') ||
    ''
  );
}

function extractErrorParam(errorData: Record<string, unknown>): string | undefined {
  const errorObj = errorData.error as Record<string, unknown> | undefined;
  const param = errorObj?.param ?? errorData.param;
  return typeof param === 'string' ? param : undefined;
}

function extractErrorCode(errorData: Record<string, unknown>): string | undefined {
  const errorObj = errorData.error as Record<string, unknown> | undefined;
  const code = errorObj?.code ?? errorData.code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Params present on the request that the error indicates are rejected.
 * Uses error.param first, then longest-name message match.
 */
export function matchRejectedParams(
  errorData: Record<string, unknown>,
  presentKeys: string[]
): string[] {
  const present = new Set(presentKeys);
  const found: string[] = [];
  const add = (name: string) => {
    if (present.has(name) && !found.includes(name)) found.push(name);
  };

  const param = extractErrorParam(errorData);
  if (param && present.has(param)) {
    add(param);
  }

  const code = extractErrorCode(errorData);
  if (code === 'unsupported_reasoning_effort' && present.has('reasoning_effort')) {
    add('reasoning_effort');
  }

  const lowerMsg = extractErrorMessage(errorData).toLowerCase();
  if (lowerMsg) {
    for (const name of STRIPPABLE_PARAMS) {
      // Word-boundary style: param must appear as a whole token-ish match
      const re = new RegExp(`(?:^|[^a-z0-9_])${name}(?:[^a-z0-9_]|$)`, 'i');
      if (re.test(lowerMsg)) add(name);
    }
  }

  return found;
}

function cloneRequest(request: ChatRequestLike): ChatRequestLike {
  const cloned: ChatRequestLike = { ...request };
  if (request.reasoning && typeof request.reasoning === 'object') {
    cloned.reasoning = { ...request.reasoning };
  }
  return cloned;
}

function setEffortOnRequest(request: ChatRequestLike, effort: string): void {
  if (request.reasoning_effort !== undefined) {
    request.reasoning_effort = effort;
  }
  if (request.reasoning && typeof request.reasoning === 'object') {
    request.reasoning = { ...request.reasoning, effort };
  }
}

function getRequestedEffort(request: ChatRequestLike): string | undefined {
  if (typeof request.reasoning_effort === 'string') return request.reasoning_effort;
  if (request.reasoning && typeof request.reasoning === 'object' && typeof request.reasoning.effort === 'string') {
    return request.reasoning.effort;
  }
  return undefined;
}

/**
 * Attempt to repair a request from a 400 error body.
 * Prefer remapping effort values; only strip when remapping is impossible.
 */
export function repairChatRequest(
  request: ChatRequestLike,
  errorData: Record<string, unknown>
): RepairResult | null {
  const presentKeys = Object.keys(request).filter((k) => request[k] !== undefined);
  const matched = matchRejectedParams(errorData, presentKeys);
  const message = extractErrorMessage(errorData);
  const code = extractErrorCode(errorData);
  const supported = parseSupportedValues(message);

  const cleaned = cloneRequest(request);
  const removed: string[] = [];
  const remapped: Record<string, string> = {};

  const effortParamNamed =
    matched.includes('reasoning_effort') ||
    code === 'unsupported_reasoning_effort' ||
    /reasoning_effort/i.test(message);

  if (effortParamNamed && supported && supported.length > 0) {
    const requested = getRequestedEffort(request) ?? 'medium';
    const mapped = mapEffortToSupported(requested, supported, { allowNone: false });
    if (mapped && mapped !== requested.toLowerCase()) {
      setEffortOnRequest(cleaned, mapped);
      remapped.reasoning_effort = mapped;
    } else if (mapped && mapped === requested.toLowerCase()) {
      // Value already allowed — nothing to do for effort; may still strip other params
    } else if (!mapped) {
      // Cannot map — strip effort-related fields that are present
      for (const key of ['reasoning_effort', 'reasoning', 'include_reasoning'] as const) {
        if (cleaned[key] !== undefined && (matched.includes(key) || key === 'reasoning_effort')) {
          delete cleaned[key];
          if (!removed.includes(key)) removed.push(key);
        }
      }
    }
  }

  // Strip other matched params (not remapped effort)
  for (const param of matched) {
    if (param === 'reasoning_effort' && remapped.reasoning_effort) continue;
    if (param === 'reasoning_effort' && cleaned.reasoning_effort !== undefined && remapped.reasoning_effort) {
      continue;
    }
    // If we successfully remapped effort, do not strip reasoning_effort / nested reasoning
    if (
      remapped.reasoning_effort &&
      (param === 'reasoning_effort' || param === 'reasoning')
    ) {
      continue;
    }
    if (cleaned[param] !== undefined) {
      delete cleaned[param];
      if (!removed.includes(param)) removed.push(param);
    }
  }

  if (removed.length === 0 && Object.keys(remapped).length === 0) {
    return null;
  }

  return { request: cleaned, removed, remapped };
}

export function stripAllNonStandardParams(request: ChatRequestLike): RepairResult {
  const cleaned = cloneRequest(request);
  const removed: string[] = [];

  for (const param of NON_STANDARD_PARAMS) {
    if (cleaned[param] !== undefined) {
      delete cleaned[param];
      removed.push(param);
    }
  }
  if (cleaned.logit_bias !== undefined) {
    delete cleaned.logit_bias;
    removed.push('logit_bias');
  }

  return { request: cleaned, removed, remapped: {} };
}

/** Apply cached rejections / effort allowlist before first send. */
export function applyCapabilityCache(
  request: ChatRequestLike,
  cache: ModelCapabilityCache
): ChatRequestLike {
  const cleaned = cloneRequest(request);

  for (const param of cache.rejectedParams) {
    if (cleaned[param] !== undefined) {
      delete cleaned[param];
    }
  }

  if (cache.effortAllowlist && cache.effortAllowlist.length > 0) {
    const requested = getRequestedEffort(cleaned);
    if (requested) {
      const mapped = mapEffortToSupported(requested, cache.effortAllowlist, {
        allowNone: false,
      });
      if (mapped) {
        setEffortOnRequest(cleaned, mapped);
      }
    }
  }

  return cleaned;
}

export function recordRepairInCache(cache: ModelCapabilityCache, repair: RepairResult): void {
  for (const param of repair.removed) {
    cache.rejectedParams.add(param);
  }
  if (repair.remapped.reasoning_effort) {
    // Learn allowlist from successful remap target only if we also parse later;
    // ensure at least the remapped value is considered valid.
    const existing = cache.effortAllowlist ?? [];
    if (!existing.includes(repair.remapped.reasoning_effort)) {
      cache.effortAllowlist = [...existing, repair.remapped.reasoning_effort];
    }
  }
}

export function recordSupportedEfforts(cache: ModelCapabilityCache, supported: string[]): void {
  cache.effortAllowlist = supported.map((s) => s.toLowerCase());
}

/** Omit no-op sampler values and non-standard samplers on strict hosts. */
export function sanitizeSamplerParams(
  request: ChatRequestLike,
  baseUrl: string
): ChatRequestLike {
  const cleaned = cloneRequest(request);

  if (shouldOmitNonStandardSamplers(baseUrl)) {
    delete cleaned.min_p;
    delete cleaned.top_k;
    delete cleaned.repetition_penalty;
  } else {
    if (typeof cleaned.min_p === 'number' && cleaned.min_p <= 0) delete cleaned.min_p;
    if (typeof cleaned.top_k === 'number' && cleaned.top_k <= 0) delete cleaned.top_k;
    if (typeof cleaned.repetition_penalty === 'number' && cleaned.repetition_penalty === 1) {
      delete cleaned.repetition_penalty;
    }
  }

  return cleaned;
}
