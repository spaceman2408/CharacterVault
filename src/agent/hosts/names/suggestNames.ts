import type { ActionResult, AgentToolSpec, ParsedAction } from '../../core/types';
import { parseCommaList } from '../commaList';
import { buildNameModel, inventName, type NameModel } from './inventNames';
import { OVERUSED_NAMES } from './overused';

export const NAME_ORIGINS = [
  'afrikaans',
  'american',
  'australian',
  'azerbaijani',
  'brazilian',
  'british',
  'croatian',
  'czech',
  'danish',
  'dutch',
  'finnish',
  'flemish',
  'french',
  'german',
  'ghanaian',
  'hungarian',
  'indian',
  'indonesian',
  'italian',
  'japanese',
  'kurdish',
  'latvian',
  'mexican',
  'moldovan',
  'nepali',
  'nigerian',
  'norwegian',
  'polish',
  'portuguese',
  'romanian',
  'senegalese',
  'serbian',
  'slovak',
  'slovene',
  'south-african',
  'spanish',
  'swedish',
  'swiss-french',
  'swiss-german',
  'turkish',
  'uzbek',
  'vietnamese',
  'yoruba',
  'zulu',
] as const;

export type NameOrigin = (typeof NAME_ORIGINS)[number];

export const DEFAULT_NAME_COUNT = 12;
export const MAX_NAME_COUNT = 30;

const ORIGIN_SET = new Set<string>(NAME_ORIGINS);
// Vietnamese puts the family name first, and English text keeps that order.
const SURNAME_FIRST = new Set<string>(['vietnamese']);

type Gender = 'female' | 'male';
type NamePart = 'first' | 'last' | 'full';
type NameKind = 'first' | 'last';

interface NameLists {
  female?: string[];
  male?: string[];
  any?: string[];
}

export interface NameData {
  origins: Record<string, { label: string; first: NameLists; last: NameLists }>;
}

let namesPromise: Promise<NameData> | null = null;
let realNames: Set<string> | null = null;
const modelCache = new Map<string, NameModel | null>();

export function loadNameData(): Promise<NameData> {
  namesPromise ??= Promise.all([import('./fakerNames.json'), import('./japaneseNames.json')]).then(
    ([faker, japanese]) => ({ origins: { ...faker.default.origins, ...japanese.default.origins } }) as NameData,
  );
  return namesPromise;
}

export const SUGGEST_NAMES_TOOL_SPEC: AgentToolSpec = {
  name: 'suggest_names',
  description:
    'Random real names from the chosen origins, or invented ones that sound like them, minus overused AI names and names already used in the open card or book. Use for any new character or NPC name the user did not give; pick one that fits instead of making one up yourself.',
  parameters: {
    type: 'object',
    properties: {
      origin: {
        type: 'string',
        description: `One or more origins, comma-separated: ${NAME_ORIGINS.join(', ')}`,
      },
      gender: { type: 'string', description: 'female, male, or any (default any)' },
      part: { type: 'string', description: 'first, last, or full (default full)' },
      count: {
        type: 'integer',
        description: `How many names (default ${DEFAULT_NAME_COUNT}, max ${MAX_NAME_COUNT})`,
      },
      invented: {
        type: 'boolean',
        description: 'true for made-up names that sound like the chosen origins, for an invented culture (several origins blend). Default false: real names.',
      },
    },
    required: ['origin'],
  },
};

export const SUGGEST_NAMES_TOOL_DOC = `- suggest_names — origin (one or more, comma-separated: ${NAME_ORIGINS.join(', ')}), optional gender (female, male, any), part (first, last, full; default full), count (default ${DEFAULT_NAME_COUNT}, max ${MAX_NAME_COUNT}), invented (true for made-up names that sound like the origins; several origins blend). Real or invented names minus overused AI names and names already in use.`;

function fail(message: string): ActionResult {
  return { ok: false, toolName: 'suggest_names', message: `error: ${message}` };
}

function normalizeOrigin(raw: string): string {
  return raw.toLowerCase().replace(/\(.*?\)/g, '').trim().replace(/[\s_]+/g, '-');
}

function nameTokens(text: string): string[] {
  return text.normalize('NFC').match(/\p{Lu}[\p{L}\p{M}]+/gu) ?? [];
}

function pick<T>(items: readonly T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

function listFor(lists: NameLists, gender: Gender): string[] {
  return lists[gender] ?? lists.any ?? [];
}

function composeName(
  part: NamePart,
  surnameFirst: boolean,
  pickPart: (kind: NameKind) => string | undefined,
): string | undefined {
  const first = part === 'last' ? undefined : pickPart('first');
  const last = part === 'first' ? undefined : pickPart('last');
  if (part === 'first') return first;
  if (part === 'last') return last;
  if (!first || !last) return undefined;
  return surnameFirst ? `${last} ${first}` : `${first} ${last}`;
}

function realName(data: NameData, origins: string[], gender: Gender, part: NamePart): string | undefined {
  const origin = pick(origins)!;
  const entry = data.origins[origin];
  return composeName(part, SURNAME_FIRST.has(origin), (kind) => pick(listFor(entry[kind], gender)));
}

function allRealNames(data: NameData): ReadonlySet<string> {
  if (!realNames) {
    realNames = new Set();
    for (const origin of Object.values(data.origins)) {
      for (const lists of [origin.first, origin.last]) {
        for (const list of Object.values(lists)) {
          for (const name of list ?? []) realNames.add(name.toLowerCase());
        }
      }
    }
  }
  return realNames;
}

function nameModel(data: NameData, origins: string[], kind: NameKind, gender: Gender): NameModel | null {
  const key = `${[...origins].sort().join(',')}|${kind}|${gender}`;
  if (!modelCache.has(key)) {
    modelCache.set(key, buildNameModel(origins.map((origin) => listFor(data.origins[origin][kind], gender))));
  }
  return modelCache.get(key) ?? null;
}

function inventedName(data: NameData, origins: string[], gender: Gender, part: NamePart): string | undefined {
  const real = allRealNames(data);
  const surnameFirst = origins.every((origin) => SURNAME_FIRST.has(origin));
  return composeName(part, surnameFirst, (kind) => {
    const model = nameModel(data, origins, kind, gender);
    return model ? inventName(model, real) : undefined;
  });
}

/** usedTexts: the card and/or book text. A name sharing a capitalized word with it is skipped. */
export async function suggestNames(action: ParsedAction, usedTexts: readonly string[]): Promise<ActionResult> {
  const requested = parseCommaList(action.headers.origin);
  if (requested.length === 0) return fail(`origin is required. Origins: ${NAME_ORIGINS.join(', ')}`);
  const origins: string[] = [];
  const unknown: string[] = [];
  for (const raw of requested) {
    const id = normalizeOrigin(raw);
    if (ORIGIN_SET.has(id)) {
      if (!origins.includes(id)) origins.push(id);
    } else {
      unknown.push(raw);
    }
  }
  if (origins.length === 0) {
    return fail(`unknown origin ${unknown.join(', ')}. Origins: ${NAME_ORIGINS.join(', ')}`);
  }

  const genderRaw = (action.headers.gender ?? '').trim().toLowerCase() || 'any';
  if (genderRaw !== 'female' && genderRaw !== 'male' && genderRaw !== 'any') {
    return fail('gender must be female, male, or any');
  }
  const partRaw = (action.headers.part ?? '').trim().toLowerCase() || 'full';
  if (partRaw !== 'first' && partRaw !== 'last' && partRaw !== 'full') {
    return fail('part must be first, last, or full');
  }
  const part: NamePart = partRaw;
  const invented = (action.headers.invented ?? '').trim().toLowerCase() === 'true';
  const parsedCount = Number.parseInt(action.headers.count ?? '', 10);
  const count = Number.isFinite(parsedCount)
    ? Math.min(Math.max(parsedCount, 1), MAX_NAME_COUNT)
    : DEFAULT_NAME_COUNT;

  const data = await loadNameData();
  const used = new Set(usedTexts.flatMap(nameTokens));
  const genders: Gender[] = genderRaw === 'any' ? ['female', 'male'] : [genderRaw];
  const names: string[] = [];
  const seen = new Set<string>();
  for (let attempt = 0; attempt < count * 25 && names.length < count; attempt += 1) {
    const gender = pick(genders)!;
    const name = invented ? inventedName(data, origins, gender, part) : realName(data, origins, gender, part);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const tokens = nameTokens(name);
    if (tokens.some((token) => OVERUSED_NAMES.has(token.toLowerCase()) || used.has(token))) continue;
    names.push(name);
  }
  if (names.length === 0) return fail('no unused names left for that origin; try another origin');

  const header = `suggest_names: ${names.length} ${invented ? 'invented ' : ''}${part} name${names.length === 1 ? '' : 's'}, ${genderRaw}, ${origins.join(', ')}`;
  const skipped = unknown.length > 0 ? `\nUnknown origin skipped: ${unknown.join(', ')}` : '';
  return { ok: true, toolName: 'suggest_names', message: `${header}${skipped}\n${names.join('\n')}` };
}
