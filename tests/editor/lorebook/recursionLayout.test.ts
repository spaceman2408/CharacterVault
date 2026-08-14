import { describe, expect, it } from 'vitest';
import type { LorebookEntry } from '../../../src/db/characterTypes';
import { buildRecursionGraph } from '../../../src/components/editor/lorebook/recursionGraph';
import {
  MAX_LAYER_ROWS,
  NODE_H,
  NODE_W,
  computeLayout,
  wrapLayer,
} from '../../../src/components/editor/lorebook/recursionLayout';

function entry(partial: Partial<LorebookEntry> & Pick<LorebookEntry, 'id'>): LorebookEntry {
  return {
    keys: [],
    content: '',
    extensions: {},
    enabled: true,
    ...partial,
  };
}

describe('wrapLayer', () => {
  it('keeps a short rank as one column', () => {
    expect(wrapLayer([1, 2, 3], 8)).toEqual([[1, 2, 3]]);
  });

  it('splits a tall rank into even columns', () => {
    const ids = Array.from({ length: 17 }, (_, i) => i + 1);
    const cols = wrapLayer(ids, 8);
    expect(cols).toHaveLength(3);
    expect(cols.map((c) => c.length)).toEqual([6, 6, 5]);
    expect(cols.flat()).toEqual(ids);
  });

  it('returns empty for no ids', () => {
    expect(wrapLayer([], 8)).toEqual([]);
  });
});

describe('computeLayout', () => {
  it('fans a wide hub-and-spoke rank out horizontally instead of one tall column', () => {
    const hub = entry({ id: 1, keys: ['Hub'], content: 'Spoke keys live here: ' });
    const spokes: LorebookEntry[] = [];
    for (let i = 0; i < 20; i++) {
      const name = `Spoke-${String(i).padStart(2, '0')}`;
      spokes.push(entry({ id: i + 2, keys: [name], content: 'leaf' }));
      hub.content += `${name} `;
    }
    const entries = [hub, ...spokes];
    const graph = buildRecursionGraph(entries);
    const layout = computeLayout(entries, graph, false);

    const ys = [...layout.pos.values()].map((p) => p.y);
    const xs = [...layout.pos.values()].map((p) => p.x);
    const height = Math.max(...ys) - Math.min(...ys) + NODE_H;
    const width = Math.max(...xs) - Math.min(...xs) + NODE_W;

    expect(width).toBeGreaterThan(height);
    const uniqueX = new Set(xs);
    expect(uniqueX.size).toBeGreaterThan(2);
    const maxStack = Math.max(
      ...[...uniqueX].map((x) => [...layout.pos.values()].filter((p) => p.x === x).length),
    );
    expect(maxStack).toBeLessThanOrEqual(MAX_LAYER_ROWS);
  });
});
