import type { NativeToolCall, ParsedAction } from './types';

function headerValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(', ');
  }
  return null;
}

export function repairJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // repair truncated objects / strings
  }

  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (const char of trimmed) {
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') stack.push('}');
    else if (char === '[') stack.push(']');
    else if (char === '}' || char === ']') stack.pop();
  }

  let repaired = trimmed;
  if (inString) repaired += '"';
  while (stack.length > 0) repaired += stack.pop();

  try {
    JSON.parse(repaired);
    return repaired;
  } catch {
    return null;
  }
}

export function parsedActionFromArguments(name: string, rawArgs: string): ParsedAction | null {
  const repaired = repairJson(rawArgs);
  if (!repaired) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(repaired);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return rawArgs.trim() ? null : { name, headers: {}, body: '' };
  }
  const record = parsed as Record<string, unknown>;
  const headers: Record<string, string> = {};
  let body = '';
  for (const [key, value] of Object.entries(record)) {
    if (key === 'content' || key === 'body') {
      body = value == null ? '' : String(value);
      continue;
    }
    const asHeader = headerValue(value);
    if (asHeader != null) headers[key] = asHeader;
  }
  return { name, headers, body };
}

export function parsedActionFromToolCall(call: NativeToolCall): ParsedAction | null {
  const name = call.name.trim();
  if (!name) return null;
  const raw = call.arguments ?? '';
  if (!raw.trim()) return { name, headers: {}, body: '' };
  return parsedActionFromArguments(name, raw);
}

export interface MappedToolCalls {
  actions: ParsedAction[];
  ids: string[];
  incomplete: NativeToolCall | null;
}

export function mapNativeToolCalls(calls: NativeToolCall[]): MappedToolCalls {
  const actions: ParsedAction[] = [];
  const ids: string[] = [];
  for (const call of calls) {
    const action = parsedActionFromToolCall(call);
    if (!action) {
      return { actions, ids, incomplete: call };
    }
    actions.push(action);
    ids.push(call.id);
  }
  return { actions, ids, incomplete: null };
}
