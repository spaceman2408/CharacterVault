import type { ActionResult, AgentToolSpec, ParsedAction } from '../../core/types';
import { parseBoolText } from '../boolText';
import { buildNameModel, inventName, type NameModel } from './inventNames';
import { isFantasyCompound, OVERUSED_PLACES } from './overusedPlaces';
import { inventTavern, OVERUSED_TAVERNS, TAVERN_SETTINGS, type TavernSetting } from './taverns';
import { DEFAULT_NAME_COUNT, MAX_NAME_COUNT, NAME_ORIGINS, parseCount, pick, resolveOrigins } from './suggestNames';

export const PLACE_KINDS = ['settlement', 'region', 'river', 'mountain', 'lake', 'tavern'] as const;
export const PLACE_SIZES = ['village', 'town', 'city'] as const;

type PlaceKind = (typeof PLACE_KINDS)[number];
type PlaceSize = (typeof PLACE_SIZES)[number];

// No feature lists ship (size budget): these are always invented from the settlement chain, as bare names.
const NATURAL_KINDS = new Set<PlaceKind>(['river', 'mountain', 'lake']);
const NATURAL_MAX_LENGTH = 9;
// Shorter invented names are mostly real words (Mura, Yama, Ishi).
const INVENTED_MIN_LETTERS = 5;
// Endings that mark a name as a settlement, which reads wrong on a river or a peak.
const SETTLEMENT_ENDING =
  /(ton|ham|by|ford|field|bury|borough|wick|ville|dorf|burg|heim|hausen|stadt|ingen|leben|pur|abad|grad|polis|cho|machi|mura)$/;

export interface PlaceData {
  origins: Record<string, { settlements: Record<PlaceSize, string[]>; regions: string[] }>;
}

let placesPromise: Promise<PlaceData> | null = null;
let realPlaces: Set<string> | null = null;
const modelCache = new Map<string, PlaceModel | null>();

interface PlaceModel {
  chain: NameModel;
  /** Words written lowercase inside real names (sur, la, am, upon), kept lowercase in invented ones. */
  particles: ReadonlySet<string>;
  /** Single words of real multi-word names (Bridge, Common, Château), rejected as whole invented names. */
  fragments: ReadonlySet<string>;
}

export function loadPlaceData(): Promise<PlaceData> {
  placesPromise ??= import('./geonamesPlaces.json').then((module) => module.default as PlaceData);
  return placesPromise;
}

export const SUGGEST_PLACES_TOOL_SPEC: AgentToolSpec = {
  name: 'suggest_places',
  description:
    'Random real place names from the chosen origins, or invented ones that sound like them, minus overused AI place names (Oakhaven, Shadowvale) and places already named in the open card or book. Use for any new town, village, city, region, river, mountain, or lake the user did not name; pick one that fits instead of making one up yourself. river, mountain, and lake are always invented and come back as bare names: add the word yourself (the Kemble, Mount Ardle, Lake Orrin). tavern gives English inn and tavern names (The Drowned Ox, The Mason\'s Arms) and needs no origin.',
  parameters: {
    type: 'object',
    properties: {
      kind: { type: 'string', description: `${PLACE_KINDS.join(', ')} (default settlement)` },
      origin: {
        type: 'string',
        description: `Required except for tavern. One or more origins, comma-separated: ${NAME_ORIGINS.join(', ')}`,
      },
      setting: {
        type: 'string',
        description: `Tavern only: ${TAVERN_SETTINGS.join(' or ')} (default grounded). fantasy mixes in creatures and magic trades.`,
      },
      size: {
        type: 'string',
        description: `Settlements only: ${PLACE_SIZES.join(', ')}, or any (default any)`,
      },
      count: {
        type: 'integer',
        description: `How many names (default ${DEFAULT_NAME_COUNT}, max ${MAX_NAME_COUNT})`,
      },
      invented: {
        type: 'boolean',
        description: 'true for made-up places that sound like the chosen origins. Use it for any fantasy or made-up world: real places are real-world towns (Oslo, Bilbao) and read wrong there. Blend at most two origins that sound alike (norwegian, swedish); more turns to mush. Default false: real places.',
      },
    },
    required: [],
  },
};

function fail(message: string): ActionResult {
  return { ok: false, toolName: 'suggest_places', message: `error: ${message}` };
}

function allRealPlaces(data: PlaceData): ReadonlySet<string> {
  if (!realPlaces) {
    realPlaces = new Set();
    for (const origin of Object.values(data.origins)) {
      for (const name of [...Object.values(origin.settlements).flat(), ...origin.regions]) {
        realPlaces.add(name.toLowerCase());
      }
    }
  }
  return realPlaces;
}

function realPool(data: PlaceData, origins: string[], kind: PlaceKind, sizes: readonly PlaceSize[]): string[] {
  return origins.flatMap((origin) => {
    const entry = data.origins[origin];
    return kind === 'region' ? entry.regions : sizes.flatMap((size) => entry.settlements[size]);
  });
}

// Trained on every size: a single band is too small for the order-3 chain, and size barely changes how a name sounds.
function placeModel(data: PlaceData, origins: string[]): PlaceModel | null {
  const key = [...origins].sort().join(',');
  if (!modelCache.has(key)) {
    const lists = origins.map((origin) => PLACE_SIZES.flatMap((size) => data.origins[origin].settlements[size]));
    const chain = buildNameModel(lists);
    const words = lists.flat().map((name) => name.split(/[\s-]+/)).filter((parts) => parts.length > 1);
    const particles = new Set(words.flatMap((parts) => parts.slice(1)).filter((word) => /^\p{Ll}+$/u.test(word)));
    const fragments = new Set(words.flat().map((word) => word.toLowerCase()));
    modelCache.set(key, chain ? { chain, particles, fragments } : null);
  }
  return modelCache.get(key) ?? null;
}

function inventPlace(model: PlaceModel, real: ReadonlySet<string>, natural: boolean): string | undefined {
  const name = inventName(model.chain, real);
  if (!name || model.fragments.has(name.toLowerCase())) return undefined;
  if (name.replace(/[^\p{L}]/gu, '').length < INVENTED_MIN_LETTERS) return undefined;
  if (natural) {
    const lower = name.toLowerCase();
    return /^[\p{L}\p{M}]+$/u.test(name) && name.length <= NATURAL_MAX_LENGTH && !SETTLEMENT_ENDING.test(lower)
      ? name
      : undefined;
  }
  let first = true;
  return name.replace(/[\p{L}\p{M}']+/gu, (word) => {
    const lower = word.toLowerCase();
    const keep = first || !model.particles.has(lower);
    first = false;
    return keep ? word : lower;
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function usedIn(text: string, name: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{M}])${escapeRegExp(name)}(?![\\p{L}\\p{M}])`, 'iu').test(text);
}

function label(kind: PlaceKind, size: PlaceSize | 'any', plural: boolean): string {
  const noun = kind !== 'settlement' ? kind : size === 'any' ? 'settlement' : size;
  if (!plural) return noun;
  return noun === 'city' ? 'cities' : `${noun}s`;
}

function suggestTaverns(action: ParsedAction, usedTexts: readonly string[]): ActionResult {
  const settingRaw = (action.headers.setting ?? '').trim().toLowerCase() || 'grounded';
  if (!(TAVERN_SETTINGS as readonly string[]).includes(settingRaw)) {
    return fail(`setting must be ${TAVERN_SETTINGS.join(' or ')}`);
  }
  const setting = settingRaw as TavernSetting;
  const count = parseCount(action.headers.count);
  const usedText = usedTexts.join('\n');
  const names: string[] = [];
  const seen = new Set<string>();
  for (let attempt = 0; attempt < count * 60 && names.length < count; attempt += 1) {
    const name = inventTavern(setting);
    if (seen.has(name)) continue;
    seen.add(name);
    if (OVERUSED_TAVERNS.has(name.toLowerCase())) continue;
    if (usedIn(usedText, name.replace(/^The /, ''))) continue;
    names.push(name);
  }
  const header = `suggest_places: ${names.length} ${setting} tavern${names.length === 1 ? '' : 's'}`;
  return { ok: true, toolName: 'suggest_places', message: `${header}\n${names.join('\n')}` };
}

/** usedTexts: the card and/or book text. A place already named there is skipped. */
export async function suggestPlaces(action: ParsedAction, usedTexts: readonly string[]): Promise<ActionResult> {
  const kindInput = (action.headers.kind ?? '').trim().toLowerCase() || 'settlement';
  const kindRaw = kindInput === 'inn' ? 'tavern' : kindInput;
  if (!(PLACE_KINDS as readonly string[]).includes(kindRaw)) {
    return fail(`kind must be one of ${PLACE_KINDS.join(', ')}`);
  }
  const kind = kindRaw as PlaceKind;
  if (kind === 'tavern') return suggestTaverns(action, usedTexts);

  const resolved = resolveOrigins(action.headers.origin);
  if ('error' in resolved) return fail(resolved.error);
  const { origins, unknown } = resolved;

  const sizeRaw = kind === 'settlement' ? (action.headers.size ?? '').trim().toLowerCase() || 'any' : 'any';
  if (sizeRaw !== 'any' && !(PLACE_SIZES as readonly string[]).includes(sizeRaw)) {
    return fail(`size must be ${PLACE_SIZES.join(', ')}, or any`);
  }
  const size = sizeRaw as PlaceSize | 'any';
  const sizes: readonly PlaceSize[] = size === 'any' ? PLACE_SIZES : [size];
  const natural = NATURAL_KINDS.has(kind);
  const invented = natural || parseBoolText(action.headers.invented) === true;
  const count = parseCount(action.headers.count);

  const data = await loadPlaceData();
  const usedText = usedTexts.join('\n');
  const real = allRealPlaces(data);
  const pool = invented ? [] : realPool(data, origins, kind, sizes);
  const model = invented ? placeModel(data, origins) : null;

  const names: string[] = [];
  const seen = new Set<string>();
  for (let attempt = 0; attempt < count * 60 && names.length < count; attempt += 1) {
    const name = model ? inventPlace(model, real, natural) : pick(pool);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    if (OVERUSED_PLACES.has(name.toLowerCase())) continue;
    if (invented && isFantasyCompound(name)) continue;
    if (usedIn(usedText, name)) continue;
    names.push(name);
  }
  if (names.length === 0) return fail('no unused places left for that origin; try another origin or size');

  // The model reads results closely; this stops it putting Oslo in a fantasy world when it forgot invented.
  const realNote = invented ? '' : ' — real-world places; for a fantasy or made-up world, call again with invented true';
  const header = `suggest_places: ${names.length} ${invented ? 'invented ' : ''}${label(kind, size, names.length !== 1)}, ${origins.join(', ')}${realNote}`;
  const skipped = unknown.length > 0 ? `\nUnknown origin skipped: ${unknown.join(', ')}` : '';
  return { ok: true, toolName: 'suggest_places', message: `${header}${skipped}\n${names.join('\n')}` };
}
