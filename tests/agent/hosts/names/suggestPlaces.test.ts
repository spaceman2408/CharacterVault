import { describe, expect, it } from 'vitest';
import places from '../../../../src/agent/hosts/names/geonamesPlaces.json';
import { isFantasyCompound, OVERUSED_PLACES } from '../../../../src/agent/hosts/names/overusedPlaces';
import { MAX_NAME_COUNT, NAME_ORIGINS } from '../../../../src/agent/hosts/names/suggestNames';
import { suggestPlaces } from '../../../../src/agent/hosts/names/suggestPlaces';

const origins = places.origins as Record<string, { settlements: Record<string, string[]>; regions: string[] }>;

const realPlaces = new Set(
  Object.values(origins)
    .flatMap((origin) => [...Object.values(origin.settlements).flat(), ...origin.regions])
    .map((name) => name.toLowerCase()),
);

function action(headers: Record<string, string>) {
  return { name: 'suggest_places', headers, body: '' };
}

function namesIn(message: string): string[] {
  return message
    .split('\n')
    .slice(1)
    .filter((line) => !line.startsWith('Unknown origin'));
}

describe('suggestPlaces', () => {
  it('has place data for every name origin', () => {
    expect(Object.keys(origins).sort()).toEqual([...NAME_ORIGINS].sort());
  });

  it('returns real settlements of the chosen size', async () => {
    const result = await suggestPlaces(action({ origin: 'italian', size: 'city' }), []);
    expect(result.ok).toBe(true);
    expect(result.message.split('\n')[0]).toBe('suggest_places: 12 cities, italian');
    for (const name of namesIn(result.message)) expect(origins.italian.settlements.city).toContain(name);
  });

  it('mixes sizes by default', async () => {
    const result = await suggestPlaces(action({ origin: 'british', count: '30' }), []);
    expect(result.message.split('\n')[0]).toBe('suggest_places: 30 settlements, british');
    const all = Object.values(origins.british.settlements).flat();
    for (const name of namesIn(result.message)) expect(all).toContain(name);
  });

  it('returns real regions and ignores size for them', async () => {
    const result = await suggestPlaces(action({ origin: 'french', kind: 'region', size: 'city' }), []);
    expect(result.ok).toBe(true);
    expect(result.message.split('\n')[0]).toBe('suggest_places: 12 regions, french');
    for (const name of namesIn(result.message)) expect(origins.french.regions).toContain(name);
  });

  it('skips places already named in the text', async () => {
    const cities = origins.moldovan.settlements.city;
    const [kept, ...used] = cities;
    const result = await suggestPlaces(
      action({ origin: 'moldovan', size: 'city', count: '30' }),
      [`They left ${used.join(' and ')} behind.`],
    );
    expect(result.ok).toBe(true);
    expect(namesIn(result.message)).toEqual([kept]);
  });

  it('fails when every place is already used', async () => {
    const cities = origins.moldovan.settlements.city;
    const result = await suggestPlaces(action({ origin: 'moldovan', size: 'city' }), [cities.join(', ')]);
    expect(result.ok).toBe(false);
  });

  it('accepts origin labels and skips unknown ones', async () => {
    const result = await suggestPlaces(action({ origin: 'Scottish, South African' }), []);
    expect(result.ok).toBe(true);
    expect(result.message).toContain('south-african');
    expect(result.message).toContain('Unknown origin skipped: Scottish');
  });

  it('rejects a missing origin, unknown kind, or unknown size', async () => {
    expect((await suggestPlaces(action({}), [])).ok).toBe(false);
    expect((await suggestPlaces(action({ origin: 'scottish' }), [])).ok).toBe(false);
    expect((await suggestPlaces(action({ origin: 'french', kind: 'planet' }), [])).ok).toBe(false);
    expect((await suggestPlaces(action({ origin: 'french', size: 'hamlet' }), [])).ok).toBe(false);
  });

  it('clamps count', async () => {
    const many = await suggestPlaces(action({ origin: 'german', count: '99' }), []);
    expect(namesIn(many.message)).toHaveLength(MAX_NAME_COUNT);
    const one = await suggestPlaces(action({ origin: 'german', count: '0' }), []);
    expect(namesIn(one.message)).toHaveLength(1);
  });
});

describe('suggestPlaces invented', () => {
  it('invents places that are real in no origin and avoid AI fantasy compounds', async () => {
    for (let run = 0; run < 10; run += 1) {
      const result = await suggestPlaces(
        action({ origin: 'british, american, german', invented: 'true', count: '30' }),
        [],
      );
      expect(result.ok).toBe(true);
      expect(result.message.split('\n')[0]).toMatch(/^suggest_places: \d+ invented settlements?, british, american, german$/);
      for (const name of namesIn(result.message)) {
        expect(realPlaces.has(name.toLowerCase())).toBe(false);
        expect(OVERUSED_PLACES.has(name.toLowerCase())).toBe(false);
        expect(isFantasyCompound(name)).toBe(false);
      }
    }
  });

  it('invents regions from the settlement chain', async () => {
    const result = await suggestPlaces(action({ origin: 'japanese', kind: 'region', invented: 'true' }), []);
    expect(result.ok).toBe(true);
    expect(result.message.split('\n')[0]).toMatch(/^suggest_places: \d+ invented regions?, japanese$/);
    for (const name of namesIn(result.message)) expect(realPlaces.has(name.toLowerCase())).toBe(false);
  });

  it('keeps linking words lowercase', async () => {
    for (let run = 0; run < 10; run += 1) {
      const result = await suggestPlaces(action({ origin: 'french', invented: 'true', count: '30' }), []);
      for (const name of namesIn(result.message)) {
        expect(name).not.toMatch(/[\s-](Sur|Sous|La|Le|Les|De|Du|Des|En)(?=[\s-]|$)/u);
      }
    }
  });
});

describe('suggestPlaces natural features', () => {
  it('invents bare one-word names for rivers, mountains, and lakes', async () => {
    for (const kind of ['river', 'mountain', 'lake']) {
      const result = await suggestPlaces(action({ origin: 'british, german', kind, count: '30' }), []);
      expect(result.ok).toBe(true);
      expect(result.message.split('\n')[0]).toMatch(new RegExp(`^suggest_places: \\d+ invented ${kind}s?, british, german$`));
      for (const name of namesIn(result.message)) {
        expect(name).toMatch(/^\p{Lu}[\p{L}\p{M}]{2,8}$/u);
        expect(name).not.toMatch(/(ton|ham|by|ford|field|dorf|burg|heim|hausen|stadt|ingen)$/);
        expect(realPlaces.has(name.toLowerCase())).toBe(false);
        expect(isFantasyCompound(name)).toBe(false);
      }
    }
  });

  it('invents them even when invented is false', async () => {
    const result = await suggestPlaces(action({ origin: 'finnish', kind: 'lake', invented: 'false' }), []);
    expect(result.ok).toBe(true);
    expect(result.message.split('\n')[0]).toContain('invented lake');
    for (const name of namesIn(result.message)) expect(realPlaces.has(name.toLowerCase())).toBe(false);
  });

  it('never returns a word lifted from a real multi-word name', async () => {
    const fragments = new Set(
      Object.values(origins.british.settlements)
        .flat()
        .filter((name) => /[\s-]/.test(name))
        .flatMap((name) => name.split(/[\s-]+/))
        .map((word) => word.toLowerCase()),
    );
    for (let run = 0; run < 10; run += 1) {
      const result = await suggestPlaces(action({ origin: 'british', kind: 'river', count: '30' }), []);
      for (const name of namesIn(result.message)) expect(fragments.has(name.toLowerCase())).toBe(false);
    }
  });
});

describe('isFantasyCompound', () => {
  it('catches the AI place-name style', () => {
    for (const name of ['Oakhaven', 'Shadowvale', 'Stormhold', 'Silverbrook', 'Ravenwood', 'Mistvale', 'New Ashspire']) {
      expect(isFantasyCompound(name)).toBe(true);
    }
  });

  it('lets ordinary names through', () => {
    for (const name of ['Halestoft', 'Buckleworton', 'Kimberton', 'Wallingham', 'Childford', 'Asenbrück']) {
      expect(isFantasyCompound(name)).toBe(false);
    }
  });
});
