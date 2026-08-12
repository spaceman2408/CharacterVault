import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterCustomContext, LorebookCustomContext } from '../../src/db/characterTypes';

const { get, put, del, update, lbGet, lbPut, lbDel, lbUpdate } = vi.hoisted(() => {
  const getFn = vi.fn();
  const putFn = vi.fn();
  const delFn = vi.fn();
  const updateFn = vi.fn();
  const lbGetFn = vi.fn();
  const lbPutFn = vi.fn();
  const lbDelFn = vi.fn();
  const lbUpdateFn = vi.fn();
  return {
    get: getFn,
    put: putFn,
    del: delFn,
    update: updateFn,
    lbGet: lbGetFn,
    lbPut: lbPutFn,
    lbDel: lbDelFn,
    lbUpdate: lbUpdateFn,
  };
});

vi.mock('../../src/db', () => ({
  characterDb: {
    characterCustomContext: {
      get,
      put,
      delete: del,
      update,
    },
    lorebookCustomContext: {
      get: lbGet,
      put: lbPut,
      delete: lbDel,
      update: lbUpdate,
    },
  },
}));

import {
  CustomContextService,
  CUSTOM_CONTEXT_HEADER,
  formatCustomContextChunk,
  estimateCustomContextTokensFromCharLength,
} from '../../src/services/CustomContextService';

function makeRow(overrides: Partial<CharacterCustomContext> = {}): CharacterCustomContext {
  return {
    characterId: 'char-1',
    content: 'Hello world',
    enabled: true,
    updatedAt: '2020-01-01T00:00:00.000Z',
    charLength: 11,
    ...overrides,
  };
}

function makeLorebookRow(
  overrides: Partial<LorebookCustomContext> = {},
): LorebookCustomContext {
  return {
    lorebookId: 'book-1',
    content: 'World notes',
    enabled: true,
    updatedAt: '2020-01-01T00:00:00.000Z',
    charLength: 11,
    ...overrides,
  };
}

describe('CustomContextService helpers', () => {
  it('formats the AI chunk with a stable header', () => {
    expect(formatCustomContextChunk('notes')).toBe(`${CUSTOM_CONTEXT_HEADER}\nnotes`);
  });

  it('estimates tokens from char length without loading body', () => {
    expect(estimateCustomContextTokensFromCharLength(0)).toBe(0);
    expect(estimateCustomContextTokensFromCharLength(100)).toBeGreaterThan(0);
  });
});

describe('CustomContextService', () => {
  const service = new CustomContextService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getMeta returns empty meta when no row', async () => {
    get.mockResolvedValue(undefined);
    await expect(service.getMeta('char-1')).resolves.toEqual({
      enabled: false,
      charLength: 0,
      updatedAt: null,
    });
  });

  it('getMeta maps row without exposing content', async () => {
    get.mockResolvedValue(makeRow());
    await expect(service.getMeta('char-1')).resolves.toEqual({
      enabled: true,
      charLength: 11,
      updatedAt: '2020-01-01T00:00:00.000Z',
    });
  });

  it('getContent returns null when empty', async () => {
    get.mockResolvedValue(makeRow({ content: '', charLength: 0 }));
    await expect(service.getContent('char-1')).resolves.toBeNull();
  });

  it('getEnabledContent returns null when disabled', async () => {
    get.mockResolvedValue(makeRow({ enabled: false }));
    await expect(service.getEnabledContent('char-1')).resolves.toBeNull();
  });

  it('getEnabledContent returns body when enabled', async () => {
    get.mockResolvedValue(makeRow({ content: '  secret  ', charLength: 10 }));
    await expect(service.getEnabledContent('char-1')).resolves.toBe('  secret  ');
  });

  it('save deletes row when content is empty', async () => {
    del.mockResolvedValue(undefined);
    const meta = await service.save('char-1', { content: '', enabled: true });
    expect(del).toHaveBeenCalledWith('char-1');
    expect(put).not.toHaveBeenCalled();
    expect(meta).toEqual({ enabled: false, charLength: 0, updatedAt: null });
  });

  it('save puts row with charLength and enabled', async () => {
    put.mockResolvedValue(undefined);
    const meta = await service.save('char-1', { content: 'abc', enabled: true });
    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: 'char-1',
        content: 'abc',
        enabled: true,
        charLength: 3,
      })
    );
    expect(meta.charLength).toBe(3);
    expect(meta.enabled).toBe(true);
    expect(meta.updatedAt).toBeTruthy();
  });

  it('setEnabled patches the row without put of full body', async () => {
    update.mockResolvedValue(1);
    await expect(service.setEnabled('char-1', false)).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({ enabled: false })
    );
    expect(get).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('setEnabled returns false when no row exists', async () => {
    update.mockResolvedValue(0);
    await expect(service.setEnabled('char-1', true)).resolves.toBe(false);
  });

  it('clear deletes the row', async () => {
    del.mockResolvedValue(undefined);
    await service.clear('char-1');
    expect(del).toHaveBeenCalledWith('char-1');
  });

  it('routes lorebook owner to the lorebook table', async () => {
    lbGet.mockResolvedValue(makeLorebookRow());
    await expect(service.getMeta('book-1', 'lorebook')).resolves.toEqual({
      enabled: true,
      charLength: 11,
      updatedAt: '2020-01-01T00:00:00.000Z',
    });
    expect(lbGet).toHaveBeenCalledWith('book-1');
    expect(get).not.toHaveBeenCalled();
  });

  it('save for lorebook writes lorebookId and skips the character table', async () => {
    lbPut.mockResolvedValue(undefined);
    const meta = await service.save('book-1', { content: 'abc', enabled: true }, 'lorebook');
    expect(lbPut).toHaveBeenCalledWith(
      expect.objectContaining({
        lorebookId: 'book-1',
        content: 'abc',
        enabled: true,
        charLength: 3,
      }),
    );
    expect(put).not.toHaveBeenCalled();
    expect(meta.charLength).toBe(3);
  });

  it('getEnabledContent for lorebook reads the lorebook table', async () => {
    lbGet.mockResolvedValue(makeLorebookRow({ content: '  notes  ', charLength: 9 }));
    await expect(service.getEnabledContent('book-1', 'lorebook')).resolves.toBe('  notes  ');
    expect(get).not.toHaveBeenCalled();
  });
});
