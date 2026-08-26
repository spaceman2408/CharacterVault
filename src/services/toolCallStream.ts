import { ChunkString } from '../utils/chunkString';

export interface NativeToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolCallDelta {
  index?: number;
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

/** In-stream accumulator; `arguments` stays chunked until finalize. */
export interface AccumulatingToolCall {
  id: string;
  name: string;
  arguments: ChunkString;
}

export function applyToolCallDeltas(acc: AccumulatingToolCall[], deltas: ToolCallDelta[]): void {
  for (const delta of deltas) {
    const index = delta.index ?? Math.max(0, acc.length - 1);
    while (acc.length <= index) {
      acc.push({ id: '', name: '', arguments: new ChunkString() });
    }
    const current = acc[index];
    if (delta.id) current.id = delta.id;
    if (delta.function?.name) current.name += delta.function.name;
    if (delta.function?.arguments) current.arguments.append(delta.function.arguments);
  }
}

export function finalizeToolCalls(acc: AccumulatingToolCall[]): NativeToolCall[] {
  return acc
    .map((call, index) => ({
      id: call.id || `call_${index}`,
      name: call.name,
      arguments: call.arguments.toString(),
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
    acc.push({
      id: typeof record.id === 'string' && record.id ? record.id : `call_${acc.length}`,
      name,
      arguments: args,
    });
  }
  return acc;
}
