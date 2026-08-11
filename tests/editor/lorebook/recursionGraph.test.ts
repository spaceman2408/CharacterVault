import { describe, expect, it } from 'vitest';
import type { LorebookEntry } from '../../../src/db/characterTypes';
import {
  buildRecursionGraph,
  contentMatchesKey,
  getEgoStats,
  mergeEntryDraft,
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
});
