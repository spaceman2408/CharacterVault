import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOOLBAR_CONFIG,
  DEFAULT_TOOLBAR_ORDER,
  normalizeToolbarConfig,
} from '../../src/db/characterTypes';

describe('normalizeToolbarConfig', () => {
  it('returns defaults for nullish input', () => {
    expect(normalizeToolbarConfig(undefined)).toEqual(DEFAULT_TOOLBAR_CONFIG);
    expect(normalizeToolbarConfig(null)).toEqual(DEFAULT_TOOLBAR_CONFIG);
  });

  it('returns defaults for non-object input', () => {
    expect(normalizeToolbarConfig('nope')).toEqual(DEFAULT_TOOLBAR_CONFIG);
  });

  it('keeps a valid custom layout', () => {
    const config = normalizeToolbarConfig({
      order: ['rewrite', 'instruct', 'custom:abc', 'expand'],
      customOps: [{ id: 'custom:abc', label: 'Pirate', icon: '🏴', color: '#0891b2', prompt: 'Argh: ${text}' }],
    });
    expect(config.order).toEqual(['rewrite', 'instruct', 'custom:abc', 'expand']);
    expect(config.customOps).toHaveLength(1);
    expect(config.customOps[0]).toMatchObject({ id: 'custom:abc', label: 'Pirate', color: '#0891b2' });
  });

  it('pins instruct when missing', () => {
    const config = normalizeToolbarConfig({ order: ['expand', 'rewrite'], customOps: [] });
    expect(config.order).toContain('instruct');
  });

  it('pins instruct at the default position for short orders', () => {
    const config = normalizeToolbarConfig({ order: ['expand'], customOps: [] });
    expect(config.order).toEqual(['expand', 'instruct']);
  });

  it('drops unknown order ids', () => {
    const config = normalizeToolbarConfig({ order: ['expand', 'nope', 'instruct'], customOps: [] });
    expect(config.order).toEqual(['expand', 'instruct']);
  });

  it('dedupes order entries keeping the first occurrence', () => {
    const config = normalizeToolbarConfig({
      order: ['expand', 'expand', 'instruct', 'rewrite', 'rewrite'],
      customOps: [],
    });
    expect(config.order).toEqual(['expand', 'instruct', 'rewrite']);
  });

  it('uses the default order when order is not an array', () => {
    const config = normalizeToolbarConfig({ customOps: [] });
    expect(config.order).toEqual(DEFAULT_TOOLBAR_ORDER);
  });

  it('drops custom ops with invalid ids', () => {
    const config = normalizeToolbarConfig({
      order: ['instruct', 'custom:ok', 'evil', 'custom:bad id!'],
      customOps: [
        { id: 'custom:ok', label: 'Ok', icon: '✨', prompt: 'Do ${text}' },
        { id: 'evil', label: 'Evil', icon: '✨', prompt: 'Do ${text}' },
        { id: 'custom:bad id!', label: 'Bad', icon: '✨', prompt: 'Do ${text}' },
      ],
    });
    expect(config.customOps.map((op) => op.id)).toEqual(['custom:ok']);
    expect(config.order).not.toContain('evil');
    expect(config.order).not.toContain('custom:bad id!');
  });

  it('drops custom ops missing the ${text} placeholder', () => {
    const config = normalizeToolbarConfig({
      order: ['instruct', 'custom:bad'],
      customOps: [{ id: 'custom:bad', label: 'Bad', icon: '✨', prompt: 'no placeholder' }],
    });
    expect(config.customOps).toEqual([]);
    expect(config.order).not.toContain('custom:bad');
  });

  it('drops custom ops with empty or overlong labels', () => {
    const config = normalizeToolbarConfig({
      order: ['instruct'],
      customOps: [
        { id: 'custom:a', label: '   ', icon: '✨', prompt: 'Do ${text}' },
        { id: 'custom:b', label: 'x'.repeat(41), icon: '✨', prompt: 'Do ${text}' },
      ],
    });
    expect(config.customOps).toEqual([]);
  });

  it('dedupes custom ops by id keeping the first', () => {
    const config = normalizeToolbarConfig({
      order: ['instruct', 'custom:dup'],
      customOps: [
        { id: 'custom:dup', label: 'First', icon: '✨', prompt: 'Do ${text}' },
        { id: 'custom:dup', label: 'Second', icon: '🔥', prompt: 'Do ${text}' },
      ],
    });
    expect(config.customOps).toHaveLength(1);
    expect(config.customOps[0].label).toBe('First');
  });

  it('defaults missing icons and trims labels', () => {
    const config = normalizeToolbarConfig({
      order: ['instruct', 'custom:ic'],
      customOps: [{ id: 'custom:ic', label: '  Spaced  ', icon: '', prompt: 'Do ${text}' }],
    });
    expect(config.customOps[0]).toMatchObject({ label: 'Spaced', icon: '✨' });
  });

  it('keeps palette colors and defaults anything else', () => {
    const config = normalizeToolbarConfig({
      order: ['instruct', 'custom:ok', 'custom:weird', 'custom:missing'],
      customOps: [
        { id: 'custom:ok', label: 'Ok', icon: '✨', color: '#0891b2', prompt: 'Do ${text}' },
        { id: 'custom:weird', label: 'Weird', icon: '✨', color: 'red', prompt: 'Do ${text}' },
        { id: 'custom:missing', label: 'Missing', icon: '✨', prompt: 'Do ${text}' },
      ],
    });
    expect(config.customOps.map((op) => op.color)).toEqual([
      '#0891b2',
      '#5b5270',
      '#5b5270',
    ]);
  });

  it('does not mutate the default config', () => {
    normalizeToolbarConfig(undefined).order.push('expand');
    expect(DEFAULT_TOOLBAR_CONFIG.order).toEqual(DEFAULT_TOOLBAR_ORDER);
  });
});
