import type { CharacterAsset, CharacterCardV3Extras } from '../db/characterTypes';

type Source = object | null | undefined;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isStringRecord = (value: unknown): value is Record<string, string> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.values(value).every((item) => typeof item === 'string');

const isAsset = (value: unknown): value is CharacterAsset => {
  if (!value || typeof value !== 'object') return false;
  const asset = value as Record<string, unknown>;
  return ['type', 'uri', 'name', 'ext'].every((key) => typeof asset[key] === 'string');
};

const isAssetArray = (value: unknown): value is CharacterAsset[] =>
  Array.isArray(value) && value.every(isAsset);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const READERS: { [K in keyof Required<CharacterCardV3Extras>]: (value: unknown) => boolean } = {
  nickname: (value) => typeof value === 'string',
  group_only_greetings: isStringArray,
  source: isStringArray,
  creator_notes_multilingual: isStringRecord,
  assets: isAssetArray,
  creation_date: isFiniteNumber,
  modification_date: isFiniteNumber,
};

/** First valid value per V3 extra field across sources (earlier sources win). Absent fields are omitted. */
export function readCardV3Extras(...sources: Source[]): CharacterCardV3Extras {
  const extras: Record<string, unknown> = {};
  for (const [key, isValid] of Object.entries(READERS)) {
    for (const source of sources) {
      const value = (source as Record<string, unknown> | null | undefined)?.[key];
      if (value !== undefined && isValid(value)) {
        extras[key] = value;
        break;
      }
    }
  }
  return extras as CharacterCardV3Extras;
}
