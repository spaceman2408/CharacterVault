import type { ParsedAction, ParseResult, ParseSegment } from './types';

const FENCE_OPEN = '<<<';
const FENCE_CLOSE = '>>>';
const TOOL_CALL_OPEN = '<tool_call';
const TOOL_CALL_CLOSE = '</tool_call>';

function isNameStart(char: string): boolean {
  return (char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z');
}

function isNamePart(char: string): boolean {
  return isNameStart(char) || (char >= '0' && char <= '9') || char === '_';
}

function skipSpaces(text: string, index: number): number {
  let i = index;
  while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i += 1;
  return i;
}

function asciiLowerChar(char: string): string {
  const code = char.charCodeAt(0);
  if (code >= 65 && code <= 90) return String.fromCharCode(code + 32);
  return char;
}

function indexOfIgnoreCase(haystack: string, needle: string, from: number): number {
  const needleLen = needle.length;
  const limit = haystack.length - needleLen;
  outer: for (let i = from; i <= limit; i += 1) {
    for (let j = 0; j < needleLen; j += 1) {
      if (asciiLowerChar(haystack[i + j]) !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function isValidToolName(name: string): boolean {
  if (!name || !isNameStart(name[0])) return false;
  for (let i = 1; i < name.length; i += 1) {
    if (!isNamePart(name[i])) return false;
  }
  return true;
}

function isPlaceholderName(name: string): boolean {
  return name.toLowerCase() === 'tool_name';
}

function isUsableToolName(name: string): boolean {
  return isValidToolName(name) && !isPlaceholderName(name);
}

function lineToolToken(line: string): string {
  return line.trim().replace(/\(\s*\)\s*$/, '');
}

function findToolCallOpen(text: string, from: number): number {
  let start = from;
  while (start < text.length) {
    const at = indexOfIgnoreCase(text, TOOL_CALL_OPEN, start);
    if (at === -1) return -1;
    const next = text[at + TOOL_CALL_OPEN.length];
    if (next === '>' || next === '/' || next === ' ' || next === '\t' || next === '\n' || next === '\r') {
      return at;
    }
    start = at + 1;
  }
  return -1;
}

function nextOpen(
  text: string,
  from: number,
): { kind: 'fence' | 'tool_call'; at: number } | null {
  const fenceAt = text.indexOf(FENCE_OPEN, from);
  const toolAt = findToolCallOpen(text, from);
  if (fenceAt === -1 && toolAt === -1) return null;
  if (fenceAt === -1) return { kind: 'tool_call', at: toolAt };
  if (toolAt === -1) return { kind: 'fence', at: fenceAt };
  return fenceAt <= toolAt ? { kind: 'fence', at: fenceAt } : { kind: 'tool_call', at: toolAt };
}

function readQuotedValue(text: string, start: number): { value: string; end: number } | null {
  const quote = text[start];
  if (quote !== '"' && quote !== "'") return null;
  let i = start + 1;
  while (i < text.length && text[i] !== quote) i += 1;
  if (i >= text.length) return null;
  return { value: text.slice(start + 1, i), end: i + 1 };
}

function parseHeadersAndBody(lines: string[]): { headers: Record<string, string>; body: string } {
  const headers: Record<string, string> = {};
  const bodyLines: string[] = [];
  let inBody = false;
  for (const rawLine of lines) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (!inBody) {
      if (line === '---') {
        inBody = true;
        continue;
      }
      const colon = line.indexOf(':');
      if (colon > 0) {
        const key = line.slice(0, colon).trim();
        const value = line.slice(colon + 1).trim();
        if (key.length > 0 && !key.includes(' ')) {
          headers[key] = value;
          continue;
        }
      }
      if (line.trim() === '') continue;
      inBody = true;
      bodyLines.push(line);
      continue;
    }
    bodyLines.push(line);
  }
  return { headers, body: bodyLines.join('\n').replace(/\n+$/, '') };
}

function actionFromJson(raw: string): ParsedAction | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const nameValue = record.name ?? record.tool ?? record.function;
    if (typeof nameValue !== 'string' || !isValidToolName(nameValue)) return null;
    const headers: Record<string, string> = {};
    let body = '';
    const args = record.arguments ?? record.parameters ?? record.input;
    if (args && typeof args === 'object' && !Array.isArray(args)) {
      for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
        if (key === 'content' || key === 'body') {
          body = String(value ?? '');
        } else if (Array.isArray(value)) {
          headers[key] = value.map((item) => String(item)).join(', ');
        } else if (value != null && typeof value !== 'object') {
          headers[key] = String(value);
        }
      }
    }
    if (!body && typeof record.content === 'string') body = record.content;
    return { name: nameValue, headers, body };
  } catch {
    return null;
  }
}

function actionFromInner(nameHint: string | null, inner: string): ParsedAction | null {
  const trimmed = inner.trim();
  if (!trimmed) {
    return nameHint ? { name: nameHint, headers: {}, body: '' } : null;
  }
  if (trimmed.startsWith('{')) {
    const fromJson = actionFromJson(trimmed);
    if (fromJson) {
      return nameHint ? { ...fromJson, name: nameHint } : fromJson;
    }
  }

  const lines = inner.replace(/\r\n/g, '\n').split('\n');
  let name = nameHint && isUsableToolName(nameHint) ? nameHint : null;
  let start = 0;
  while (start < lines.length && lines[start].trim() === '') start += 1;
  while (start < lines.length && isPlaceholderName(lineToolToken(lines[start]))) {
    start += 1;
    while (start < lines.length && lines[start].trim() === '') start += 1;
  }
  if (!name) {
    if (start >= lines.length) return null;
    const first = lineToolToken(lines[start]);
    if (!isUsableToolName(first)) return null;
    name = first;
    start += 1;
  } else if (start < lines.length) {
    const first = lineToolToken(lines[start]);
    if (first === name || isPlaceholderName(first)) start += 1;
  }
  const { headers, body } = parseHeadersAndBody(lines.slice(start));
  return { name, headers, body };
}

function readLine(text: string, start: number): { line: string; next: number } {
  const newline = text.indexOf('\n', start);
  const end = newline === -1 ? text.length : newline;
  let line = text.slice(start, end);
  if (line.endsWith('\r')) line = line.slice(0, -1);
  return { line, next: newline === -1 ? text.length : newline + 1 };
}

function parseOneFence(
  text: string,
  openAt: number,
): { kind: 'action'; action: ParsedAction; end: number } | { kind: 'incomplete' } {
  let i = skipSpaces(text, openAt + FENCE_OPEN.length);
  if (i >= text.length || !isNameStart(text[i])) return { kind: 'incomplete' };

  const nameStart = i;
  i += 1;
  while (i < text.length && isNamePart(text[i])) i += 1;
  const name = text.slice(nameStart, i);
  i = skipSpaces(text, i);

  if (text.startsWith(FENCE_CLOSE, i)) {
    return {
      kind: 'action',
      action: { name, headers: {}, body: '' },
      end: i + FENCE_CLOSE.length,
    };
  }

  if (i < text.length && text[i] === '\r') i += 1;
  if (i < text.length && text[i] === '\n') {
    i += 1;
  } else if (i >= text.length) {
    return { kind: 'incomplete' };
  } else {
    return { kind: 'incomplete' };
  }

  const headers: Record<string, string> = {};
  const bodyLines: string[] = [];
  let inBody = false;

  while (i < text.length) {
    const { line, next } = readLine(text, i);

    if (!inBody) {
      if (line === FENCE_CLOSE) {
        return { kind: 'action', action: { name, headers, body: '' }, end: next };
      }
      if (line === '---') {
        inBody = true;
        i = next;
        continue;
      }
      const colon = line.indexOf(':');
      if (colon > 0) {
        const key = line.slice(0, colon).trim();
        const value = line.slice(colon + 1).trim();
        if (key.length > 0 && !key.includes(' ')) {
          headers[key] = value;
          i = next;
          continue;
        }
      }
      inBody = true;
      bodyLines.push(line);
      i = next;
      continue;
    }

    if (line === FENCE_CLOSE) {
      return {
        kind: 'action',
        action: { name, headers, body: bodyLines.join('\n') },
        end: next,
      };
    }
    bodyLines.push(line);
    i = next;
  }

  return { kind: 'incomplete' };
}

function parseOneToolCall(
  text: string,
  openAt: number,
): { kind: 'action'; action: ParsedAction; end: number } | { kind: 'speech'; end: number } | { kind: 'incomplete' } {
  let i = openAt + TOOL_CALL_OPEN.length;
  let nameAttr: string | null = null;
  let selfClosing = false;
  let tagClosed = false;

  while (i < text.length) {
    const char = text[i];
    if (char === '>') {
      i += 1;
      tagClosed = true;
      break;
    }
    if (char === '/' && text[i + 1] === '>') {
      selfClosing = true;
      tagClosed = true;
      i += 2;
      break;
    }
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      i += 1;
      continue;
    }
    const eq = text.indexOf('=', i);
    const gt = text.indexOf('>', i);
    if (eq === -1 || (gt !== -1 && eq > gt)) {
      i += 1;
      continue;
    }
    const key = text.slice(i, eq).trim().toLowerCase();
    const quoted = readQuotedValue(text, skipSpaces(text, eq + 1));
    if (!quoted) {
      i = eq + 1;
      continue;
    }
    if (key === 'name' && isUsableToolName(quoted.value)) nameAttr = quoted.value;
    i = quoted.end;
  }

  if (!tagClosed) return { kind: 'incomplete' };

  if (selfClosing) {
    if (!nameAttr) return { kind: 'speech', end: i };
    return { kind: 'action', action: { name: nameAttr, headers: {}, body: '' }, end: i };
  }

  const closeAt = indexOfIgnoreCase(text, TOOL_CALL_CLOSE, i);
  if (closeAt === -1) return { kind: 'incomplete' };
  const inner = text.slice(i, closeAt);
  const end = closeAt + TOOL_CALL_CLOSE.length;
  const action = actionFromInner(nameAttr, inner);
  if (!action) return { kind: 'speech', end };
  return { kind: 'action', action, end };
}

export function parseActions(text: string): ParseResult {
  const segments: ParseSegment[] = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    const open = nextOpen(text, i);
    if (!open) {
      if (i < n) segments.push({ kind: 'speech', text: text.slice(i) });
      break;
    }
    if (open.at > i) {
      segments.push({ kind: 'speech', text: text.slice(i, open.at) });
    }

    const parsed = open.kind === 'fence'
      ? parseOneFence(text, open.at)
      : parseOneToolCall(text, open.at);
    if (parsed.kind === 'incomplete') {
      segments.push({ kind: 'incomplete', raw: text.slice(open.at) });
      break;
    }
    if (parsed.kind === 'speech') {
      segments.push({ kind: 'speech', text: text.slice(open.at, parsed.end) });
      i = parsed.end;
      continue;
    }
    segments.push({ kind: 'action', action: parsed.action });
    i = parsed.end;
  }

  return {
    segments,
    actions: segments.filter((s) => s.kind === 'action').map((s) => s.action),
    speech: segments.filter((s) => s.kind === 'speech').map((s) => s.text).join(''),
    incomplete: segments.some((s) => s.kind === 'incomplete'),
  };
}
