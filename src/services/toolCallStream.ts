import { ChunkString } from '../utils/chunkString';

export interface NativeToolCall {
  id: string;
  name: string;
  arguments: string;
  /** Echoed back as-is; Gemini puts the thought signature it requires on the next request here. */
  extraContent?: Record<string, unknown>;
}

export interface ToolCallDelta {
  index?: number;
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
  extra_content?: unknown;
}

/** In-stream accumulator; `arguments` stays chunked until finalize. */
export interface AccumulatingToolCall {
  id: string;
  name: string;
  arguments: ChunkString;
  extraContent?: Record<string, unknown>;
}

function asExtraContent(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

// Without an index, a new id or a second tool name means the next call has started.
function indexWithoutIndex(acc: AccumulatingToolCall[], delta: ToolCallDelta): number {
  const last = acc.at(-1);
  if (!last) return 0;
  const newId = !!delta.id && !!last.id && delta.id !== last.id;
  const newName = !delta.id && !!delta.function?.name && last.name.length > 0;
  return newId || newName ? acc.length : acc.length - 1;
}

export function applyToolCallDeltas(acc: AccumulatingToolCall[], deltas: ToolCallDelta[]): void {
  for (const delta of deltas) {
    const index = delta.index ?? indexWithoutIndex(acc, delta);
    while (acc.length <= index) {
      acc.push({ id: '', name: '', arguments: new ChunkString() });
    }
    const current = acc[index];
    if (delta.id) current.id = delta.id;
    if (delta.function?.name) current.name += delta.function.name;
    if (delta.function?.arguments) current.arguments.append(delta.function.arguments);
    const extra = asExtraContent(delta.extra_content);
    if (extra) current.extraContent = { ...current.extraContent, ...extra };
  }
}

export function finalizeToolCalls(acc: AccumulatingToolCall[]): NativeToolCall[] {
  return acc
    .map((call, index) => ({
      id: call.id || `call_${index}`,
      name: call.name,
      arguments: call.arguments.toString(),
      ...(call.extraContent ? { extraContent: call.extraContent } : {}),
    }))
    .filter((call) => call.name.length > 0);
}

export function normalizeMessageToolCalls(raw: unknown): NativeToolCall[] {
  if (!Array.isArray(raw)) return [];
  const acc: NativeToolCall[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as {
      id?: unknown;
      name?: unknown;
      function?: { name?: unknown; arguments?: unknown };
      extra_content?: unknown;
    };
    const name =
      (typeof record.function?.name === 'string' && record.function.name) ||
      (typeof record.name === 'string' && record.name) ||
      '';
    if (!name) continue;
    let args = '';
    const rawArgs = record.function?.arguments;
    if (typeof rawArgs === 'string') args = rawArgs;
    else if (rawArgs && typeof rawArgs === 'object') args = JSON.stringify(rawArgs);
    const extraContent = asExtraContent(record.extra_content);
    acc.push({
      id: typeof record.id === 'string' && record.id ? record.id : `call_${acc.length}`,
      name,
      arguments: args,
      ...(extraContent ? { extraContent } : {}),
    });
  }
  return acc;
}
