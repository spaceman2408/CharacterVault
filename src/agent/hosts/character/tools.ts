import type { CharacterSpec } from '../../../db/characterTypes';
import type { ActionResult, ParsedAction } from '../../core/types';
import { formatFieldCatalog, formatFieldRead, formatGreetingCatalog, formatGreetingRead } from './catalog';
import {
  fieldLabel,
  getFieldValue,
  isCharacterAgentFieldId,
  parseGreetingIndex,
  setFieldValue,
  validFieldIdsList,
} from './fields';

export const CHARACTER_TOOL_NAMES = [
  'list_fields',
  'read_field',
  'update_field',
  'list_greetings',
  'read_greeting',
  'add_greeting',
  'update_greeting',
  'delete_greeting',
] as const;
export type CharacterToolName = (typeof CHARACTER_TOOL_NAMES)[number];

export const MAX_FIELD_UPDATES_PER_RUN = 30;
export const MAX_GREETING_MUTATIONS_PER_RUN = 20;

function ok(toolName: string, message: string): ActionResult {
  return { ok: true, toolName, message };
}

function fail(toolName: string, message: string): ActionResult {
  return { ok: false, toolName, message };
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
      `ok ${rawId} (${fieldLabel(rawId)}) — ${value.length} chars`,
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
    return fail(
      'read_greeting',
      `error: no greeting ${action.headers.index ?? '(missing)'} (${greetings.length} greetings)`,
    );
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
    result: ok('add_greeting', `ok greeting ${index}/${greetings.length}`),
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
      result: fail(
        'update_greeting',
        `error: no greeting ${action.headers.index ?? '(missing)'} (${greetings.length} greetings)`,
      ),
    };
  }
  greetings[index] = action.body;
  return {
    spec: { ...spec, alternate_greetings: greetings },
    changed: true,
    result: ok('update_greeting', `ok greeting ${index}/${greetings.length}`),
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
      result: fail(
        'delete_greeting',
        `error: no greeting ${action.headers.index ?? '(missing)'} (${greetings.length} greetings)`,
      ),
    };
  }
  greetings.splice(index, 1);
  return {
    spec: { ...spec, alternate_greetings: greetings },
    changed: true,
    result: ok(
      'delete_greeting',
      `ok deleted greeting ${index}; ${greetings.length} remaining`,
    ),
  };
}
