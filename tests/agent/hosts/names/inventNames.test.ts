import { describe, expect, it } from 'vitest';
import { buildNameModel, inventName } from '../../../../src/agent/hosts/names/inventNames';
import fakerNames from '../../../../src/agent/hosts/names/fakerNames.json';

describe('buildNameModel', () => {
  it('needs at least one name', () => {
    expect(buildNameModel([])).toBeNull();
    expect(buildNameModel([[], []])).toBeNull();
  });

  it('uses a shorter chain for small lists', () => {
    expect(buildNameModel([fakerNames.origins.finnish.first.female])?.order).toBe(2);
    expect(buildNameModel([fakerNames.origins.italian.first.female])?.order).toBe(3);
  });

  it('weighs each list the same when blending', () => {
    const model = buildNameModel([['Ana'], ['Bob', 'Bill']])!;
    const starts = model.transitions.get('\u0002'.repeat(model.order))!;
    expect(starts.get('a')).toBe(2);
    expect(starts.get('b')).toBe(2);
  });
});

describe('inventName', () => {
  const training = fakerNames.origins.finnish.first.female;
  const model = buildNameModel([training])!;
  const lowered = training.map((name) => name.toLowerCase());

  it('never returns a training name or a training name with a tail', () => {
    const real = new Set(lowered);
    let invented = 0;
    for (let draw = 0; draw < 500; draw += 1) {
      const name = inventName(model, real);
      if (!name) continue;
      invented += 1;
      const lower = name.toLowerCase();
      expect(real.has(lower)).toBe(false);
      for (const source of lowered) {
        if (source.length >= 4 && lower.length - source.length >= 3) expect(lower.startsWith(source)).toBe(false);
      }
      expect([...lower].length).toBeGreaterThanOrEqual(model.minLength);
      expect([...lower].length).toBeLessThanOrEqual(model.maxLength);
      expect(name[0]).toBe(name[0].toUpperCase());
    }
    expect(invented).toBeGreaterThan(0);
  });

  it('skips names in the real-name set it is given', () => {
    const blocked = new Set<string>();
    for (let draw = 0; draw < 200; draw += 1) {
      const name = inventName(model, blocked);
      if (name) blocked.add(name.toLowerCase());
    }
    for (let draw = 0; draw < 200; draw += 1) {
      const name = inventName(model, blocked);
      if (name) expect(blocked.has(name.toLowerCase())).toBe(false);
    }
  });
});
