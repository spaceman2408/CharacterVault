import { describe, expect, it } from 'vitest';
import type { LorebookEntry } from '../../../src/db/characterTypes';
import {
  addKey,
  applyEntryFlagPatch,
  applyEntryPatch,
  buildRecursionGraph,
  contentMatchesKey,
  getBookRecursionStats,
  getConnectedComponents,
  getEgoStats,
  layerComponent,
  mergeEntryDraft,
  parseKeyList,
  removeKey,
  replaceKey,
  shouldPreferListLayout,
} from '../../../src/components/editor/lorebook/recursionGraph';

function entry(partial: Partial<LorebookEntry> & Pick<LorebookEntry, 'id'>): LorebookEntry {
  return {
    keys: [],
    content: '',
    extensions: {},
    enabled: true,
    ...partial,
  };
}

describe('contentMatchesKey', () => {
  it('matches plain substring case-insensitively by default', () => {
    expect(contentMatchesKey('Hello Rufus the dog', 'rufus')).toBe(true);
    expect(contentMatchesKey('Hello Rufus the dog', 'RUFUS')).toBe(true);
    expect(contentMatchesKey('Hello Rufus the dog', 'cat')).toBe(false);
  });

  it('honors case sensitivity', () => {
    expect(
      contentMatchesKey('Hello Rufus', 'rufus', { caseSensitive: true }),
    ).toBe(false);
    expect(
      contentMatchesKey('Hello Rufus', 'Rufus', { caseSensitive: true }),
    ).toBe(true);
  });

  it('honors whole-word matching for plain keys', () => {
    expect(
      contentMatchesKey('liking the crown', 'king', { matchWholeWords: true }),
    ).toBe(false);
    expect(
      contentMatchesKey('the king rules', 'king', { matchWholeWords: true }),
    ).toBe(true);
  });

  it('supports ST-style /regex/ keys', () => {
    expect(contentMatchesKey('Bessie-12', '/bessie-\\d+/i')).toBe(true);
    expect(contentMatchesKey('Bessie', '/^rufus$/i')).toBe(false);
  });

  it('falls back to literal when regex is invalid', () => {
    expect(contentMatchesKey('has /(/ broken', '/(/')).toBe(true);
  });
});

describe('buildRecursionGraph', () => {
  it('creates A→B when A content mentions B keys', () => {
    const a = entry({
      id: 1,
      comment: 'Bessie',
      keys: ['Bessie'],
      content: 'Bessie is a cow and is friends with Rufus.',
    });
    const b = entry({
      id: 2,
      comment: 'Rufus',
      keys: ['Rufus'],
      content: 'Rufus is a dog.',
    });

    const graph = buildRecursionGraph([a, b]);
    const out = graph.outgoing.get(1) ?? [];
    expect(out).toHaveLength(1);
    expect(out[0].toId).toBe(2);
    expect(out[0].matchedKeys).toEqual(['Rufus']);
    expect(graph.incoming.get(2)).toHaveLength(1);
    expect(getEgoStats(graph, 1)).toEqual({ triggers: 1, triggeredBy: 0 });
    expect(getEgoStats(graph, 2)).toEqual({ triggers: 0, triggeredBy: 1 });
  });

  it('does not self-link', () => {
    const a = entry({
      id: 1,
      keys: ['Echo'],
      content: 'Echo echoes Echo.',
    });
    const graph = buildRecursionGraph([a]);
    expect(graph.outgoing.get(1)).toEqual([]);
    expect(graph.incoming.get(1)).toEqual([]);
  });

  it('drops inbound when target is non-recursable', () => {
    const a = entry({ id: 1, content: 'mentions Target', keys: ['A'] });
    const b = entry({
      id: 2,
      keys: ['Target'],
      content: 'secret',
      excludeRecursion: true,
    });
    const graph = buildRecursionGraph([a, b]);
    expect(graph.outgoing.get(1)).toEqual([]);
    expect(graph.incoming.get(2)).toEqual([]);
  });

  it('drops outbound when source prevents further recursion', () => {
    const a = entry({
      id: 1,
      content: 'mentions Target',
      keys: ['A'],
      preventRecursion: true,
    });
    const b = entry({ id: 2, keys: ['Target'], content: 'secret' });
    const graph = buildRecursionGraph([a, b]);
    expect(graph.outgoing.get(1)).toEqual([]);
    expect(graph.incoming.get(2)).toEqual([]);
  });

  it('lists all matched keys on an edge', () => {
    const a = entry({ id: 1, content: 'Alpha and Beta appear here.', keys: [] });
    const b = entry({ id: 2, keys: ['Alpha', 'Beta', 'Gamma'], content: 'x' });
    const graph = buildRecursionGraph([a, b]);
    expect(graph.outgoing.get(1)?.[0]?.matchedKeys).toEqual(['Alpha', 'Beta']);
  });

  it('mergeEntryDraft swaps only the matching id', () => {
    const a = entry({ id: 1, content: 'old' });
    const b = entry({ id: 2, content: 'keep' });
    const draft = entry({ id: 1, content: 'new draft' });
    const merged = mergeEntryDraft([a, b], draft);
    expect(merged[0].content).toBe('new draft');
    expect(merged[1].content).toBe('keep');
  });

  it('applyEntryFlagPatch updates only selected ids', () => {
    const a = entry({ id: 1 });
    const b = entry({ id: 2 });
    const next = applyEntryFlagPatch([a, b], [2], { preventRecursion: true });
    expect(next[0].preventRecursion).toBeUndefined();
    expect(next[1].preventRecursion).toBe(true);
  });
});

describe('book stats, components, layers', () => {
  it('computes book stats', () => {
    const a = entry({
      id: 1,
      content: 'mentions TargetKey',
      keys: ['AlphaKey'],
    });
    const b = entry({
      id: 2,
      keys: ['TargetKey'],
      content: 'no links here',
      excludeRecursion: true,
    });
    const c = entry({
      id: 3,
      keys: ['CharlieKey'],
      content: 'isolated text',
      delayUntilRecursion: true,
    });
    // B is non-recursable so no edge A→B; no other key hits → all isolated
    const graph = buildRecursionGraph([a, b, c]);
    const stats = getBookRecursionStats([a, b, c], graph);
    expect(stats.entryCount).toBe(3);
    expect(stats.edgeCount).toBe(0);
    expect(stats.linkedCount).toBe(0);
    expect(stats.isolatedCount).toBe(3);
    expect(stats.excludeRecursionCount).toBe(1);
    expect(stats.delayUntilRecursionCount).toBe(1);
  });

  it('finds connected components across two islands', () => {
    const a = entry({ id: 1, content: 'B key here', keys: ['A'] });
    const b = entry({ id: 2, keys: ['B'], content: 'x' });
    const c = entry({ id: 3, content: 'D key here', keys: ['C'] });
    const d = entry({ id: 4, keys: ['D'], content: 'y' });
    const alone = entry({ id: 5, keys: ['Alone'], content: 'z' });
    const graph = buildRecursionGraph([a, b, c, d, alone]);
    const comps = getConnectedComponents([a, b, c, d, alone], graph);
    const linked = comps.filter((c) => c.edges.length > 0);
    const isolated = comps.filter((c) => c.edges.length === 0);
    expect(linked).toHaveLength(2);
    expect(isolated).toHaveLength(1);
    expect(isolated[0].entryIds).toEqual([5]);
  });

  it('layers sources before targets', () => {
    const a = entry({ id: 1, content: 'B and C', keys: ['A'] });
    const b = entry({ id: 2, keys: ['B'], content: 'C only' });
    const c = entry({ id: 3, keys: ['C'], content: 'leaf' });
    const graph = buildRecursionGraph([a, b, c]);
    const layers = layerComponent([1, 2, 3], graph);
    expect(layers[0]).toContain(1);
    expect(layers.flat()).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(layers.flat()).toHaveLength(3);
  });

  it('flag patch drops edges on rebuild', () => {
    const a = entry({ id: 1, content: 'Target word', keys: ['A'] });
    const b = entry({ id: 2, keys: ['Target'], content: 'x' });
    let entries = [a, b];
    let graph = buildRecursionGraph(entries);
    expect(getBookRecursionStats(entries, graph).edgeCount).toBe(1);
    entries = applyEntryFlagPatch(entries, [1], { preventRecursion: true });
    graph = buildRecursionGraph(entries);
    expect(getBookRecursionStats(entries, graph).edgeCount).toBe(0);
  });

  it('prefers list layout for large books', () => {
    expect(shouldPreferListLayout(10, 10)).toBe(false);
    expect(shouldPreferListLayout(151, 0)).toBe(true);
    expect(shouldPreferListLayout(10, 401)).toBe(true);
  });
});

describe('key list helpers', () => {
  it('parseKeyList trims and drops empties', () => {
    expect(parseKeyList('  Alpha, , Beta,Gamma  ')).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(parseKeyList('')).toEqual([]);
    expect(parseKeyList('   ,  ,')).toEqual([]);
  });

  it('addKey appends and dedupes case-insensitively', () => {
    expect(addKey(['Alpha'], 'Beta')).toEqual(['Alpha', 'Beta']);
    expect(addKey(['Alpha'], '  alpha  ')).toEqual(['Alpha']);
    expect(addKey(['Alpha'], '   ')).toEqual(['Alpha']);
  });

  it('removeKey drops the first exact match', () => {
    expect(removeKey(['Alpha', 'Beta'], 'Alpha')).toEqual(['Beta']);
    expect(removeKey(['Alpha', 'Beta'], 'alpha')).toEqual(['Alpha', 'Beta']);
    expect(removeKey(['Alpha'], 'Missing')).toEqual(['Alpha']);
  });

  it('replaceKey renames unless empty or colliding', () => {
    expect(replaceKey(['Alpha', 'Beta'], 'Alpha', 'Gamma')).toEqual(['Gamma', 'Beta']);
    expect(replaceKey(['Alpha', 'Beta'], 'Alpha', '  ')).toEqual(['Alpha', 'Beta']);
    expect(replaceKey(['Alpha', 'Beta'], 'Alpha', 'beta')).toEqual(['Alpha', 'Beta']);
    expect(replaceKey(['Alpha'], 'Missing', 'Gamma')).toEqual(['Alpha']);
    expect(replaceKey(['Alpha'], 'Alpha', 'Alpha')).toEqual(['Alpha']);
  });

  it('applyEntryPatch writes keys onto selected entries', () => {
    const a = entry({ id: 1, keys: ['Old'] });
    const b = entry({ id: 2, keys: ['Keep'] });
    const next = applyEntryPatch([a, b], [1], { keys: ['New'] });
    expect(next[0].keys).toEqual(['New']);
    expect(next[1].keys).toEqual(['Keep']);
  });

  it('key patch drops edges on rebuild', () => {
    const a = entry({ id: 1, content: 'Target word', keys: ['A'] });
    const b = entry({ id: 2, keys: ['Target'], content: 'x' });
    let entries = [a, b];
    expect(getBookRecursionStats(entries, buildRecursionGraph(entries)).edgeCount).toBe(1);
    entries = applyEntryPatch(entries, [2], { keys: ['Other'] });
    expect(getBookRecursionStats(entries, buildRecursionGraph(entries)).edgeCount).toBe(0);
  });
});
