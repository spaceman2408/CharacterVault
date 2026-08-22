import type { CharacterBook, CharacterSpec } from '../../../db/characterTypes';
import type { ActionResult, ParsedAction } from '../../core/types';
import { parseReplaceAll, replaceText, replacementText, searchText } from '../replaceText';
import {
  applyBookReplacements,
  collectBookTargets,
  formatReplaceAcross,
  replaceAcrossTargets,
  searchTargets,
  type TextTarget,
} from '../search';
import { formatCardAudit } from './audit';
import {
  formatFieldCatalog,
  formatFieldRead,
  formatGreetingCatalog,
  formatGreetingRead,
  tokenCountLabel,
} from './catalog';
import {
  CHARACTER_AGENT_FIELD_IDS,
  fieldLabel,
  getFieldValue,
  greetingNumber,
  isCharacterAgentFieldId,
  parseCommaList,
  parseGreetingIndex,
  setFieldValue,
  validFieldIdsList,
} from './fields';

export const CHARACTER_TOOL_NAMES = [
  'list_fields',
  'read_field',
  'update_field',
  'replace_in_field',
  'append_to_field',
  'list_greetings',
  'read_greeting',
  'add_greeting',
  'update_greeting',
  'replace_in_greeting',
  'delete_greeting',
  'move_greeting',
  'search',
  'replace_across',
  'audit_card',
] as const;

export const CHARACTER_OVERRIDES_LOREBOOK_TOOLS = new Set(['search', 'replace_across', 'audit_book']);
export type CharacterToolName = (typeof CHARACTER_TOOL_NAMES)[number];

export const MAX_FIELD_UPDATES_PER_RUN = 30;
export const MAX_GREETING_MUTATIONS_PER_RUN = 20;

function ok(toolName: string, message: string): ActionResult {
  return { ok: true, toolName, message };
}

function fail(toolName: string, message: string): ActionResult {
  return { ok: false, toolName, message };
}

function noGreetingMessage(raw: string | undefined, length: number): string {
  const shown = raw ?? '(missing)';
  if (shown.trim() === '0') {
    return `error: no greeting 0 (${length} greetings; indexes start at 1)`;
  }
  return `error: no greeting ${shown} (${length} greetings)`;
}

export function listFields(spec: CharacterSpec): ActionResult {
  return ok('list_fields', formatFieldCatalog(spec));
}

export function readField(spec: CharacterSpec, action: ParsedAction): ActionResult {
  const rawId = (action.headers.id ?? '').trim();
  if (!isCharacterAgentFieldId(rawId)) {
    return fail(
      'read_field',
      `error: unknown field "${rawId || '(missing)'}". Valid: ${validFieldIdsList()}`,
    );
  }
  return ok('read_field', formatFieldRead(spec, rawId));
}

export function updateField(
  spec: CharacterSpec,
  action: ParsedAction,
): { spec: CharacterSpec; result: ActionResult; changed: boolean } {
  const rawId = (action.headers.id ?? '').trim();
  if (!isCharacterAgentFieldId(rawId)) {
    return {
      spec,
      changed: false,
      result: fail(
        'update_field',
        `error: unknown field "${rawId || '(missing)'}". Valid: ${validFieldIdsList()}`,
      ),
    };
  }
  const next = setFieldValue(spec, rawId, action.body);
  const value = getFieldValue(next, rawId);
  return {
    spec: next,
    changed: true,
    result: ok(
      'update_field',
      `ok ${rawId} (${fieldLabel(rawId)}) — ${tokenCountLabel(value)}`,
    ),
  };
}

export function replaceInField(
  spec: CharacterSpec,
  action: ParsedAction,
): { spec: CharacterSpec; result: ActionResult; changed: boolean } {
  const rawId = (action.headers.id ?? '').trim();
  if (!isCharacterAgentFieldId(rawId)) {
    return {
      spec,
      changed: false,
      result: fail(
        'replace_in_field',
        `error: unknown field "${rawId || '(missing)'}". Valid: ${validFieldIdsList()}`,
      ),
    };
  }
  const current = getFieldValue(spec, rawId);
  const applied = replaceText(
    current,
    searchText(action),
    replacementText(action),
    parseReplaceAll(action.headers.replace_all),
  );
  if (!applied.ok) {
    return { spec, changed: false, result: fail('replace_in_field', applied.message) };
  }
  const next = setFieldValue(spec, rawId, applied.text);
  const value = getFieldValue(next, rawId);
  return {
    spec: next,
    changed: applied.text !== current,
    result: ok(
      'replace_in_field',
      `ok ${rawId} (${fieldLabel(rawId)}) — replaced ${applied.count} (${tokenCountLabel(value)})`,
    ),
  };
}

export function listGreetings(spec: CharacterSpec): ActionResult {
  return ok('list_greetings', formatGreetingCatalog(spec));
}

export function readGreeting(spec: CharacterSpec, action: ParsedAction): ActionResult {
  const greetings = spec.alternate_greetings ?? [];
  const index = parseGreetingIndex(action.headers.index, greetings.length);
  if (index == null) {
    return fail('read_greeting', noGreetingMessage(action.headers.index, greetings.length));
  }
  return ok('read_greeting', formatGreetingRead(greetings, index));
}

export function addGreeting(
  spec: CharacterSpec,
  action: ParsedAction,
): { spec: CharacterSpec; result: ActionResult; changed: boolean } {
  const greetings = [...(spec.alternate_greetings ?? [])];
  greetings.push(action.body);
  const next: CharacterSpec = { ...spec, alternate_greetings: greetings };
  const index = greetings.length - 1;
  return {
    spec: next,
    changed: true,
    result: ok('add_greeting', `ok greeting ${greetingNumber(index)}/${greetings.length}`),
  };
}

export function updateGreeting(
  spec: CharacterSpec,
  action: ParsedAction,
): { spec: CharacterSpec; result: ActionResult; changed: boolean } {
  const greetings = [...(spec.alternate_greetings ?? [])];
  const index = parseGreetingIndex(action.headers.index, greetings.length);
  if (index == null) {
    return {
      spec,
      changed: false,
      result: fail('update_greeting', noGreetingMessage(action.headers.index, greetings.length)),
    };
  }
  greetings[index] = action.body;
  return {
    spec: { ...spec, alternate_greetings: greetings },
    changed: true,
    result: ok('update_greeting', `ok greeting ${greetingNumber(index)}/${greetings.length}`),
  };
}

export function replaceInGreeting(
  spec: CharacterSpec,
  action: ParsedAction,
): { spec: CharacterSpec; result: ActionResult; changed: boolean } {
  const greetings = [...(spec.alternate_greetings ?? [])];
  const index = parseGreetingIndex(action.headers.index, greetings.length);
  if (index == null) {
    return {
      spec,
      changed: false,
      result: fail(
        'replace_in_greeting',
        noGreetingMessage(action.headers.index, greetings.length),
      ),
    };
  }
  const current = greetings[index] ?? '';
  const applied = replaceText(
    current,
    searchText(action),
    replacementText(action),
    parseReplaceAll(action.headers.replace_all),
  );
  if (!applied.ok) {
    return { spec, changed: false, result: fail('replace_in_greeting', applied.message) };
  }
  greetings[index] = applied.text;
  return {
    spec: { ...spec, alternate_greetings: greetings },
    changed: applied.text !== current,
    result: ok(
      'replace_in_greeting',
      `ok greeting ${greetingNumber(index)}/${greetings.length} — replaced ${applied.count}`,
    ),
  };
}

export function deleteGreeting(
  spec: CharacterSpec,
  action: ParsedAction,
): { spec: CharacterSpec; result: ActionResult; changed: boolean } {
  const greetings = [...(spec.alternate_greetings ?? [])];
  const index = parseGreetingIndex(action.headers.index, greetings.length);
  if (index == null) {
    return {
      spec,
      changed: false,
      result: fail('delete_greeting', noGreetingMessage(action.headers.index, greetings.length)),
    };
  }
  greetings.splice(index, 1);
  return {
    spec: { ...spec, alternate_greetings: greetings },
    changed: true,
    result: ok(
      'delete_greeting',
      `ok deleted greeting ${greetingNumber(index)}; ${greetings.length} remaining`,
    ),
  };
}

export function collectCharacterTargets(spec: CharacterSpec): TextTarget[] {
  const targets: TextTarget[] = CHARACTER_AGENT_FIELD_IDS.map((id) => ({
    id: `field:${id}`,
    loc: id,
    text: getFieldValue(spec, id),
  }));
  const greetings = spec.alternate_greetings ?? [];
  greetings.forEach((greeting, index) => {
    targets.push({
      id: `greeting:${index}`,
      loc: `greeting ${greetingNumber(index)}`,
      text: greeting ?? '',
    });
  });
  return targets;
}

export function appendToField(
  spec: CharacterSpec,
  action: ParsedAction,
): { spec: CharacterSpec; result: ActionResult; changed: boolean } {
  const rawId = (action.headers.id ?? '').trim();
  if (!isCharacterAgentFieldId(rawId)) {
    return {
      spec,
      changed: false,
      result: fail(
        'append_to_field',
        `error: unknown field "${rawId || '(missing)'}". Valid: ${validFieldIdsList()}`,
      ),
    };
  }
  const addition = action.body;
  if (!addition.trim()) {
    return {
      spec,
      changed: false,
      result: fail('append_to_field', 'error: content is empty'),
    };
  }
  if (rawId === 'tags') {
    const existing = spec.tags ?? [];
    const incoming = parseCommaList(addition);
    const seen = new Set(existing.map((tag) => tag.toLowerCase()));
    const merged = [...existing];
    for (const tag of incoming) {
      if (seen.has(tag.toLowerCase())) continue;
      seen.add(tag.toLowerCase());
      merged.push(tag);
    }
    const next: CharacterSpec = { ...spec, tags: merged };
    const value = getFieldValue(next, 'tags');
    return {
      spec: next,
      changed: merged.length !== existing.length,
      result: ok(
        'append_to_field',
        `ok tags (${fieldLabel('tags')}) — ${tokenCountLabel(value)}`,
      ),
    };
  }
  const current = getFieldValue(spec, rawId);
  const nextValue = !current
    ? addition
    : current.endsWith('\n')
      ? `${current}${addition}`
      : `${current}\n\n${addition}`;
  const next = setFieldValue(spec, rawId, nextValue);
  const value = getFieldValue(next, rawId);
  return {
    spec: next,
    changed: nextValue !== current,
    result: ok(
      'append_to_field',
      `ok ${rawId} (${fieldLabel(rawId)}) — ${tokenCountLabel(value)}`,
    ),
  };
}

export function moveGreeting(
  spec: CharacterSpec,
  action: ParsedAction,
): { spec: CharacterSpec; result: ActionResult; changed: boolean } {
  const greetings = [...(spec.alternate_greetings ?? [])];
  const from = parseGreetingIndex(action.headers.index, greetings.length);
  const to = parseGreetingIndex(action.headers.to, greetings.length);
  if (from == null) {
    return {
      spec,
      changed: false,
      result: fail('move_greeting', noGreetingMessage(action.headers.index, greetings.length)),
    };
  }
  if (to == null) {
    return {
      spec,
      changed: false,
      result: fail(
        'move_greeting',
        action.headers.to == null || action.headers.to.trim() === ''
          ? 'error: to must be a 1-based greeting index'
          : noGreetingMessage(action.headers.to, greetings.length),
      ),
    };
  }
  if (from === to) {
    return {
      spec,
      changed: false,
      result: ok(
        'move_greeting',
        `ok moved greeting ${greetingNumber(from)} → ${greetingNumber(to)} (${greetings.length} greetings)`,
      ),
    };
  }
  const [item] = greetings.splice(from, 1);
  greetings.splice(to, 0, item);
  return {
    spec: { ...spec, alternate_greetings: greetings },
    changed: true,
    result: ok(
      'move_greeting',
      `ok moved greeting ${greetingNumber(from)} → ${greetingNumber(to)} (${greetings.length} greetings)`,
    ),
  };
}

export function searchCard(
  spec: CharacterSpec,
  book: CharacterBook,
  action: ParsedAction,
): ActionResult {
  return searchTargets([...collectCharacterTargets(spec), ...collectBookTargets(book)], action);
}

export function replaceAcrossCard(
  spec: CharacterSpec,
  book: CharacterBook,
  action: ParsedAction,
): {
  spec: CharacterSpec;
  book: CharacterBook;
  result: ActionResult;
  specChanged: boolean;
  bookChanged: boolean;
} {
  const applied = replaceAcrossTargets(
    [...collectCharacterTargets(spec), ...collectBookTargets(book)],
    action,
  );
  if (!applied.ok) {
    return {
      spec,
      book,
      specChanged: false,
      bookChanged: false,
      result: { ok: false, toolName: 'replace_across', message: applied.message },
    };
  }

  let nextSpec = spec;
  let specChanged = false;
  const greetings = [...(spec.alternate_greetings ?? [])];
  let greetingsChanged = false;
  for (const item of applied.replacements) {
    if (item.id.startsWith('field:')) {
      const fieldId = item.id.slice('field:'.length);
      if (isCharacterAgentFieldId(fieldId)) {
        nextSpec = setFieldValue(nextSpec, fieldId, item.text);
        specChanged = true;
      }
    } else if (item.id.startsWith('greeting:')) {
      const index = Number(item.id.slice('greeting:'.length));
      if (Number.isInteger(index) && index >= 0 && index < greetings.length) {
        greetings[index] = item.text;
        greetingsChanged = true;
      }
    }
  }
  if (greetingsChanged) {
    nextSpec = { ...nextSpec, alternate_greetings: greetings };
    specChanged = true;
  }

  const bookHits = applied.replacements.filter(
    (item) => item.id.startsWith('entry:') || item.id.startsWith('book:'),
  );
  const nextBook = bookHits.length > 0 ? applyBookReplacements(book, bookHits) : book;

  return {
    spec: nextSpec,
    book: nextBook,
    specChanged,
    bookChanged: bookHits.length > 0,
    result: { ok: true, toolName: 'replace_across', message: formatReplaceAcross(applied) },
  };
}

export function auditCard(spec: CharacterSpec, book: CharacterBook): ActionResult {
  return { ok: true, toolName: 'audit_card', message: formatCardAudit(spec, book) };
}
