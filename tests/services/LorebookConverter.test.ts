import { describe, expect, it } from 'vitest';
import {
  convertSTEntry,
  convertToSTEntry,
  convertSTLorebook,
  convertToSTLorebook,
  importLorebook,
} from '../../src/services/LorebookConverter';
import type { LorebookEntry } from '../../src/db/characterTypes';

describe('LorebookConverter', () => {
  it('maps ST at-depth position and role into curated fields', () => {
    const entry = convertSTEntry({
      uid: 1,
      key: ['castle'],
      keysecondary: ['north'],
      comment: 'Castle',
      content: 'A tall fortress.',
      constant: false,
      selective: true,
      order: 100,
      position: 4,
      disable: false,
      caseSensitive: false,
      selectiveLogic: 0,
      probability: 50,
      useProbability: true,
      depth: 2,
      role: 0,
      excludeRecursion: true,
      preventRecursion: false,
      delayUntilRecursion: false,
      matchWholeWords: true,
    });

    expect(entry.position).toBe('at_depth');
    expect(entry.depth).toBe(2);
    expect(entry.role).toBe(0);
    expect(entry.selective).toBe(true);
    expect(entry.selectiveLogic).toBe(0);
    expect(entry.probability).toBe(50);
    expect(entry.useProbability).toBe(true);
    expect(entry.excludeRecursion).toBe(true);
    expect(entry.matchWholeWords).toBe(true);
    expect(entry.extensions._st_position).toBe(4);
  });

  it('round-trips curated activation fields through ST export', () => {
    const original: LorebookEntry = {
      id: 7,
      keys: ['dragon'],
      secondary_keys: ['fire'],
      content: 'Wyrm.',
      extensions: {},
      enabled: true,
      comment: 'Dragon',
      selective: true,
      selectiveLogic: 3,
      priority: 42,
      position: 'at_depth',
      depth: 5,
      role: 2,
      constant: false,
      case_sensitive: true,
      matchWholeWords: false,
      probability: 75,
      useProbability: true,
      excludeRecursion: false,
      preventRecursion: true,
      delayUntilRecursion: true,
    };

    const st = convertToSTEntry(original, 0);
    expect(st.position).toBe(4);
    expect(st.depth).toBe(5);
    expect(st.role).toBe(2);
    expect(st.selectiveLogic).toBe(3);
    expect(st.probability).toBe(75);
    expect(st.preventRecursion).toBe(true);
    expect(st.delayUntilRecursion).toBe(true);
    expect(st.matchWholeWords).toBe(false);

    const back = convertSTEntry(st);
    expect(back.position).toBe('at_depth');
    expect(back.depth).toBe(5);
    expect(back.role).toBe(2);
    expect(back.selectiveLogic).toBe(3);
    expect(back.probability).toBe(75);
    expect(back.preventRecursion).toBe(true);
  });

  it('preserves unmapped ST position via _st_position when possible', () => {
    const entry = convertSTEntry({
      uid: 2,
      key: ['x'],
      keysecondary: [],
      comment: '',
      content: 'y',
      constant: false,
      selective: false,
      order: 0,
      position: 7, // outlet
      disable: false,
      caseSensitive: false,
      outletName: 'scene',
    });

    expect(entry.extensions._st_position).toBe(7);
    expect(entry.extensions.outletName).toBe('scene');

    const st = convertToSTEntry(entry, 0);
    // Still maps to outlet raw position because curated position matches POSITION_MAP[7]
    expect(st.position).toBe(7);
    expect(st.outletName).toBe('scene');
  });

  it('imports full ST lorebook record format', () => {
    const data = {
      entries: {
        '0': {
          uid: 0,
          key: ['a'],
          keysecondary: [],
          comment: 'A',
          content: 'Alpha',
          constant: true,
          selective: false,
          order: 10,
          position: 0,
          disable: false,
          caseSensitive: false,
        },
        '1': {
          uid: 1,
          key: ['b'],
          keysecondary: ['c'],
          comment: 'B',
          content: 'Beta',
          constant: false,
          selective: true,
          order: 20,
          position: 5,
          disable: false,
          caseSensitive: true,
          selectiveLogic: 2,
        },
      },
    };

    const book = convertSTLorebook(data);
    expect(book.entries).toHaveLength(2);
    expect(book.entries[0].constant).toBe(true);
    expect(book.entries[1].position).toBe('before_example');
    expect(book.entries[1].selectiveLogic).toBe(2);

    const exported = convertToSTLorebook(book);
    expect(Object.keys(exported.entries)).toEqual(['0', '1']);
    expect(exported.entries['1'].position).toBe(5);

    const reimported = importLorebook(exported);
    expect(reimported?.entries).toHaveLength(2);
  });
});
